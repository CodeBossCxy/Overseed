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

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/
/** Remove lines that contain an email or phone number from a bio string. */
function stripContactLines(bio: string | null): string | null {
  if (!bio) return bio
  return bio.split('\n').filter(l => !EMAIL_RE.test(l) && !PHONE_RE.test(l)).join('\n') || null
}

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

// Fractional profile fields (Call 1): ~1.2 credits per creator
const PROFILE_FIELDS: Record<string, string[]> = {
  instagram: [
    'bio', 'category', 'country', 'mainLanguage', 'totalContents',
    'isAgencyRepresented', 'hasEmail', 'hasSponsors', 'relatedCreators',
    'subscriberGrowth', 'lastPublishTime', 'avatarUrl',
  ],
  tiktok: [
    'bio', 'category', 'country', 'mainLanguage', 'totalContents',
    'isAgencyRepresented', 'hasEmail', 'hasSponsors', 'relatedCreators',
    'subscriberGrowth', 'lastPublishTime', 'avatarUrl',
  ],
  youtube: [
    'bio', 'categoryBreakdown', 'country', 'mainLanguage', 'totalContents',
    'isAgencyRepresented', 'hasEmail', 'hasSponsors', 'relatedCreators',
    'subscriberGrowth', 'lastPublishTime', 'avatarUrl',
  ],
}

// Fractional performance fields (Call 2): YT ~1.4, IG ~2, TT ~1.4 credits
const PERFORMANCE_FIELDS: Record<string, string[]> = {
  instagram: [
    'contentsPerformanceRecent', 'reelsPerformanceRecent',
    'contentCountByDays', 'reelsPerformance30d', 'reelsPerformance90d',
  ],
  tiktok: [
    'videosPerformanceRecent', 'contentCountByDays',
    'videosPerformance30d', 'videosPerformance90d',
  ],
  youtube: [
    'contentsPerformanceRecent', 'shortsPerformanceRecent',
    'contentCountByDays', 'shortsPerformance30d', 'shortsPerformance90d',
  ],
}

// Fractional content-detail fields (Call 3): 0.3 credits per creator
const CONTENT_DETAIL_FIELDS: Record<string, Record<string, number>> = {
  instagram: { recentReels: 3 },
  tiktok: { recentVideos: 3 },
  youtube: { recentShorts: 3 },
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

  if (filters.length > 20) {
    throw new Error(`CreatorDB searches are limited to 20 filters (received ${filters.length})`)
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
    if (filters.length > 20) {
      // Trim to 20 — keep the explicit cdb_filters, drop overflow basic ones
      filters = [...baseFilters, ...missing.slice(0, 20 - baseFilters.length)]
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
    if (hit && (!hit.expiresAt || hit.expiresAt > new Date())) {
      return { ...(hit.data as object), cached: true }
    }
  } catch {
    // Cache miss or DB error — proceed with live call
  }

  const filters = Array.isArray((body as any).filters) ? (body as any).filters : []
  if (filters.length > 20) {
    throw new Error(`CreatorDB searches are limited to 20 filters (received ${filters.length})`)
  }

  // ── LOG: CreatorDB API request ──
  console.group('[CreatorDB] Outgoing search request')
  console.log('URL:', `${BASE}/${platformPath}/search`)
  console.log('Request body:', JSON.stringify(body, null, 2))
  console.groupEnd()

  const res = await searchFetch(`${BASE}/${platformPath}/search`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store',
  }, opts?.logUserId)

  // Read from clone — the original body stream may already be consumed by
  // creatorDbFetch's logging layer in some Node.js/undici versions.
  const data = await res.clone().json().catch(() => null)
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

  // ── LOG: CreatorDB API response summary ──
  console.group('[CreatorDB] Search response')
  console.log('Total results:', data.data?.totalResults)
  console.log('Returned:', creatorList.length)
  console.log('Credits used:', data.creditsUsed ?? data.quotaUsed ?? '(unknown)')
  console.log('Credits remaining:', data.creditsAvailable ?? data.remainingQuota ?? '(unknown)')
  console.log('Trace ID:', data.traceId ?? '(none)')
  if (creatorList.length > 0) {
    console.log('Top 5 creators:', creatorList.slice(0, 5).map((c: any) => ({
      handle: c.uniqueId || c.channelId,
      displayName: c.displayName,
      followers: c.totalFollowers ?? c.totalSubscribers,
      country: c.profile?.country,
      niches: c.profile?.niches?.slice(0, 3),
    })))
  }
  console.groupEnd()

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
      bio: stripContactLines(profile.bio ?? null),
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

  // Save to cache for future requests, then rehost images in background
  const cacheKey = cdbCacheKey(body)
  try {
    const { prisma } = await import('@/lib/prisma')
    const { getCacheExpiresAt } = await import('@/lib/discovery-cache-rehost')
    await prisma.clubSearchCache.upsert({
      where: { key: cacheKey },
      create: { key: cacheKey, request: body as any, data: result as any, expiresAt: getCacheExpiresAt() },
      update: { request: body as any, data: result as any, fetchedAt: new Date(), expiresAt: getCacheExpiresAt() },
    })
  } catch {
    // Cache write failure is non-fatal
  }

  // Rehost expiring CDN image URLs to S3 in background (non-blocking).
  // The first user gets live CDN URLs; subsequent cache hits get stable S3 URLs.
  rehostCacheImages(cacheKey).catch(() => {})

  return result
}

/**
 * Background: read a cache row, rehost all expiring image URLs to S3,
 * and update the row with the stable URLs.
 */
async function rehostCacheImages(cacheKey: string): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const row = await prisma.clubSearchCache.findUnique({ where: { key: cacheKey } })
    if (!row || row.rehosted) return
    const { rehostSearchImages } = await import('@/lib/discovery-cache-rehost')
    const data = row.data as any
    const updated = await rehostSearchImages(structuredClone(data))
    await prisma.clubSearchCache.update({
      where: { key: cacheKey },
      data: { data: updated, rehosted: true },
    })
  } catch (e) {
    console.warn('[creatordb] rehostCacheImages failed:', e)
  }
}

// Cache probe — checks club_search_cache for a matching CreatorDB request.
export async function creatordbSearchCacheProbe(opts: ClubSearchOptions) {
  try {
    const built = buildCreatorDbRequestBody(opts)
    if (!built) return null
    const { prisma } = await import('@/lib/prisma')
    const cacheKey = cdbCacheKey(built.body)
    const hit = await prisma.clubSearchCache.findUnique({ where: { key: cacheKey } })
    if (hit && (!hit.expiresAt || hit.expiresAt > new Date())) {
      return { ...(hit.data as object), cached: true }
    }
    return null
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
// Calls /profile + /performance + /content-detail for the given creator.
// All 3 use Fractional Calls for cost efficiency (total ~2.9-3.5 CDB credits).
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
  // Always use uniqueId — works for all platforms including YouTube handles
  const idField = { uniqueId: cleanHandle }

  // 3 parallel fractional calls: profile (~1.2) + performance (~1.4-2) + content-detail (0.3)
  const [profileRes, perfRes, contentRes] = await Promise.all([
    creatorDbFetch(`${BASE}/${platformPath}/profile`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ...idField, fields: PROFILE_FIELDS[platform] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    }, { userId: opts?.logUserId }),
    creatorDbFetch(`${BASE}/${platformPath}/performance`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ...idField, fields: PERFORMANCE_FIELDS[platform] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    }, { userId: opts?.logUserId }),
    creatorDbFetch(`${BASE}/${platformPath}/content-detail`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ...idField, fields: CONTENT_DETAIL_FIELDS[platform] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    }, { userId: opts?.logUserId }).catch(() => null),
  ])

  const profileData = await profileRes.json().catch(() => null)
  const perfData = await perfRes.json().catch(() => null)
  const contentData = contentRes ? await contentRes.json().catch(() => null) : null

  if (!profileRes.ok || !profileData?.success) {
    throw new Error(
      profileData?.errorDescription || profileData?.message || profileData?.error ||
        `CreatorDB profile fetch failed (${profileRes.status})`
    )
  }

  const p = profileData.data || {}
  const perf = perfData?.data || {}
  const content = contentData?.data || {}


  // Normalize country/language from alpha-3 to alpha-2
  const countryA3 = p.country || null
  const country = countryA3 ? (COUNTRY_A3_TO_A2[countryA3] || countryA3) : null
  const langA3 = p.mainLanguage || null
  const language = langA3 ? (LANG_3_TO_2[langA3] || langA3) : null

  // Performance data per content type
  const contentsPerf = perf.contentsPerformanceRecent || {}
  const reelsPerf = perf.reelsPerformanceRecent || {}
  const videosPerf = perf.videosPerformanceRecent || {}
  const shortsPerf = perf.shortsPerformanceRecent || {}

  // Engagement rate — nested as { engagement: { avgEngagementRate } }
  const engagementRaw =
    contentsPerf.engagement?.avgEngagementRate ?? reelsPerf.engagement?.avgEngagementRate ?? videosPerf.engagement?.avgEngagementRate ?? shortsPerf.engagement?.avgEngagementRate ?? null
  const engagementDisplay = engagementRaw != null ? Number(engagementRaw) * 100 : null

  // Growth data — decimal ratios → percent
  const growth = p.subscriberGrowth || {}
  const growthPct = (v: unknown) => typeof v === 'number' ? Math.round(v * 10000) / 100 : null
  const followerGrowth = {
    '7d': growthPct(growth.g7),
    '30d': growthPct(growth.g30),
    '90d': growthPct(growth.g90),
  }

  // Avg/median views and likes — nested as { views: { avg, median }, likes: { avg, median } }
  const primaryPerf = isYoutube ? shortsPerf : (platform === 'tiktok' ? videosPerf : reelsPerf)
  const avgViews = primaryPerf.views?.avg ?? null
  const medianViews = primaryPerf.views?.median ?? null
  const avgLikes = contentsPerf.likes?.avg ?? primaryPerf.likes?.avg ?? null
  const medianLikes = contentsPerf.likes?.median ?? primaryPerf.likes?.median ?? null

  // Posting frequency from content count (field uses "30d" not "d30")
  const contentIn30 = perf.contentCountByDays?.['30d'] ?? perf.contentCountByDays?.d30 ?? null

  // 30d/90d views
  const views30d = isYoutube ? perf.shortsPerformance30d : (platform === 'tiktok' ? perf.videosPerformance30d : perf.reelsPerformance30d)
  const views90d = isYoutube ? perf.shortsPerformance90d : (platform === 'tiktok' ? perf.videosPerformance90d : perf.reelsPerformance90d)

  // Recent content (3 reels/shorts/videos)
  const contentKey = isYoutube ? 'recentShorts' : (platform === 'tiktok' ? 'recentVideos' : 'recentReels')
  const contentLabel = isYoutube ? 'Short' : (platform === 'tiktok' ? 'Video' : 'Reel')
  const recentPosts = (Array.isArray(content[contentKey]) ? content[contentKey] : []).slice(0, 3).map((post: any) => {
    const postId = post.contentId || post.id || null
    const coverImage = post.coverImageUrl || post.thumbnailUrl
      || (isYoutube && postId ? `https://img.youtube.com/vi/${postId}/hqdefault.jpg` : null)
    return {
      contentId: postId,
      coverImageUrl: coverImage,
      description: post.description || post.title || null,
      publishTime: post.publishTime || null,
      likes: post.likes ?? null,
      comments: post.comments ?? null,
      views: post.views ?? null,
      label: `Latest ${contentLabel}`,
      contentUrl: postId ? (
        isYoutube ? `https://www.youtube.com/shorts/${postId}` :
        platform === 'tiktok' ? `https://www.tiktok.com/@${cleanHandle}/video/${postId}` :
        `https://www.instagram.com/reel/${postId}/`
      ) : null,
    }
  })

  // Category
  const category = p.category ?? (Array.isArray(p.categoryBreakdown) ? p.categoryBreakdown[0]?.category ?? null : null)

  // Related creators
  const relatedCreators = Array.isArray(p.relatedCreators) ? p.relatedCreators.slice(0, 10) : []

  return {
    platform,
    handle: cleanHandle,
    name: cleanHandle, // display name comes from discovery, not this call
    avatar_url: p.avatarUrl || null,
    bio: stripContactLines(p.bio || null),
    location: country,
    language,
    gender: null,
    is_business: null,
    is_private: null,
    is_verified: null,
    has_brand_deals: p.hasSponsors ?? null,
    niche: [],
    hashtags: [],
    followers: null, // comes from discovery
    engagement_percent: engagementDisplay,
    posting_frequency_recent_months: contentIn30,
    avg_views: avgViews,
    avg_likes: avgLikes,
    follower_growth: followerGrowth,
    income: null,
    total_followers: null, // comes from discovery
    accounts: [],
    contactable: false,
    // New fields from fractional calls
    category,
    total_contents: p.totalContents ?? null,
    is_agency_represented: p.isAgencyRepresented ?? null,
    has_email: p.hasEmail ?? null, // UI label: "Reachable from Overseed"
    related_creators: relatedCreators,
    last_publish_time: p.lastPublishTime ?? null,
    median_views: medianViews,
    median_likes: medianLikes,
    views_30d: views30d ?? null,
    views_90d: views90d ?? null,
    recent_posts: recentPosts,
    // Raw performance for detailed display
    _contentsPerf: contentsPerf,
    _primaryPerf: primaryPerf,
    _contentCountByDays: perf.contentCountByDays ?? null,
    // Internal — not sent to client
    _email: null,
    _category: category,
    _totalContents: p.totalContents ?? null,
    _totalFollowing: null,
    _lastPublishTime: p.lastPublishTime ?? null,
    _lastDbUpdateTime: null,
    _ranking: null,
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

/**
 * Fetch contact info for a creator on-demand. Separated from profile
 * enrichment because CreatorDB charges 0-15 credits per contact lookup.
 */
export async function creatordbContact(
  platform: string,
  handle: string,
  opts?: { logUserId?: string }
): Promise<{ email: string | null; emails: string[] }> {
  const platformPath = PLATFORM_PATH[platform]
  if (!platformPath) throw new Error(`CreatorDB does not support platform: ${platform}`)
  if (!creatordbConfigured()) throw new Error('CreatorDB API not configured')

  const cleanHandle = handle.replace(/^@/, '')
  const res = await creatorDbFetch(`${BASE}/${platformPath}/contact`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ uniqueId: cleanHandle, fields: ['emails'] }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  }, { userId: opts?.logUserId }).catch(() => null)

  const data = res ? await res.clone().json().catch(() => null) : null
  const emails: string[] = data?.data?.emails || []
  const email = emails.find((e: string) => e.includes('@')) || null
  return { email, emails }
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

  const data = await res.clone().json().catch(() => null)
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

// ── Fractional audience unlock (single field) ──────────────────────────
// Requests exactly ONE audience field to keep CreatorDB costs at 4 credits.
// Never call without `fields` — the full bundle costs 10 CreatorDB credits.

const AUDIENCE_FIELD_MAP: Record<string, string> = {
  audience_gender: 'audienceGender',
  audience_age: 'audienceAgeBreakdown',
  audience_country: 'audienceLocations',
}

const RETRY_429_DELAYS = [500, 1500, 3000]

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  userId?: string,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await creatorDbFetch(url, {
      ...init,
      signal: AbortSignal.timeout(30000),
    }, { userId })
    if (res.status !== 429 || attempt >= RETRY_429_DELAYS.length) return res
    await new Promise((r) => setTimeout(r, RETRY_429_DELAYS[attempt]))
  }
}

export async function creatordbAudienceFeature(
  platform: string,
  handle: string,
  feature: 'audience_gender' | 'audience_age' | 'audience_country',
  opts?: { logUserId?: string },
) {
  const platformPath = PLATFORM_PATH[platform]
  if (!platformPath) throw new Error(`CreatorDB does not support platform: ${platform}`)
  if (!creatordbConfigured()) throw new Error('CreatorDB API not configured')

  const cleanHandle = handle.replace(/^@/, '')
  const field = AUDIENCE_FIELD_MAP[feature]

  const res = await fetchWithRetry(`${BASE}/${platformPath}/audience`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ uniqueId: cleanHandle, fields: [field] }),
    cache: 'no-store',
  }, opts?.logUserId)

  const data = await res.clone().json().catch(() => null)

  // Detect FractionalCallsNotEnabled — log and rethrow, don't fall back
  if (data?.errorCode === 'FractionalCallsNotEnabled') {
    console.error('[CreatorDB] FractionalCallsNotEnabled for audience feature:', feature)
    throw new CreatorDbApiError(
      'Fractional calls not enabled on this API key',
      'FractionalCallsNotEnabled',
      data?.traceId ?? null,
      res.status,
    )
  }

  if (!res.ok || !data?.success) {
    throw new Error(
      data?.errorDescription || data?.message || data?.error ||
        `CreatorDB audience feature fetch failed (${res.status})`,
    )
  }

  const d = data.data || {}

  // Normalize per feature
  if (feature === 'audience_gender') {
    const g = d.audienceGender || {}
    return {
      feature,
      data: {
        maleRatio: g.maleRatio ?? null,
        femaleRatio: g.femaleRatio ?? null,
      },
    }
  }

  if (feature === 'audience_age') {
    const ages = Array.isArray(d.audienceAgeBreakdown)
      ? d.audienceAgeBreakdown.map((a: any) => ({
          ageRange: a.ageRange || '',
          share: a.share ?? 0,
        }))
      : []
    if (ages.length === 0) return null // no data available
    return { feature, data: { ages } }
  }

  // audience_country
  const countries = Array.isArray(d.audienceLocations)
    ? d.audienceLocations.slice(0, 5).map((loc: any) => ({
        country: COUNTRY_A3_TO_A2[loc.country] || loc.country,
        share: loc.share ?? 0,
      }))
    : []
  if (countries.length === 0) return null
  return { feature, data: { countries } }
}

// ── Brand collaborations (sponsorship) ─────────────────────────────────
// Only works on YouTube and Instagram. TikTok has no sponsorship endpoint.

export async function creatordbSponsorship(
  platform: string,
  handle: string,
  opts?: { logUserId?: string },
) {
  if (platform === 'tiktok') {
    throw new Error('CreatorDB sponsorship endpoint is not available for TikTok')
  }
  const platformPath = PLATFORM_PATH[platform]
  if (!platformPath) throw new Error(`CreatorDB does not support platform: ${platform}`)
  if (!creatordbConfigured()) throw new Error('CreatorDB API not configured')

  const cleanHandle = handle.replace(/^@/, '')

  const res = await fetchWithRetry(`${BASE}/${platformPath}/sponsorship`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ uniqueId: cleanHandle, sponsorList: 5 }),
    cache: 'no-store',
  }, opts?.logUserId)

  const data = await res.clone().json().catch(() => null)

  if (data?.errorCode === 'FractionalCallsNotEnabled') {
    console.error('[CreatorDB] FractionalCallsNotEnabled for sponsorship')
    throw new CreatorDbApiError(
      'Fractional calls not enabled on this API key',
      'FractionalCallsNotEnabled',
      data?.traceId ?? null,
      res.status,
    )
  }

  if (!res.ok || !data?.success) {
    throw new Error(
      data?.errorDescription || data?.message || data?.error ||
        `CreatorDB sponsorship fetch failed (${res.status})`,
    )
  }

  const rawSponsors = Array.isArray(data.data?.sponsorList) ? data.data.sponsorList.slice(0, 5) : []
  if (rawSponsors.length === 0) return null

  const sponsors = rawSponsors.map((s: any) => {
    // Sponsored content posts
    const posts = Array.isArray(s.sponsoredContents)
      ? s.sponsoredContents.map((p: any) => ({
          contentId: p.contentId || p.id || null,
          publishTime: p.publishTime || null,
          description: p.description || p.caption || null,
          coverImageUrl: p.coverImageUrl || p.thumbnailUrl || null,
          contentUrl: p.contentUrl || p.url || null,
          isSponsored: p.isSponsored ?? true,
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
          likes: p.likes ?? null,
          comments: p.comments ?? null,
          views: p.views ?? null,
          engagementRate: p.engagementRate ?? null,
        }))
      : []

    // Brand performance summary
    const perf = s.performance || s.brandPerformance || {}

    return {
      name: s.sponsorName || s.name || 'Unknown',
      brandId: s.sponsorId || s.brandId || null,
      logo: s.sponsorLogo || s.logo || null,
      url: s.sponsorUrl || s.url || null,
      socialId: s.sponsorSocialId || s.socialId || null,
      posts,
      performance: {
        totalLikes: perf.totalLikes ?? null,
        avgLikes: perf.avgLikes ?? null,
        medianLikes: perf.medianLikes ?? null,
        minLikes: perf.minLikes ?? null,
        maxLikes: perf.maxLikes ?? null,
        totalComments: perf.totalComments ?? null,
        avgComments: perf.avgComments ?? null,
        totalViews: perf.totalViews ?? null,
        avgViews: perf.avgViews ?? null,
        medianViews: perf.medianViews ?? null,
        minViews: perf.minViews ?? null,
        maxViews: perf.maxViews ?? null,
        avgEngagementRate: perf.avgEngagementRate ?? null,
        engagementConsistency: perf.engagementConsistency ?? null,
      },
    }
  })

  return { feature: 'brand_collaborations' as const, data: { sponsors } }
}
