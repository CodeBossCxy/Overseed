// TEMP: influencers.club discovery source (docs.influencers.club).
// Remove together with app/api/discovery/club-search/ and the
// "Data source" picker block in components/discovery/DiscoverPanel.tsx.
//
// Credits: 0.01 per creator returned by /public/v1/discovery/ (0 if no
// results). Dictionary endpoints are free. Keep page sizes small.

const BASE = 'https://api-dashboard.influencers.club'

export type ClubPlatform = 'instagram' | 'youtube' | 'tiktok'

export function clubConfigured(): boolean {
  return Boolean(process.env.INFLUENCERS_CLUB_API_KEY)
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.INFLUENCERS_CLUB_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

// ISO-2 country code -> club location string, via the free locations
// dictionary. Cached per platform+code for the life of the server process.
const locationCache = new Map<string, string | null>()

async function resolveLocation(
  platform: ClubPlatform,
  isoCountry: string
): Promise<string | null> {
  const iso = isoCountry.trim().toUpperCase()
  const cacheKey = `${platform}:${iso}`
  const cached = locationCache.get(cacheKey)
  if (cached !== undefined) return cached

  let name = iso
  try {
    name = new Intl.DisplayNames(['en'], { type: 'region' }).of(iso) || iso
  } catch {
    // fall through with the raw code
  }

  let resolved: string | null = null
  try {
    const url = new URL(`/public/v1/discovery/classifier/locations/${platform}/`, BASE)
    url.searchParams.set('search', name)
    url.searchParams.set('limit', '10')
    const res = await fetch(url, {
      headers: authHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      const items: string[] = (Array.isArray(data) ? data : data?.results || [])
        .map((x: any) => (typeof x === 'string' ? x : x?.name))
        .filter(Boolean)
      resolved =
        items.find((x) => x.toLowerCase() === name.toLowerCase()) ??
        // fall back to the shortest match ("United States" over cities)
        items.sort((a, b) => a.length - b.length)[0] ??
        null
    }
  } catch {
    resolved = null
  }
  locationCache.set(cacheKey, resolved)
  return resolved
}

const PROFILE_URL: Record<ClubPlatform, (handle: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
}

export interface ClubSearchOptions {
  platform: ClubPlatform
  query?: string
  country?: string
  minFollowers?: number
  maxFollowers?: number
  limit: number
  page?: number
}

export async function clubSearch(opts: ClubSearchOptions) {
  const warnings: string[] = []
  const filters: Record<string, any> = {}

  if (opts.query) filters.ai_search = opts.query.slice(0, 150)

  if (opts.minFollowers != null || opts.maxFollowers != null) {
    const key =
      opts.platform === 'youtube' ? 'number_of_subscribers' : 'number_of_followers'
    filters[key] = {
      ...(opts.minFollowers != null ? { min: opts.minFollowers } : {}),
      ...(opts.maxFollowers != null ? { max: opts.maxFollowers } : {}),
    }
  }

  if (opts.country?.trim()) {
    const location = await resolveLocation(opts.platform, opts.country)
    if (location) {
      filters.location = [location]
    } else {
      warnings.push(
        `Country "${opts.country.toUpperCase()}" not recognized by Influencers Club — location filter skipped.`
      )
    }
  }

  const body = {
    platform: opts.platform,
    paging: { limit: opts.limit, page: opts.page ?? 0 },
    sort: {
      sort_by: opts.query ? 'relevancy' : 'number_of_followers',
      sort_order: 'desc',
    },
    filters,
  }

  const res = await fetch(`${BASE}/public/v1/discovery/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail =
      data?.detail || data?.message || `Influencers Club search failed (${res.status})`
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }

  // Same shape as the KOL proxy so DiscoverPanel renders results unchanged.
  const results = (data?.accounts || []).map((a: any) => ({
    id: `club:${opts.platform}:${a.user_id}`,
    platform: opts.platform,
    handle: a.profile?.username ?? null,
    display_name: a.profile?.full_name || a.profile?.username || null,
    bio: null,
    country: null,
    follower_count: a.profile?.followers ?? null,
    engagement_rate: a.profile?.engagement_percent ?? null,
    niche_tags: [],
    profile_url: a.profile?.username ? PROFILE_URL[opts.platform](a.profile.username) : null,
    // NOTE: club picture URLs expire after ~24h; fine for transient search results
    avatar_url: a.profile?.picture ?? null,
    score: a.similarity_score ?? null,
  }))

  return {
    results,
    total: data?.total ?? results.length,
    credits_left: data?.credits_left ?? null,
    platform_coverage: {},
    warnings,
    cache_hits: 0,
    live_calls: 1,
  }
}

// ---------------------------------------------------------------------------
// Creator detail (enrich by handle, full) — 1 credit per uncached lookup.
// Contact info policy: brands must only reach creators through Overseed, so
// email fields, bio links, and off-platform link lists are stripped/redacted
// server-side before anything reaches the browser.
// ---------------------------------------------------------------------------

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

const ENRICH_PLATFORM_KEYS = [
  'instagram',
  'youtube',
  'tiktok',
  'twitter',
  'snapchat',
  'discord',
  'pinterest',
  'facebook',
  'linkedin',
  'twitch',
  'onlyfans',
] as const

// Sanitized details cached per platform:handle for the server process life —
// repeat opens of the same creator cost no credits.
const enrichCache = new Map<string, any>()

// Creator emails stay SERVER-SIDE ONLY, keyed like enrichCache. Used by the
// outreach route to deliver messages without ever revealing the address.
const contactEmailCache = new Map<string, string | null>()

// Persistent 30-day cache (creator_enrichment_cache) so Profile View →
// Outreach on the same creator never enriches twice upstream, across
// deploys/restarts. data = { detail, email }; email never reaches clients.
const ENRICH_CACHE_DAYS = 30

async function readDbEnrichCache(
  platform: ClubPlatform,
  handle: string
): Promise<{ detail: any; email: string | null } | null> {
  const { prisma } = await import('@/lib/prisma')
  const row = await prisma.creatorEnrichmentCache
    .findUnique({ where: { platform_handle: { platform, handle: handle.toLowerCase() } } })
    .catch(() => null)
  if (!row) return null
  const ageMs = Date.now() - row.fetchedAt.getTime()
  if (ageMs > ENRICH_CACHE_DAYS * 24 * 60 * 60 * 1000) return null
  return row.data as { detail: any; email: string | null }
}

async function writeDbEnrichCache(
  platform: ClubPlatform,
  handle: string,
  detail: any,
  email: string | null
): Promise<void> {
  const { prisma } = await import('@/lib/prisma')
  await prisma.creatorEnrichmentCache
    .upsert({
      where: { platform_handle: { platform, handle: handle.toLowerCase() } },
      create: { platform, handle: handle.toLowerCase(), data: { detail, email } },
      update: { data: { detail, email }, fetchedAt: new Date() },
    })
    .catch((e) => console.error('enrich cache write failed:', e))
}

export async function getCreatorContactEmail(
  platform: ClubPlatform,
  handle: string
): Promise<string | null | undefined> {
  const cacheKey = `${platform}:${handle.toLowerCase()}`
  const inMemory = contactEmailCache.get(cacheKey)
  if (inMemory !== undefined) return inMemory
  const db = await readDbEnrichCache(platform, handle)
  if (db) {
    contactEmailCache.set(cacheKey, db.email)
    return db.email
  }
  return undefined
}

function redact(text: unknown): string | null {
  return typeof text === 'string' ? text.replace(EMAIL_RE, '•••') : null
}

export async function clubEnrich(platform: ClubPlatform, handle: string) {
  const cacheKey = `${platform}:${handle.toLowerCase()}`
  const cached = enrichCache.get(cacheKey)
  if (cached) return cached

  // Persistent cache (30 days) before any upstream (billed) call.
  const dbCached = await readDbEnrichCache(platform, handle)
  if (dbCached) {
    enrichCache.set(cacheKey, dbCached.detail)
    contactEmailCache.set(cacheKey, dbCached.email)
    return dbCached.detail
  }

  const res = await fetch(`${BASE}/public/v1/creators/enrich/handle/full/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      handle,
      platform,
      include_lookalikes: false,
      include_audience_data: false,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail =
      data?.detail || data?.message || `Influencers Club enrichment failed (${res.status})`
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  const r = data?.result
  if (!r) throw new Error('No data available for this creator')

  // Stash the email for the server-side outreach route; it is NOT included
  // in the detail object returned to the client.
  contactEmailCache.set(
    cacheKey,
    typeof r.email === 'string' && r.email.includes('@') ? r.email : null
  )

  // Cross-platform presence with follower counts
  const accounts = ENRICH_PLATFORM_KEYS.flatMap((key) => {
    const p = r[key]
    if (!p || typeof p !== 'object') return []
    const followers = p.follower_count ?? p.subscriber_count ?? null
    const username = p.username ?? p.custom_url ?? p.title ?? null
    if (followers == null && !username) return []
    return [
      {
        platform: key,
        username,
        followers,
        engagement_percent: p.engagement_percent ?? null,
      },
    ]
  })
  const totalFollowers = accounts.reduce((sum, a) => sum + (a.followers || 0), 0)

  const main = r[platform] || {}
  const detail = {
    platform,
    handle,
    name: main.full_name || main.title || r.first_name || handle,
    avatar_url: main.profile_picture ?? null,
    bio: redact(main.biography ?? main.description),
    location: r.location ?? null,
    language: r.speaking_language ?? null,
    gender: r.gender ?? null,
    is_business: r.is_business ?? null,
    has_brand_deals: r.has_brand_deals ?? null,
    niche: [main.niche_class, main.niche_sub_class]
      .flat()
      .filter((x: any) => typeof x === 'string'),
    hashtags: (main.hashtags || main.video_hashtags || []).slice(0, 8),
    followers: main.follower_count ?? main.subscriber_count ?? null,
    engagement_percent: main.engagement_percent ?? null,
    posting_frequency_recent_months: main.posting_frequency_recent_months ?? null,
    avg_views: main.avg_views ?? null,
    avg_likes: main.avg_likes ?? null,
    // Shape varies by platform (number or object of period -> pct); the
    // client renders whatever is present.
    follower_growth: main.creator_follower_growth ?? null,
    income: main.income ?? null,
    total_followers: totalFollowers,
    accounts,
    // Whether outreach can be delivered (email exists server-side); the
    // address itself never leaves the server.
    contactable: contactEmailCache.get(cacheKey) != null,
  }

  enrichCache.set(cacheKey, detail)
  await writeDbEnrichCache(platform, handle, detail, contactEmailCache.get(cacheKey) ?? null)
  return detail
}
