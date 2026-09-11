// TEMP: influencers.club discovery source (docs.influencers.club).
// Remove together with app/api/discovery/club-search/ and the
// "Data source" picker block in components/discovery/DiscoverPanel.tsx.
//
// Credits: 0.01 per creator returned by /public/v1/discovery/ (0 if no
// results). Dictionary endpoints are free. Keep page sizes small.

const BASE = 'https://api-dashboard.influencers.club'

// Successful Club requests are cached indefinitely in PostgreSQL. This is
// intentional: identical requests should never spend vendor credits twice.

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

// The club location dictionary uses plain English country names (verified
// against the classifier endpoint), so for the codes offered in the UI we
// can skip the resolver round-trip entirely.
const TRUSTED_LOCATION_CODES = new Set([
  'US', 'UK', 'CA', 'AU', 'CN', 'JP', 'KR', 'SG', 'DE', 'FR',
  'NL', 'SE', 'BR', 'MX', 'IN', 'AE', 'NZ', 'IT', 'ES',
])

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

  if (TRUSTED_LOCATION_CODES.has(iso) && name !== iso) {
    locationCache.set(cacheKey, name)
    return name
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
  // Engagement rate bounds in percent (filters.engagement_percent)
  minEngagement?: number
  maxEngagement?: number
  // Creator gender. The club docs don't publish an enum; 'MALE'/'FEMALE'
  // follows the convention of the underlying data provider.
  gender?: 'MALE' | 'FEMALE'
  // Language abbreviation as used by the club languages classifier (e.g. 'en')
  language?: string
  // keywords_in_bio (IG/TikTok) or keywords_in_description (YouTube)
  bioKeywords?: string[]
  // Days since last post: 90 or 365 (last_post; YouTube:
  // last_upload_long_video). Omit for "any".
  lastPost?: 90 | 365
  // Audience age filter — Instagram only, creators with 10k+ followers
  audienceAgeRange?: '13-17' | '18-24' | '25-34' | '35-44' | '45-64' | '65-'
  audienceAgeMinPct?: number
  // Only creators who also have accounts on these platforms
  // (filters.creator_has: has_instagram / has_youtube / has_tiktok)
  requirePlatforms?: ClubPlatform[]
  limit: number
  page?: number
}

function cachedSearchResult(data: any, extraWarnings: string[] = []) {
  const results = Array.isArray(data?.results) ? data.results : []
  const storedWarnings = Array.isArray(data?.warnings) ? data.warnings : []
  return {
    ...data,
    results,
    warnings: Array.from(new Set([...storedWarnings, ...extraWarnings])),
    cache_hits: results.length,
    live_calls: 0,
    cached: true,
  }
}

export async function clubSearch(opts: ClubSearchOptions) {
  const query = opts.query?.trim().slice(0, 150) || null
  const country = opts.country?.trim().toUpperCase() || null
  const bioKeywords = (opts.bioKeywords ?? [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10)
    .sort()
  // New filter keys are only added to the cache-key object when set, so
  // pre-existing cache rows for filterless requests keep hitting.
  const request: Record<string, any> = {
    platform: opts.platform,
    query,
    country,
    min_followers: opts.minFollowers ?? null,
    max_followers: opts.maxFollowers ?? null,
    limit: opts.limit,
    page: opts.page ?? 0,
  }
  if (opts.minEngagement != null) request.min_engagement = opts.minEngagement
  if (opts.maxEngagement != null) request.max_engagement = opts.maxEngagement
  if (opts.gender) request.gender = opts.gender
  if (opts.language) request.language = opts.language
  if (bioKeywords.length) request.bio_keywords = bioKeywords
  if (opts.lastPost) request.last_post = opts.lastPost
  if (opts.platform === 'instagram' && opts.audienceAgeRange) {
    request.audience_age = opts.audienceAgeRange
    if (opts.audienceAgeMinPct != null) request.audience_age_min_pct = opts.audienceAgeMinPct
  }
  const requirePlatforms = (opts.requirePlatforms ?? [])
    .filter((p) => p !== opts.platform)
    .sort()
  if (requirePlatforms.length) request.require_platforms = requirePlatforms
  const { createHash } = await import('crypto')
  const hash = (value: unknown) =>
    createHash('sha1').update(JSON.stringify(value)).digest('hex')
  const cacheKey = hash(request)

  // Look up the request before resolving locations or contacting Club. A hit
  // therefore makes zero Influencers Club API calls, including dictionary
  // calls, and works even when the provider is temporarily unavailable.
  try {
    const { prisma } = await import('@/lib/prisma')
    const hit = await prisma.clubSearchCache.findUnique({ where: { key: cacheKey } })
    if (hit) return cachedSearchResult(hit.data)
  } catch {
    // Cache is best-effort; a database issue may still fall through to live.
  }

  if (!clubConfigured()) {
    throw new Error('Influencers Club API not configured')
  }

  const warnings: string[] = []
  const filters: Record<string, any> = {}

  if (query) filters.ai_search = query

  if (opts.minFollowers != null || opts.maxFollowers != null) {
    const key =
      opts.platform === 'youtube' ? 'number_of_subscribers' : 'number_of_followers'
    filters[key] = {
      ...(opts.minFollowers != null ? { min: opts.minFollowers } : {}),
      ...(opts.maxFollowers != null ? { max: opts.maxFollowers } : {}),
    }
  }

  if (opts.minEngagement != null || opts.maxEngagement != null) {
    filters.engagement_percent = {
      ...(opts.minEngagement != null ? { min: opts.minEngagement } : {}),
      ...(opts.maxEngagement != null ? { max: opts.maxEngagement } : {}),
    }
  }

  if (opts.gender) filters.gender = opts.gender

  if (opts.language) filters.profile_language = [opts.language]

  if (bioKeywords.length) {
    // YouTube profiles have a channel description instead of a bio
    const key = opts.platform === 'youtube' ? 'keywords_in_description' : 'keywords_in_bio'
    filters[key] = bioKeywords
  }

  if (opts.lastPost) {
    const key = opts.platform === 'youtube' ? 'last_upload_long_video' : 'last_post'
    filters[key] = opts.lastPost
  }

  // Audience demographics are Instagram-only (10k+ follower creators)
  if (opts.platform === 'instagram' && opts.audienceAgeRange) {
    filters.audience = {
      age: [
        {
          range: opts.audienceAgeRange,
          ...(opts.audienceAgeMinPct != null ? { min_pct: opts.audienceAgeMinPct } : {}),
        },
      ],
    }
  }

  if (requirePlatforms.length) {
    filters.creator_has = Object.fromEntries(requirePlatforms.map((p) => [`has_${p}`, true]))
  }

  if (country) {
    const location = await resolveLocation(opts.platform, country)
    if (location) {
      filters.location = [location]
    } else {
      warnings.push(
        `Country "${country}" not recognized by Influencers Club — location filter skipped.`
      )
    }
  }

  const body = {
    platform: opts.platform,
    paging: { limit: opts.limit, page: opts.page ?? 0 },
    sort: {
      sort_by: query ? 'relevancy' : 'number_of_followers',
      sort_order: 'desc',
    },
    filters,
  }

  // Compatibility with cache rows written before request-shaped keys were
  // introduced. Promote an old body-hash hit to the new permanent key.
  const legacyCacheKey = hash(body)
  if (legacyCacheKey !== cacheKey) {
    try {
      const { prisma } = await import('@/lib/prisma')
      const hit = await prisma.clubSearchCache.findUnique({ where: { key: legacyCacheKey } })
      if (hit) {
        const cachedData = hit.data as any
        await prisma.clubSearchCache.upsert({
          where: { key: cacheKey },
          create: { key: cacheKey, request, data: cachedData, fetchedAt: hit.fetchedAt },
          update: { request, data: cachedData },
        })
        return cachedSearchResult(cachedData, warnings)
      }
    } catch {
      // Cache is best-effort; fall through to the live request.
    }
  }

  // The vendor occasionally has slow spells; one retry on timeout avoids
  // needlessly falling back to the local index (normal responses are ~5s).
  const doFetch = () =>
    fetch(`${BASE}/public/v1/discovery/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
  let res: Response
  try {
    res = await doFetch()
  } catch (err: any) {
    if (err?.name !== 'TimeoutError' && err?.name !== 'AbortError') throw err
    res = await doFetch()
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail =
      data?.detail || data?.message || `Influencers Club search failed (${res.status})`
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }

  // Same shape as the KOL proxy so DiscoverPanel renders results unchanged.
  const accounts = Array.isArray(data?.accounts) ? data.accounts : []
  const results = accounts.map((a: any) => ({
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

  const shaped = {
    results,
    total: data?.total ?? results.length,
    credits_left: data?.credits_left ?? null,
    platform_coverage: {},
    warnings,
    cache_hits: 0,
    live_calls: 1,
    cached: false,
  }

  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.clubSearchCache.upsert({
      where: { key: cacheKey },
      create: { key: cacheKey, request, data: shaped },
      update: { request, data: shaped, fetchedAt: new Date() },
    })
  } catch (error) {
    // Persistence is best-effort: a cache write must never hide valid live
    // results from the user, but log failures so production can alert on them.
    console.error('club search persistence failed:', error)
  }

  return shaped
}

// ---------------------------------------------------------------------------
// Default discovery showcase: the top 10 Instagram creators (by followers)
// who also have YouTube + TikTok accounts. Fetched from the club API exactly
// once (~0.1 vendor credits), then served forever from clubSearchCache under
// a dedicated key. Club avatar URLs expire after ~24h, so images are
// re-hosted through lib/upload before the row is persisted.
// ---------------------------------------------------------------------------

const SHOWCASE_CACHE_KEY = 'showcase:instagram:v1'

async function rehostAvatar(url: string | null): Promise<string | null> {
  if (!url || url.startsWith('/')) return url // already local/proxied
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) return null
    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg'
    const { uploadFile } = await import('@/lib/upload')
    return await uploadFile(buffer, `avatar${ext}`, contentType, 'discovery-avatars/')
  } catch {
    return null
  }
}

export async function clubShowcase() {
  try {
    const { prisma } = await import('@/lib/prisma')
    const hit = await prisma.clubSearchCache.findUnique({ where: { key: SHOWCASE_CACHE_KEY } })
    if (hit) return cachedSearchResult(hit.data)
  } catch {
    // fall through to a fresh build
  }

  const shaped = await clubSearch({
    platform: 'instagram',
    requirePlatforms: ['youtube', 'tiktok'],
    limit: 10,
    page: 0,
  })

  const results = await Promise.all(
    (shaped.results as any[]).map(async (r) => ({
      ...r,
      avatar_url: await rehostAvatar(r.avatar_url),
    }))
  )
  const data = { ...shaped, results, cached: false }

  // Persist only complete fetches: a transient empty/partial club response
  // must not become the permanent default page.
  if (results.length > 0) {
    try {
      const { prisma } = await import('@/lib/prisma')
      await prisma.clubSearchCache.upsert({
        where: { key: SHOWCASE_CACHE_KEY },
        create: { key: SHOWCASE_CACHE_KEY, request: { showcase: 'instagram' }, data },
        update: { request: { showcase: 'instagram' }, data, fetchedAt: new Date() },
      })
    } catch (error) {
      console.error('showcase persistence failed:', error)
    }
  }

  return data
}

// ---------------------------------------------------------------------------
// Remaining credit balance. The club API has no dedicated balance endpoint,
// but every discovery response includes credits_left and a search returning
// zero results costs 0 — so we probe with an impossible follower range.
// Cached for 5 minutes to keep the admin page snappy.
// ---------------------------------------------------------------------------

let creditsCache: { at: number; value: ClubCredits | null } | null = null
const CREDITS_CACHE_TTL_MS = 5 * 60 * 1000

export interface ClubCredits {
  creditsLeft: number
  trialSearchesLeft: number | null
}

export async function clubCreditsLeft(): Promise<ClubCredits | null> {
  if (!clubConfigured()) return null
  if (creditsCache && Date.now() - creditsCache.at < CREDITS_CACHE_TTL_MS) {
    return creditsCache.value
  }
  let value: ClubCredits | null = null
  try {
    const res = await fetch(new URL('/public/v1/discovery/', BASE), {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        platform: 'instagram',
        paging: { limit: 1, page: 0 },
        // 99,999,998–99,999,999 followers: guaranteed empty, costs 0 credits
        filters: { number_of_followers: { min: 99999998, max: 99999999 } },
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && typeof data?.credits_left === 'number') {
      value = {
        creditsLeft: data.credits_left,
        trialSearchesLeft: data.trial_searches_left ?? null,
      }
    }
  } catch {
    value = null
  }
  creditsCache = { at: Date.now(), value }
  return value
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

// Permanent request cache (creator_enrichment_cache) shared by profiles,
// analytics and outreach across deploys/restarts. data = { detail, email };
// email never reaches clients.

async function readDbEnrichCache(
  platform: ClubPlatform,
  handle: string
): Promise<{ detail: any; email: string | null } | null> {
  const { prisma } = await import('@/lib/prisma')
  const row = await prisma.creatorEnrichmentCache
    .findUnique({ where: { platform_handle: { platform, handle: handle.toLowerCase() } } })
    .catch(() => null)
  if (!row) return null
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

  // Permanent cache before any upstream (billed) call.
  const dbCached = await readDbEnrichCache(platform, handle)
  if (dbCached) {
    enrichCache.set(cacheKey, dbCached.detail)
    contactEmailCache.set(cacheKey, dbCached.email)
    return dbCached.detail
  }

  if (!clubConfigured()) {
    throw new Error('Influencers Club API not configured')
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

// ---------------------------------------------------------------------------
// Full analytics (audience demographics) — same 1-credit enrich call but with
// include_audience_data: true. Cached under a "#analytics" pseudo-handle in
// the same permanent table so repeat views never re-bill upstream.
// Notable-user and lookalike lists are dropped: large, and they leak other
// creators' identities to brands for free.
// ---------------------------------------------------------------------------

const ANALYTICS_CACHE_SUFFIX = '#analytics'

function parseAudienceSection(section: any) {
  const data = section?.audience_followers?.data
  if (!data || typeof data !== 'object') return null
  const pick = (list: any, n: number) =>
    Array.isArray(list) ? list.slice(0, n) : []
  return {
    genders: pick(data.audience_genders, 4),
    ages: pick(data.audience_ages, 8),
    genders_per_age: pick(data.audience_genders_per_age, 8),
    languages: pick(data.audience_languages, 6),
    countries: pick(data.audience_geo?.countries, 6),
    notable_users_ratio: data.notable_users_ratio ?? null,
  }
}

export async function clubAnalytics(platform: ClubPlatform, handle: string) {
  const cacheHandle = `${handle.toLowerCase()}${ANALYTICS_CACHE_SUFFIX}`
  const cacheKey = `${platform}:${cacheHandle}`
  const inMemory = enrichCache.get(cacheKey)
  if (inMemory) return inMemory

  const dbCached = await readDbEnrichCache(platform, cacheHandle)
  if (dbCached) {
    enrichCache.set(cacheKey, dbCached.detail)
    return dbCached.detail
  }

  if (!clubConfigured()) {
    throw new Error('Influencers Club API not configured')
  }

  const res = await fetch(`${BASE}/public/v1/creators/enrich/handle/full/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      handle,
      platform,
      include_lookalikes: false,
      include_audience_data: true,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(90000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail =
      data?.detail || data?.message || `Influencers Club analytics failed (${res.status})`
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  const r = data?.result
  if (!r) throw new Error('No analytics available for this creator')

  const main = r[platform] || {}
  const analytics = {
    platform,
    handle,
    audience: parseAudienceSection(main.audience),
    avg_views: main.avg_views ?? null,
    avg_likes: main.avg_likes ?? null,
    avg_comments: main.avg_comments ?? null,
    has_brand_deals: r.has_brand_deals ?? null,
    income: main.income ?? null,
    follower_growth: main.creator_follower_growth ?? null,
    posting_frequency_recent_months: main.posting_frequency_recent_months ?? null,
  }

  enrichCache.set(cacheKey, analytics)
  await writeDbEnrichCache(platform, cacheHandle, analytics, null)
  return analytics
}
