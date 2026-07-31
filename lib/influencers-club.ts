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
