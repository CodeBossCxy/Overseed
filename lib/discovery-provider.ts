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
  const cached = await prisma.creatorEnrichmentCache
    .findUnique({ where: { platform_handle: { platform, handle: normalizedHandle } } })
    .catch(() => null)
  if (cached) {
    const data = cached.data as any
    return { detail: data?.detail ?? {}, email: data?.email ?? null }
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

  await prisma.creatorEnrichmentCache
    .upsert({
      where: { platform_handle: { platform, handle: normalizedHandle } },
      create: { platform, handle: normalizedHandle, data: result },
      update: { data: result, fetchedAt: new Date() },
    })
    .catch((error) => console.error('Provider enrichment cache write failed:', error))
  return result
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
      const result = await discoveryEnrichForOutreach(platform, handle)
      return result.email
    } catch {
      return null
    }
  }
  const { getCreatorContactEmail } = await import('@/lib/influencers-club')
  return (await getCreatorContactEmail(platform as ClubPlatform, handle)) ?? null
}
