// CreatorDB discovery source (docs.creatordb.app/api-v3).
// Alternative to Influencers Club — toggle via DISCOVERY_PROVIDER env var.
// Search results are normalized to the same shape as lib/influencers-club.ts
// so the rest of the app (DiscoverPanel, club-search route) works unchanged.

import { createHash } from 'node:crypto'
import { creatorDbFetch } from '@/lib/creatordb-usage'
import type { ClubSearchOptions } from '@/lib/influencers-club'
import { buildCustomSearchRequest, buildSearchRequest } from '@/lib/creatordb-search-request'
import type { CreatorDbPlatform } from '@/lib/creatordb-filter-fields'

const BASE = 'https://apiv3.creatordb.app'

export class CreatorDbApiError extends Error {
  constructor(
    message: string,
    readonly errorCode: string | null,
    readonly traceId: string | null,
    readonly httpStatus: number,
  ) {
    super(message)
    this.name = 'CreatorDbApiError'
  }
}

export function creatordbConfigured(): boolean {
  return Boolean(process.env.CREATORDB_API_KEY)
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'api-key': process.env.CREATORDB_API_KEY!,
  }
}

// ISO 3166-1 alpha-2 → alpha-3 mapping for the most common countries.
// CreatorDB uses alpha-3; our app uses alpha-2 everywhere else.
const COUNTRY_A2_TO_A3: Record<string, string> = {
  US: 'USA', UK: 'GBR', GB: 'GBR', CA: 'CAN', AU: 'AUS', CN: 'CHN',
  JP: 'JPN', KR: 'KOR', SG: 'SGP', DE: 'DEU', FR: 'FRA', NL: 'NLD',
  SE: 'SWE', BR: 'BRA', MX: 'MEX', IN: 'IND', AE: 'ARE', NZ: 'NZL',
  IT: 'ITA', ES: 'ESP', TW: 'TWN', TH: 'THA', PH: 'PHL', ID: 'IDN',
  MY: 'MYS', VN: 'VNM', RU: 'RUS', TR: 'TUR', PL: 'POL', AR: 'ARG',
  CL: 'CHL', CO: 'COL', PE: 'PER', ZA: 'ZAF', EG: 'EGY', SA: 'SAU',
  IL: 'ISR', HK: 'HKG', IE: 'IRL', AT: 'AUT', CH: 'CHE', BE: 'BEL',
  DK: 'DNK', FI: 'FIN', NO: 'NOR', PT: 'PRT',
}

// ISO 639-1 → ISO 639-3 mapping for common languages.
const LANG_2_TO_3: Record<string, string> = {
  en: 'eng', zh: 'zho', es: 'spa', pt: 'por', fr: 'fra', de: 'deu',
  it: 'ita', nl: 'nld', sv: 'swe', ja: 'jpn', ko: 'kor', ar: 'ara',
  hi: 'hin', ru: 'rus', tr: 'tur', pl: 'pol', th: 'tha', vi: 'vie',
  id: 'ind', ms: 'msa',
}

const PROFILE_URL: Record<string, (handle: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
}

// Map our platform names to CreatorDB endpoint paths
// CreatorDB only supports instagram, youtube, tiktok for search
const PLATFORM_PATH: Record<string, string> = {
  instagram: 'instagram',
  youtube: 'youtube',
  tiktok: 'tiktok',
}

// Follower field name per platform
const FOLLOWER_FIELD: Record<string, string> = {
  instagram: 'totalFollowers',
  youtube: 'totalSubscribers',
  tiktok: 'totalFollowers',
}

// Engagement rate field per platform
const ENGAGEMENT_FIELD: Record<string, string> = {
  instagram: 'avgRecentContentsEngagementRate',
  youtube: 'avgRecentContentsEngagementRate',
  tiktok: 'avgRecentVideosEngagementRate',
}

const PROFILE_FIELDS: Record<string, string[]> = {
  instagram: [
    'displayName', 'category', 'avatarUrl', 'bio', 'isBusinessAccount', 'isPrivateAccount',
    'isVerified', 'hasSponsors', 'country', 'mainLanguage', 'totalContents', 'totalFollowers',
    'totalFollowing', 'subscriberGrowth', 'hashtags', 'niches', 'otherLinks', 'lastPublishTime',
    'lastDbUpdateTime',
  ],
  tiktok: [
    'displayName', 'category', 'avatarUrl', 'bio', 'isBusinessAccount', 'isPrivateAccount',
    'isVerified', 'hasSponsors', 'country', 'mainLanguage', 'totalContents', 'totalFollowers',
    'totalFollowing', 'subscriberGrowth', 'hashtags', 'niches', 'otherLinks', 'lastPublishTime',
    'lastDbUpdateTime',
  ],
  youtube: [
    'displayName', 'categoryBreakdown', 'avatarUrl', 'bio', 'isVerified', 'hasSponsors',
    'country', 'mainLanguage', 'totalContents', 'totalSubscribers', 'subscriberGrowth',
    'hashtags', 'niches', 'otherLinks', 'lastPublishTime', 'lastDbUpdateTime',
  ],
}

const PERFORMANCE_FIELDS: Record<string, string[]> = {
  instagram: ['contentCountByDays', 'ranking', 'imagesPerformanceRecent', 'reelsPerformanceRecent'],
  tiktok: ['contentCountByDays', 'ranking', 'videosPerformanceRecent'],
  youtube: ['contentCountByDays', 'ranking', 'videosPerformanceRecent', 'shortsPerformanceRecent'],
}

const AUDIENCE_FIELDS = [
  'audienceLocations',
  'audienceGender',
  'audienceAvgAge',
  'audienceAgeBreakdown',
]

interface CdbFilter {
  filterName: string
  op: string
  value: string | number | boolean | string[]
}

function buildFilters(opts: ClubSearchOptions): CdbFilter[] {
  const filters: CdbFilter[] = []
  const platform = opts.platform

  // Country
  if (opts.country) {
    const a3 = COUNTRY_A2_TO_A3[opts.country.toUpperCase()] || opts.country.toUpperCase()
    filters.push({ filterName: 'country', op: '=', value: a3 })
  }

  // Language
  if (opts.language) {
    const l3 = LANG_2_TO_3[opts.language.toLowerCase()] || opts.language
    filters.push({ filterName: 'mainLanguage', op: '=', value: l3 })
  }

  // Followers
  const followerField = FOLLOWER_FIELD[platform] || 'totalFollowers'
  if (opts.minFollowers != null) {
    filters.push({ filterName: followerField, op: '>', value: opts.minFollowers })
  }
  if (opts.maxFollowers != null) {
    filters.push({ filterName: followerField, op: '<', value: opts.maxFollowers })
  }

  // Engagement rate (CreatorDB stores as decimal 0-1, our app uses percent)
  const engField = ENGAGEMENT_FIELD[platform] || 'avgRecentContentsEngagementRate'
  if (opts.minEngagement != null) {
    filters.push({ filterName: engField, op: '>', value: opts.minEngagement / 100 })
  }
  if (opts.maxEngagement != null) {
    filters.push({ filterName: engField, op: '<', value: opts.maxEngagement / 100 })
  }

  // Gender
  if (opts.gender) {
    filters.push({
      filterName: 'mainAudienceGender',
      op: '=',
      value: opts.gender.toLowerCase(),
    })
  }

  // CreatorDB's `niches` filter accepts taxonomy IDs, not free text. The
  // Overseed search box contains free text, so use the documented hashtags
  // filter instead. Merge bio keywords to avoid duplicate filter fields.
  const hashtagTerms = [opts.query, ...(opts.bioKeywords ?? [])]
    .flatMap((value) => value?.split(/[\s,]+/) ?? [])
    .map((value) => value.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean)
  if (hashtagTerms.length) {
    filters.push({
      filterName: 'hashtags',
      op: 'in',
      value: [...new Set(hashtagTerms)].slice(0, 100),
    })
  }

  // Verified
  if (opts.advanced?.is_verified === true) {
    filters.push({ filterName: platform === 'youtube' ? 'isAccountVerified' : 'isAccountVerified', op: '=', value: true })
  }

  // Audience location
  if (opts.audience?.locationName) {
    const a3 = COUNTRY_A2_TO_A3[opts.audience.locationName.toUpperCase()] || opts.audience.locationName.toUpperCase()
    filters.push({ filterName: 'mainAudienceLocation', op: '=', value: a3 })
  }

  if (opts.audienceAgeRange?.length) {
    const ages = opts.audienceAgeRange.map((age) => age === '45-64' ? '45-54' : age === '65-' ? '65+' : age)
    filters.push({ filterName: 'mainAudienceAge', op: 'in', value: [...new Set(ages)] })
  }

  if (opts.lastPost) {
    filters.push({
      filterName: 'lastPublishTime',
      op: '>',
      value: Date.now() - opts.lastPost * 24 * 60 * 60 * 1000,
    })
  }

  // If no filters at all, add a minimum follower filter to avoid empty searches
  if (filters.length === 0) {
    filters.push({ filterName: followerField, op: '>', value: 1000 })
  }

  // Never silently drop user intent: the 10-filter cap is also the one-credit
  // budget boundary for this feature.
  if (filters.length > 10) {
    throw new Error(`CreatorDB searches are limited to 10 filters (received ${filters.length})`)
  }
  return filters
}

// Map CreatorDB sort options to their field names
function mapSortBy(sortBy: string | undefined, platform: string): string {
  const followerField = FOLLOWER_FIELD[platform] || 'totalFollowers'
  switch (sortBy) {
    case 'relevancy': return 'platformScore'
    case 'engagement_rate': return ENGAGEMENT_FIELD[platform] || 'avgRecentContentsEngagementRate'
    case 'number_of_followers': return followerField
    case 'growth_rate': return platform === 'youtube' ? 'subscriberGrowthIn30d' : 'followerGrowthIn30d'
    default: return followerField
  }
}

const RETRY_DELAYS_MS = [250, 750]

// Builds the request body sent to CreatorDB for a given set of search options.
// Extracted so both creatordbSearch and creatordbSearchCacheProbe can hash
// the exact same payload without duplicating logic.
function buildCreatorDbRequestBody(opts: ClubSearchOptions): { body: object; platformPath: string; nicheResolution?: import('@/lib/creatordb-niches').NicheResolveResult } | null {
  const platformPath = PLATFORM_PATH[opts.platform]
  if (!platformPath) return null

  const customRequest = opts.creatorDbFilters
    ? buildCustomSearchRequest(
        opts.platform as CreatorDbPlatform,
        opts.creatorDbFilters,
        {
          pageSize: Math.min(opts.limit || 100, 100),
          offset: opts.creatorDbOffset ?? (opts.page ?? 0) * Math.min(opts.limit || 100, 100),
        },
        opts.creatorDbSortField,
        opts.sortOrder !== 'asc',
      )
    : null
  const presetRequest = !customRequest && opts.creatorDbPreset
    ? buildSearchRequest(
        opts.platform as CreatorDbPlatform,
        opts.creatorDbPreset,
        opts.creatorDbOverrides,
        {
          pageSize: Math.min(opts.limit || 100, 100),
          offset: opts.creatorDbOffset ?? (opts.page ?? 0) * Math.min(opts.limit || 100, 100),
        },
      )
    : null
  // When custom/preset filters exist, also merge in basic filters (country,
  // followers, engagement) that the UI sends as standard query params rather
  // than as cdb_filters. Deduplicate by filterName so user-set cdb_filters
  // take precedence over the auto-generated ones.
  const baseFilters = customRequest?.filters ?? presetRequest?.filters ?? buildFilters(opts)
  let filters: typeof baseFilters
  if (customRequest || presetRequest) {
    const basicFilters = buildFilters(opts)
    const existingNames = new Set(baseFilters.map((f: { filterName: string }) => f.filterName))
    const missing = basicFilters.filter((f) => !existingNames.has(f.filterName))
    filters = [...baseFilters, ...missing]
    if (filters.length > 10) {
      // Trim to 10 — keep the explicit cdb_filters, drop overflow basic ones
      filters = [...baseFilters, ...missing.slice(0, 10 - baseFilters.length)]
    }
  } else {
    filters = baseFilters
  }
  const pageSize = customRequest?.pageSize ?? presetRequest?.pageSize ?? Math.min(opts.limit || 10, 100)
  const offset = customRequest?.offset ?? presetRequest?.offset ?? (opts.page ?? 0) * pageSize
  const nicheResolution = customRequest?.nicheResolution ?? presetRequest?.nicheResolution
  const body = customRequest
    ? { ...customRequest, filters, nicheResolution: undefined }
    : presetRequest
      ? { ...presetRequest, filters, nicheResolution: undefined }
      : { filters, pageSize, offset, sortBy: mapSortBy(opts.sortBy, opts.platform), desc: opts.sortOrder !== 'asc' }
  // Strip nicheResolution from the body sent to the API — it's metadata only
  delete (body as any).nicheResolution
  return { body, platformPath, nicheResolution }
}

function cdbCacheKey(body: object): string {
  return 'cdb:' + createHash('sha1').update(JSON.stringify(body)).digest('hex')
}

async function searchFetch(url: string, init: RequestInit, userId?: string): Promise<Response> {
  let attempt = 0
  while (true) {
    try {
      const response = await creatorDbFetch(url, {
        ...init,
        signal: AbortSignal.timeout(30000),
      }, { userId })
      if (response.status < 500 || attempt >= RETRY_DELAYS_MS.length) return response
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
    attempt += 1
  }
}

// Main search function — returns the same shape as clubSearch()
export async function creatordbSearch(opts: ClubSearchOptions) {
  if (!PLATFORM_PATH[opts.platform]) {
    const warnings: string[] = [`CreatorDB does not support ${opts.platform} search — skipped.`]
    return {
      results: [],
      total: 0,
      credits_left: null,
      platform_coverage: {},
      warnings,
      cache_hits: 0,
      live_calls: 0,
      cached: false,
    }
  }
  if (!creatordbConfigured()) {
    throw new Error('CreatorDB API not configured')
  }

  const built = buildCreatorDbRequestBody(opts)
  if (!built) {
    throw new Error(`CreatorDB does not support platform: ${opts.platform}`)
  }
  const { body, platformPath, nicheResolution } = built
  const warnings: string[] = []

  // Surface translation, fuzzy-match, or unmatched niche feedback as warnings
  if (nicheResolution) {
    for (const m of nicheResolution.matched) {
      if (m.translatedFrom) {
        warnings.push(`Niche "${m.translatedFrom}" translated to "${m.term}"`)
      }
    }
    for (const fm of nicheResolution.fuzzyMatched) {
      const prefix = fm.translatedFrom ? `"${fm.translatedFrom}" → ` : ''
      warnings.push(`Niche ${prefix}"${fm.term}" matched as "${fm.matchedName}" (${fm.score}% similarity)`)
    }
    for (const um of nicheResolution.unmatched) {
      const suggestions = um.suggestions.length > 0
        ? ` Did you mean: ${um.suggestions.join(', ')}?`
        : ''
      warnings.push(`Niche "${um.term}" not found.${suggestions}`)
    }
  }

  // Check cache before making API call
  try {
    const { prisma } = await import('@/lib/prisma')
    const cacheKey = cdbCacheKey(body)
    const hit = await prisma.clubSearchCache.findUnique({ where: { key: cacheKey } })
    if (hit) {
      return { ...(hit.data as object), cached: true }
    }
  } catch {
    // Cache miss or DB error — proceed with live call
  }

  const filters = Array.isArray((body as any).filters) ? (body as any).filters : []
  if (filters.length > 10) {
    throw new Error(`CreatorDB searches are limited to 10 filters (received ${filters.length})`)
  }

  const res = await searchFetch(`${BASE}/${platformPath}/search`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store',
  }, opts?.logUserId)

  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) {
    console.error('[CreatorDB] Search failed', {
      status: res.status,
      url: `${BASE}/${platformPath}/search`,
      requestBody: JSON.stringify(body),
      response: JSON.stringify(data),
    })
    const detail = data?.errorDescription || data?.message || data?.error || `CreatorDB search failed (${res.status})`
    throw new CreatorDbApiError(
      typeof detail === 'string' ? detail : JSON.stringify(detail),
      typeof data?.errorCode === 'string' && data.errorCode ? data.errorCode : null,
      typeof data?.traceId === 'string' ? data.traceId : null,
      res.status,
    )
  }

  const creatorList = Array.isArray(data?.data?.creatorList) ? data.data.creatorList : []
  const followerField = FOLLOWER_FIELD[opts.platform] || 'totalFollowers'
  const bodyAny = body as any
  const sortMetricField = bodyAny.sortBy
  const bodyOffset: number = bodyAny.offset ?? 0

  const results = creatorList.map((c: any, index: number) => {
    const channelId = String(c.channelId || '').trim()
    const uniqueId = String(c.uniqueId || '').trim()
    const handle = (uniqueId || channelId).replace(/^@/, '')
    // CreatorDB sometimes returns search rows without either identifier.
    // Never emit the shared `cdb:<platform>:` id: duplicate React keys can
    // make a card from the preceding search survive reconciliation.
    const resultIdentity = channelId || uniqueId || `result-${bodyOffset + index}`
    const profile = c.profile || {}
    const perf = c.performance || {}
    const engRate = perf.avgRecentContentsEngagementRate
      ?? perf.avgRecentVideosEngagementRate
      ?? perf.avgRecentImagesEngagementRate
      ?? null

    const nicheTags = [
      ...(Array.isArray(profile.niches) ? profile.niches : []),
      ...(profile.category ? [profile.category] : []),
      ...(Array.isArray(profile.categoryBreakdown)
        ? profile.categoryBreakdown.map((entry: any) => entry.category)
        : []),
    ].filter(Boolean)

    return {
      id: `cdb:${opts.platform}:${resultIdentity}`,
      platform: opts.platform,
      uniqueId: uniqueId || channelId || null,
      displayName: c.displayName || handle || null,
      avatarUrl: c.avatarUrl ?? null,
      followers: c[followerField] ?? c.totalFollowers ?? c.totalSubscribers ?? null,
      sortMetric: c[sortMetricField] ?? perf[sortMetricField] ?? null,
      handle: handle || null,
      display_name: c.displayName || handle || null,
      bio: profile.bio ?? null,
      country: profile.country
        ? (COUNTRY_A3_TO_A2[profile.country] || profile.country)
        : (opts.country ? opts.country.toUpperCase() : null),
      language: profile.mainLanguage
        ? (LANG_3_TO_2[profile.mainLanguage] || profile.mainLanguage)
        : (opts.language ?? null),
      follower_count: c[followerField] ?? c.totalFollowers ?? c.totalSubscribers ?? null,
      engagement_rate: engRate != null ? Number(engRate) * 100 : null, // Convert decimal → percent
      niche_tags: [...new Set(nicheTags)].slice(0, 8),
      profile_url: handle && PROFILE_URL[opts.platform]
        ? PROFILE_URL[opts.platform](handle)
        : null,
      avatar_url: c.avatarUrl ?? null,
      score: c.platformScore ?? null,
    }
  })

  const result = {
    results,
    total: data.data?.totalResults ?? results.length,
    credits_left: data.creditsAvailable ?? data.remainingQuota ?? null,
    credits_used: data.creditsUsed ?? data.quotaUsed ?? data.quotaUsedTotal ?? null,
    trace_id: typeof data.traceId === 'string' ? data.traceId : null,
    has_next_page: data.data?.hasNextPage === true,
    next_offset: Number.isInteger(data.data?.nextOffset) ? data.data.nextOffset : null,
    preset_id: opts.creatorDbPreset ?? null,
    platform_coverage: {},
    warnings,
    cache_hits: 0,
    live_calls: 1,
    cached: false,
    niche_resolution: nicheResolution ?? null,
  }

  // Save to cache for future requests
  try {
    const { prisma } = await import('@/lib/prisma')
    const cacheKey = cdbCacheKey(body)
    await prisma.clubSearchCache.upsert({
      where: { key: cacheKey },
      create: { key: cacheKey, request: body as any, data: result as any },
      update: { request: body as any, data: result as any, fetchedAt: new Date() },
    })
  } catch {
    // Cache write failure is non-fatal
  }

  return result
}

// Cache probe — checks club_search_cache for a matching CreatorDB request.
export async function creatordbSearchCacheProbe(opts: ClubSearchOptions) {
  try {
    const built = buildCreatorDbRequestBody(opts)
    if (!built) return null
    const { prisma } = await import('@/lib/prisma')
    const cacheKey = cdbCacheKey(built.body)
    const hit = await prisma.clubSearchCache.findUnique({ where: { key: cacheKey } })
    return hit ? { ...(hit.data as object), cached: true } : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// ISO alpha-3 → alpha-2 reverse map (for normalizing CreatorDB responses)
// ---------------------------------------------------------------------------

const COUNTRY_A3_TO_A2: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_A2_TO_A3).map(([a2, a3]) => [a3, a2])
)

const LANG_3_TO_2: Record<string, string> = Object.fromEntries(
  Object.entries(LANG_2_TO_3).map(([l2, l3]) => [l3, l2])
)

// ---------------------------------------------------------------------------
// Layer 2: Profile Enrichment
// Calls /profile + /performance + /contact for the given creator.
// Returns the same shape as clubEnrich() so the detail popup works unchanged.
// ---------------------------------------------------------------------------

async function fetchCreatorDbEnrichment(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
) {
  const platformPath = PLATFORM_PATH[platform]
  if (!platformPath) throw new Error(`CreatorDB does not support platform: ${platform}`)
  if (!creatordbConfigured()) throw new Error('CreatorDB API not configured')

  const cleanHandle = handle.replace(/^@/, '')
  const isYoutube = platform === 'youtube'

  // Fetch profile + performance + contact in parallel
  const [profileRes, perfRes, contactRes] = await Promise.all([
    creatorDbFetch(`${BASE}/${platformPath}/profile`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ uniqueId: cleanHandle, fields: PROFILE_FIELDS[platform] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    }, { userId: opts?.logUserId }),
    creatorDbFetch(`${BASE}/${platformPath}/performance`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ uniqueId: cleanHandle, fields: PERFORMANCE_FIELDS[platform] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    }, { userId: opts?.logUserId }),
    creatorDbFetch(`${BASE}/${platformPath}/contact`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ uniqueId: cleanHandle, fields: ['emails'] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    }, { userId: opts?.logUserId }).catch(() => null), // contact may 404 for some creators
  ])

  const profileData = await profileRes.json().catch(() => null)
  const perfData = await perfRes.json().catch(() => null)
  const contactData = contactRes ? await contactRes.json().catch(() => null) : null

  if (!profileRes.ok || !profileData?.success) {
    throw new Error(
      profileData?.errorDescription || profileData?.message || profileData?.error ||
        `CreatorDB profile fetch failed (${profileRes.status})`
    )
  }

  const p = profileData.data || {}
  const perf = perfData?.data || {}
  const emails: string[] = contactData?.data?.emails || []
  const email = emails.find((e: string) => e.includes('@')) || null

  // Normalize country/language from alpha-3 to alpha-2
  const countryA3 = p.country || null
  const country = countryA3 ? (COUNTRY_A3_TO_A2[countryA3] || countryA3) : null
  const langA3 = p.mainLanguage || null
  const language = langA3 ? (LANG_3_TO_2[langA3] || langA3) : null

  // Engagement rate from performance data
  const imgPerf = perf.imagesPerformanceRecent || {}
  const reelsPerf = perf.reelsPerformanceRecent || {}
  const videosPerf = perf.videosPerformanceRecent || perf.recentVideosPerformance || {}
  const engagementPercent =
    (reelsPerf.avgEngagementRate ?? imgPerf.avgEngagementRate ?? videosPerf.avgEngagementRate ?? null)
  const engagementDisplay = engagementPercent != null ? Number(engagementPercent) * 100 : null

  // Growth data
  const growth = p.subscriberGrowth || {}
  const followerGrowth = {
    '7d': growth.g7 ?? null,
    '30d': growth.g30 ?? null,
    '90d': growth.g90 ?? null,
  }

  // Avg views/likes from performance
  const avgViews = reelsPerf.avgViews ?? videosPerf.avgViews ?? null
  const avgLikes = reelsPerf.avgLikes ?? imgPerf.avgLikes ?? videosPerf.avgLikes ?? null

  // Posting frequency from content count
  const contentIn30 = perf.contentCountByDays?.d30 ?? null
  const postingFrequency = contentIn30 != null ? contentIn30 : null

  // Hashtags
  const hashtags = Array.isArray(p.hashtags)
    ? p.hashtags.map((h: any) => h.name || h).filter(Boolean).slice(0, 8)
    : []

  // Niches
  const niches = Array.isArray(p.niches) ? p.niches : []

  // Other links / cross-platform presence
  const otherLinks = Array.isArray(p.otherLinks) ? p.otherLinks : []
  const accounts = otherLinks
    .filter((l: any) => l.url)
    .map((l: any) => {
      const url = l.url as string
      let plat = 'website'
      if (url.includes('youtube.com') || url.includes('youtu.be')) plat = 'youtube'
      else if (url.includes('tiktok.com')) plat = 'tiktok'
      else if (url.includes('instagram.com')) plat = 'instagram'
      else if (url.includes('twitter.com') || url.includes('x.com')) plat = 'twitter'
      else if (url.includes('twitch.tv')) plat = 'twitch'
      else if (url.includes('facebook.com')) plat = 'facebook'
      else if (url.includes('linkedin.com')) plat = 'linkedin'
      return {
        platform: plat,
        username: l.title || url,
        followers: null,
        engagement_percent: null,
      }
    })

  // Add the primary platform account
  accounts.unshift({
    platform,
    username: cleanHandle,
    followers: isYoutube ? (p.totalSubscribers ?? null) : (p.totalFollowers ?? null),
    engagement_percent: engagementDisplay,
  })

  const totalFollowers = isYoutube ? (p.totalSubscribers ?? 0) : (p.totalFollowers ?? 0)

  return {
    platform,
    handle: cleanHandle,
    name: p.displayName || cleanHandle,
    avatar_url: p.avatarUrl || null,
    bio: p.bio || null,
    location: country,
    language,
    gender: null, // CreatorDB doesn't provide creator gender in profile
    is_business: p.isBusinessAccount ?? null,
    is_private: p.isPrivateAccount ?? null,
    is_verified: p.isVerified ?? null,
    has_brand_deals: p.hasSponsors ?? null,
    niche: niches,
    hashtags,
    followers: totalFollowers,
    engagement_percent: engagementDisplay,
    posting_frequency_recent_months: postingFrequency,
    avg_views: avgViews,
    avg_likes: avgLikes,
    follower_growth: followerGrowth,
    income: null, // CreatorDB has pricing info but not income estimates
    total_followers: totalFollowers,
    accounts,
    contactable: Boolean(email),
    // Internal — not sent to client
    _email: email,
    _category: p.category ?? (Array.isArray(p.categoryBreakdown) ? p.categoryBreakdown[0]?.category ?? null : null),
    _totalContents: p.totalContents ?? null,
    _totalFollowing: p.totalFollowing ?? null,
    _lastPublishTime: p.lastPublishTime ?? null,
    _lastDbUpdateTime: p.lastDbUpdateTime ?? null,
    _ranking: perf.ranking ?? null,
  }
}

export async function creatordbEnrich(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
) {
  const { _email, ...detail } = await fetchCreatorDbEnrichment(platform, handle, opts)
  return detail
}

export async function creatordbEnrichForOutreach(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
) {
  const enriched = await fetchCreatorDbEnrichment(platform, handle, opts)
  const { _email, ...detail } = enriched
  return { detail, email: _email }
}

// ---------------------------------------------------------------------------
// Layer 3: Audience Analytics
// Calls /audience for the given creator.
// Returns the same shape as clubAnalytics() so the analytics UI works unchanged.
// ---------------------------------------------------------------------------

export async function creatordbAnalytics(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
) {
  const platformPath = PLATFORM_PATH[platform]
  if (!platformPath) throw new Error(`CreatorDB does not support platform: ${platform}`)
  if (!creatordbConfigured()) throw new Error('CreatorDB API not configured')

  const cleanHandle = handle.replace(/^@/, '')

  const res = await creatorDbFetch(`${BASE}/${platformPath}/audience`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ uniqueId: cleanHandle, fields: AUDIENCE_FIELDS }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  }, { userId: opts?.logUserId })

  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) {
    throw new Error(
      data?.errorDescription || data?.message || data?.error ||
        `CreatorDB audience fetch failed (${res.status})`
    )
  }

  const d = data.data || {}

  // Normalize audience locations from alpha-3 to alpha-2
  const countries = Array.isArray(d.audienceLocations)
    ? d.audienceLocations.map((loc: any) => ({
        code: COUNTRY_A3_TO_A2[loc.country] || loc.country,
        name: COUNTRY_A3_TO_A2[loc.country] || loc.country,
        weight: loc.share ?? 0,
      })).slice(0, 6)
    : []

  // Gender breakdown
  const genders: { code: string; weight: number }[] = []
  if (d.audienceGender) {
    if (d.audienceGender.maleRatio != null) {
      genders.push({ code: 'MALE', weight: d.audienceGender.maleRatio })
    }
    if (d.audienceGender.femaleRatio != null) {
      genders.push({ code: 'FEMALE', weight: d.audienceGender.femaleRatio })
    }
  }

  // Age breakdown
  const ages = Array.isArray(d.audienceAgeBreakdown)
    ? d.audienceAgeBreakdown.map((a: any) => ({
        code: a.ageRange || '',
        weight: a.share ?? 0,
      }))
    : []

  return {
    platform,
    handle: cleanHandle,
    audience: {
      genders,
      ages,
      genders_per_age: [],
      languages: [], // CreatorDB audience endpoint doesn't provide language breakdown
      countries,
      notable_users_ratio: null,
      avg_age: d.audienceAvgAge ?? null,
    },
    avg_views: null, // already provided in profile enrichment
    avg_likes: null,
    avg_comments: null,
    has_brand_deals: null,
    income: null,
    follower_growth: null,
    posting_frequency_recent_months: null,
  }
}
