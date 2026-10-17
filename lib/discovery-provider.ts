// Discovery provider abstraction — switch between Influencers Club and
// CreatorDB by setting DISCOVERY_PROVIDER=club|creatordb in .env.
// Both providers return the same normalized search result shape so the
// rest of the app (DiscoverPanel, club-search route, outreach-ai) works
// unchanged regardless of which backend is active.

import type { ClubSearchOptions, ClubPlatform } from '@/lib/influencers-club'

export type DiscoveryProvider = 'club' | 'creatordb'

export function getProvider(): DiscoveryProvider {
  const v = (process.env.DISCOVERY_PROVIDER || 'club').toLowerCase()
  if (v === 'creatordb') return 'creatordb'
  return 'club'
}

export function providerConfigured(): boolean {
  const p = getProvider()
  if (p === 'creatordb') {
    return Boolean(process.env.CREATORDB_API_KEY)
  }
  return Boolean(process.env.INFLUENCERS_CLUB_API_KEY)
}

export function providerName(): string {
  return getProvider() === 'creatordb' ? 'CreatorDB' : 'Influencers Club'
}

/**
 * Run a discovery search through the active provider.
 * Returns the same shape as clubSearch() — {results, warnings, ...}.
 */
export async function discoverySearch(opts: ClubSearchOptions) {
  const p = getProvider()
  if (p === 'creatordb') {
    const { creatordbSearch } = await import('@/lib/creatordb')
    return creatordbSearch(opts)
  }
  const { clubSearch } = await import('@/lib/influencers-club')
  return clubSearch(opts)
}

/**
 * Cache probe — check if we already have a cached result for this search.
 * CreatorDB has no built-in cache probe; the app's club_search_cache
 * layer handles caching above both providers.
 */
export async function discoverySearchCacheProbe(opts: ClubSearchOptions) {
  const p = getProvider()
  if (p === 'creatordb') {
    const { creatordbSearchCacheProbe } = await import('@/lib/creatordb')
    return creatordbSearchCacheProbe(opts)
  }
  const { clubSearchCacheProbe } = await import('@/lib/influencers-club')
  return clubSearchCacheProbe(opts)
}

/**
 * Enrich a creator's profile (Layer 2).
 * Returns the same shape as clubEnrich() — { name, bio, location, accounts, ... }.
 */
export async function discoveryEnrich(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
) {
  const p = getProvider()
  if (p === 'creatordb') {
    const { creatordbEnrich } = await import('@/lib/creatordb')
    return creatordbEnrich(platform, handle, opts)
  }
  const { clubEnrich } = await import('@/lib/influencers-club')
  return clubEnrich(platform as ClubPlatform, handle, opts?.logUserId)
}

/**
 * Fetch audience analytics (Layer 3).
 * Returns the same shape as clubAnalytics() — { audience: { genders, ages, countries, ... } }.
 */
export async function discoveryAnalytics(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
) {
  const p = getProvider()
  if (p === 'creatordb') {
    const { creatordbAnalytics } = await import('@/lib/creatordb')
    return creatordbAnalytics(platform, handle, opts)
  }
  const { clubAnalytics } = await import('@/lib/influencers-club')
  return clubAnalytics(platform as ClubPlatform, handle, opts?.logUserId)
}

/**
 * Fetch contact info for a creator on-demand. Separated from profile
 * enrichment because CreatorDB charges 0-15 credits per contact lookup.
 */
export async function discoveryContact(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
): Promise<{ email: string | null; emails: string[] }> {
  const p = getProvider()
  if (p === 'creatordb') {
    const { creatordbContact } = await import('@/lib/creatordb')
    return creatordbContact(platform, handle, opts)
  }
  // Club provider doesn't have a separate contact endpoint — return empty
  return { email: null, emails: [] }
}

/**
 * Fetch the normalized profile fields and server-only contact email needed by
 * mass outreach. The permanent enrichment cache is shared across providers so
 * repeat selections do not trigger another paid vendor lookup.
 */
export async function discoveryEnrichForOutreach(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
): Promise<{ detail: any; email: string | null }> {
  const normalizedHandle = handle.replace(/^@/, '').toLowerCase()
  const { prisma } = await import('@/lib/prisma')

  // Check primary cache (creatorEnrichmentCache)
  const cached = await prisma.creatorEnrichmentCache
    .findUnique({ where: { platform_handle: { platform, handle: normalizedHandle } } })
    .catch(() => null)
  if (cached) {
    const data = cached.data as any
    return { detail: data?.detail ?? {}, email: data?.email ?? null }
  }

  // Check fallback cache (discoveryViewCache) — the profile-view route
  // writes here, so we can avoid a vendor call if the user already viewed
  // this creator's profile.
  if (opts?.logUserId) {
    const viewCached = await prisma.discoveryViewCache
      .findFirst({ where: { userId: opts.logUserId, kind: 'profile', platform, handle: normalizedHandle } })
      .catch(() => null)
    if (viewCached) {
      const d = viewCached.data as any
      return { detail: d ?? {}, email: d?._email ?? null }
    }
  }

  let result: { detail: any; email: string | null }
  if (getProvider() === 'creatordb') {
    const { creatordbEnrichForOutreach } = await import('@/lib/creatordb')
    result = await creatordbEnrichForOutreach(platform, normalizedHandle, opts)
  } else {
    const { clubEnrichProfile, getCreatorContactEmail } = await import('@/lib/influencers-club')
    const detail = await clubEnrichProfile(platform as ClubPlatform, normalizedHandle, opts?.logUserId)
    const email = await getCreatorContactEmail(platform as ClubPlatform, normalizedHandle)
    result = { detail, email: email ?? null }
  }

  // Sanitize before writing — strip undefined/NaN values that break Prisma JSON
  const safeResult = JSON.parse(JSON.stringify(result))

  await prisma.creatorEnrichmentCache
    .upsert({
      where: { platform_handle: { platform, handle: normalizedHandle } },
      create: { platform, handle: normalizedHandle, data: safeResult },
      update: { data: safeResult, fetchedAt: new Date() },
    })
    .catch((error) => console.error('[enrichForOutreach] cache write failed:', error))
  return result
}

/**
 * Resolve a creator's contact email using the cached hasEmail signal.
 * - If email is already cached, return it immediately.
 * - If hasEmail === true but no email cached, call CreatorDB /contact to fetch it.
 * - If hasEmail === false, skip the API call.
 * - If no cache entry, return unknown.
 */
export async function resolveCreatorEmail(
  platform: string,
  handle: string,
  opts?: { logUserId?: string },
): Promise<{
  email: string | null
  hasEmail: boolean | null
  source: 'cache' | 'contact-api' | 'none'
}> {
  const normalizedHandle = handle.replace(/^@/, '').toLowerCase()
  const { prisma } = await import('@/lib/prisma')

  const cached = await prisma.creatorContactCache
    .findUnique({ where: { platform_handle: { platform, handle: normalizedHandle } } })
    .catch(() => null)

  if (cached) {
    if (cached.email) {
      return { email: cached.email, hasEmail: true, source: 'cache' }
    }
    if (!cached.hasEmail) {
      return { email: null, hasEmail: false, source: 'cache' }
    }
    // hasEmail === true but email not yet fetched — call the contact endpoint
    try {
      const email = await discoveryGetContactEmail(platform, normalizedHandle)
      if (email) {
        await prisma.creatorContactCache
          .upsert({
            where: { platform_handle: { platform, handle: normalizedHandle } },
            create: { platform, handle: normalizedHandle, hasEmail: true, email, emails: [email] },
            update: { email, emails: [email], fetchedAt: new Date() },
          })
          .catch(() => {})
      }
      return { email, hasEmail: true, source: 'contact-api' }
    } catch {
      return { email: null, hasEmail: true, source: 'contact-api' }
    }
  }

  // No cache entry — proactively fetch contact info from the API
  try {
    const email = await discoveryGetContactEmail(platform, normalizedHandle)
    const hasEmail = email != null
    // Cache the result so future lookups are instant
    await prisma.creatorContactCache
      .upsert({
        where: { platform_handle: { platform, handle: normalizedHandle } },
        create: { platform, handle: normalizedHandle, hasEmail, email, emails: email ? [email] : [] },
        update: { hasEmail, email, emails: email ? [email] : [], fetchedAt: new Date() },
      })
      .catch(() => {})
    return { email, hasEmail, source: 'contact-api' }
  } catch {
    return { email: null, hasEmail: null, source: 'none' }
  }
}

/**
 * Get a creator's contact email (server-side only).
 * For CreatorDB, the email is extracted during enrichment and cached.
 */
export async function discoveryGetContactEmail(
  platform: string,
  handle: string
): Promise<string | null> {
  const p = getProvider()
  if (p === 'creatordb') {
    try {
      const result = await discoveryContact(platform, handle)
      return result.email
    } catch {
      return null
    }
  }
  const { getCreatorContactEmail } = await import('@/lib/influencers-club')
  return (await getCreatorContactEmail(platform as ClubPlatform, handle)) ?? null
}
