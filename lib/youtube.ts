// YouTube Data API v3 — default discovery browse list.
//
// The API has no "top creators" endpoint, so we search a fixed set of niche
// queries for channels, fetch their statistics, and rank by subscribers
// descending. A build costs ~802 quota units (8 searches x 100 + channel
// batches x 1); the result is cached in the DB for 7 days, so day-to-day
// browsing costs zero quota. If a rebuild fails, the stale list is served.

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

export const YOUTUBE_BROWSE_CACHE_KEY = 'youtube:browse:v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CREATORS = 80

const NICHE_QUERIES = [
  'gaming',
  'beauty',
  'fitness',
  'tech',
  'food',
  'music',
  'travel',
  'education',
]

export function youtubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY)
}

async function ytGet(path: string, params: Record<string, string>, timeoutMs = 15000) {
  const url = new URL(`${YT_BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = data?.error?.message || `YouTube API ${path} failed (${res.status})`
    throw new Error(detail)
  }
  return data
}

async function buildBrowseList() {
  // 1) Niche channel searches → channel ids with the niche that surfaced them
  const nicheByChannel = new Map<string, string>()
  for (const q of NICHE_QUERIES) {
    const data = await ytGet('search', {
      part: 'snippet',
      type: 'channel',
      maxResults: '10',
      q,
    })
    for (const item of data?.items || []) {
      const id = item?.id?.channelId
      if (id && !nicheByChannel.has(id)) nicheByChannel.set(id, q)
    }
  }

  // 2) Channel statistics in batches of 50 (1 quota unit per call)
  const ids = Array.from(nicheByChannel.keys())
  const channels: any[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const data = await ytGet('channels', {
      part: 'snippet,statistics',
      id: ids.slice(i, i + 50).join(','),
      maxResults: '50',
    })
    channels.push(...(data?.items || []))
  }

  // 3) Shape like DiscoveredCreator and rank by subscribers desc
  const results = channels
    .flatMap((c) => {
      const handle = (c?.snippet?.customUrl || '').replace(/^@/, '')
      const subs = Number(c?.statistics?.subscriberCount)
      // Handle-less or hidden-subscriber channels can't be ranked or enriched
      if (!handle || c?.statistics?.hiddenSubscriberCount || !Number.isFinite(subs)) return []
      return [
        {
          id: `yt:${c.id}`,
          platform: 'youtube',
          handle,
          display_name: c.snippet?.title || handle,
          bio: (c.snippet?.description || '').slice(0, 200) || null,
          country: c.snippet?.country ?? null,
          follower_count: subs,
          engagement_rate: null,
          niche_tags: [nicheByChannel.get(c.id)].filter(Boolean),
          profile_url: `https://www.youtube.com/@${handle}`,
          // YouTube thumbnails are stable URLs — no re-hosting needed
          avatar_url: c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || null,
          score: null,
        },
      ]
    })
    .sort((a, b) => b.follower_count - a.follower_count)
    .slice(0, MAX_CREATORS)

  return { results }
}

// ---------------------------------------------------------------------------
// Keyword search — replaces the influencers.club discovery API for YouTube.
// Results are shaped identically to club search rows (including the
// `club:youtube:` id prefix) so the UI, detail popup, outreach and billing
// behave exactly the same regardless of the data source.
//
// Quota: a fresh search costs ~155 units (search.list 100 + channels.list
// 1-2 + one playlistItems.list per channel for engagement + videos.list 2).
// The full 50-channel set is cached for 7 days keyed by the fetch-affecting
// params (query/country/language), so pagination, follower/engagement
// filters, sorting and repeat searches cost zero quota.
// ---------------------------------------------------------------------------

const YT_SEARCH_CACHE_PREFIX = 'youtube-search:v1:'
const YT_SEARCH_POOL = 50
const ER_SAMPLE_VIDEOS = 5

export interface YoutubeSearchOpts {
  query: string
  country?: string
  language?: string
  minFollowers?: number
  maxFollowers?: number
  minEngagement?: number
  maxEngagement?: number
  bioKeywords?: string[]
  lastPost?: 90 | 365
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit: number
  page?: number
  /** Warnings collected by the caller (e.g. club-only filters skipped). */
  warnings?: string[]
  /**
   * Scheduler for the background engagement backfill (e.g. Next's `after`).
   * Falls back to a detached promise when omitted.
   */
  defer?: (task: () => Promise<void>) => void
}

// Internal cached row: club-shaped result + private fields used for
// post-fetch filtering (stripped before returning to the client).
interface YtPoolRow {
  row: {
    id: string
    platform: 'youtube'
    handle: string | null
    display_name: string | null
    bio: string | null
    country: string | null
    language: string | null
    follower_count: number | null
    engagement_rate: number | null
    niche_tags: string[]
    profile_url: string | null
    avatar_url: string | null
    score: number | null
  }
  desc: string
  lastVideoAt: string | null
}

// YouTube titles/descriptions sometimes contain unpaired UTF-16 surrogates
// (truncated emoji), which break JSON serialization in the Prisma cache
// write ("unexpected end of hex escape"). Strip them.
function cleanStr(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '')
}

function topicNames(c: any): string[] {
  const urls: string[] = c?.topicDetails?.topicCategories || []
  return [
    ...new Set(
      urls
        .map((u) => decodeURIComponent(String(u).split('/').pop() || '').replace(/_/g, ' '))
        .filter(Boolean)
    ),
  ].slice(0, 8)
}

async function buildSearchPool(opts: YoutubeSearchOpts): Promise<YtPoolRow[]> {
  // 1) Channel search (100 units)
  const searchParams: Record<string, string> = {
    part: 'snippet',
    type: 'channel',
    maxResults: String(YT_SEARCH_POOL),
    q: opts.query,
  }
  if (opts.country) searchParams.regionCode = opts.country.toUpperCase()
  if (opts.language) searchParams.relevanceLanguage = opts.language
  const search = await ytGet('search', searchParams)
  const ids: string[] = [
    ...new Set(
      ((search?.items || []) as any[]).map((i) => i?.id?.channelId).filter(Boolean)
    ),
  ]
  if (ids.length === 0) return []

  // 2) Channel details in batches of 50 (1 unit per batch)
  const channels: any[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const data = await ytGet('channels', {
      part: 'snippet,statistics,topicDetails,brandingSettings,contentDetails',
      id: ids.slice(i, i + 50).join(','),
      maxResults: '50',
    })
    channels.push(...(data?.items || []))
  }

  // 3) Shape like club search rows (order = YouTube relevance). Engagement
  // and last-video recency are NOT computed here: playlistItems latency is
  // wildly volatile (median ~0.5s but regularly 5s+ per call), so they are
  // backfilled into the cached pool in the background — see
  // backfillEngagement(). First paint stays at search+channels speed.
  return channels.flatMap((c) => {
    const handle = (c?.snippet?.customUrl || '').replace(/^@/, '')
    const subs = Number(c?.statistics?.subscriberCount)
    if (!handle || c?.statistics?.hiddenSubscriberCount || !Number.isFinite(subs)) return []
    const desc = cleanStr(c?.snippet?.description)
    return [
      {
        row: {
          id: `club:youtube:${c.id}`,
          platform: 'youtube' as const,
          handle,
          display_name: cleanStr(c.snippet?.title) || handle,
          bio: cleanStr(desc.slice(0, 300)) || null,
          country: c.snippet?.country ?? null,
          language: c.snippet?.defaultLanguage ?? opts.language ?? null,
          follower_count: subs,
          engagement_rate: null,
          niche_tags: topicNames(c),
          profile_url: `https://www.youtube.com/@${handle}`,
          avatar_url:
            c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || null,
          score: null,
        },
        desc,
        lastVideoAt: null,
      },
    ]
  })
}

// Background ER backfill: sample each channel's recent uploads with generous
// timeouts (latency spikes don't hurt — nobody is waiting), then update the
// cached pool in place. In-process de-dupe guards against double scheduling.
const erBackfillInFlight = new Set<string>()

export async function backfillEngagement(cacheKey: string): Promise<void> {
  if (erBackfillInFlight.has(cacheKey)) return
  erBackfillInFlight.add(cacheKey)
  try {
    const { prisma } = await import('@/lib/prisma')
    const row = await prisma.clubSearchCache.findUnique({ where: { key: cacheKey } })
    const data = row?.data as any
    const pool: YtPoolRow[] | undefined = data?.pool
    if (!Array.isArray(pool) || data?.erComplete) return

    // playlistItems per channel through a small worker pool (a wide burst
    // self-queues and inflates per-call latency)
    const videoIdsByChannel = new Map<string, string[]>()
    const lastVideoAtByChannel = new Map<string, string>()
    const queue = pool.map((e) => e.row.id.replace(/^club:youtube:/, ''))
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          const items = await ytGet('playlistItems', {
            part: 'contentDetails',
            // A channel's uploads playlist id is its channel id with UC → UU
            playlistId: id.replace(/^UC/, 'UU'),
            maxResults: String(ER_SAMPLE_VIDEOS),
          })
          const vids = ((items?.items || []) as any[])
            .map((i) => i?.contentDetails)
            .filter(Boolean)
          if (vids[0]?.videoPublishedAt) lastVideoAtByChannel.set(id, vids[0].videoPublishedAt)
          videoIdsByChannel.set(id, vids.map((v) => v.videoId).filter(Boolean))
        } catch {
          // No/private uploads → no ER for this channel
        }
      }
    }
    await Promise.all(Array.from({ length: 10 }, () => worker()))

    // Video statistics in shared 50-id batches
    const allVideoIds = [...videoIdsByChannel.values()].flat()
    const videoStats = new Map<string, { views: number; interactions: number }>()
    for (let i = 0; i < allVideoIds.length; i += 50) {
      try {
        const data2 = await ytGet('videos', {
          part: 'statistics',
          id: allVideoIds.slice(i, i + 50).join(','),
          maxResults: '50',
        })
        for (const v of data2?.items || []) {
          videoStats.set(v.id, {
            views: Number(v?.statistics?.viewCount) || 0,
            interactions:
              (Number(v?.statistics?.likeCount) || 0) + (Number(v?.statistics?.commentCount) || 0),
          })
        }
      } catch {
        // Failed batch → those channels keep a null ER
      }
    }

    const updated = pool.map((e) => {
      const channelId = e.row.id.replace(/^club:youtube:/, '')
      const stats = (videoIdsByChannel.get(channelId) || [])
        .map((id) => videoStats.get(id))
        .filter(Boolean) as { views: number; interactions: number }[]
      const views = stats.reduce((s, v) => s + v.views, 0)
      const interactions = stats.reduce((s, v) => s + v.interactions, 0)
      return {
        ...e,
        row: {
          ...e.row,
          engagement_rate: views > 0 ? Math.round((interactions / views) * 1000) / 10 : null,
        },
        lastVideoAt: lastVideoAtByChannel.get(channelId) ?? null,
      }
    })

    // Targeted update: don't touch fetchedAt (the pool itself isn't fresher)
    await prisma.clubSearchCache.update({
      where: { key: cacheKey },
      data: { data: { pool: updated, erComplete: true } as any },
    })
  } catch (error) {
    console.error('YouTube ER backfill failed:', error)
  } finally {
    erBackfillInFlight.delete(cacheKey)
  }
}

export async function youtubeSearchCreators(opts: YoutubeSearchOpts) {
  const warnings = [...(opts.warnings || [])]
  const fetchKey = {
    q: opts.query.trim().toLowerCase(),
    country: opts.country?.toUpperCase() || '',
    language: opts.language || '',
  }
  const cacheKey =
    YT_SEARCH_CACHE_PREFIX +
    Buffer.from(JSON.stringify(fetchKey)).toString('base64url').slice(0, 180)

  // Cache probe (free); stale rows are kept as a fallback for API failures.
  let pool: YtPoolRow[] | null = null
  let stalePool: YtPoolRow[] | null = null
  let cacheHit = false
  let needsBackfill = false
  const scheduleBackfill = () => {
    const task = () => backfillEngagement(cacheKey)
    if (opts.defer) opts.defer(task)
    else void task()
  }
  try {
    const { prisma } = await import('@/lib/prisma')
    const row = await prisma.clubSearchCache.findUnique({ where: { key: cacheKey } })
    if (row) {
      const data = (row.data as any)?.pool
      if (Array.isArray(data)) {
        if (Date.now() - row.fetchedAt.getTime() < CACHE_TTL_MS) {
          pool = data
          cacheHit = true
          // A killed background task leaves erComplete unset — retry it
          // (in-process de-dupe prevents stampedes).
          if (!(row.data as any)?.erComplete) needsBackfill = true
        } else {
          stalePool = data
        }
      }
    }
  } catch {
    // cache is best-effort
  }

  if (!pool) {
    if (!youtubeConfigured()) {
      if (stalePool) {
        pool = stalePool
        cacheHit = true
      } else {
        throw new Error('YouTube API not configured')
      }
    } else {
      try {
        pool = await buildSearchPool(opts)
        try {
          const { prisma } = await import('@/lib/prisma')
          const data = { pool, erComplete: false } as any
          await prisma.clubSearchCache.upsert({
            where: { key: cacheKey },
            create: { key: cacheKey, request: fetchKey, data },
            update: { request: fetchKey, data, fetchedAt: new Date() },
          })
          needsBackfill = true
        } catch (error) {
          console.error('YouTube search persistence failed:', error)
        }
      } catch (err) {
        if (!stalePool) throw err
        console.warn('YouTube search failed; serving stale pool:', (err as any)?.message)
        pool = stalePool
        cacheHit = true
      }
    }
  }

  // Post-fetch filters (free — applied to the cached pool)
  let list = pool
  if (opts.country) {
    // Keep channels whose country matches OR is unset (most channels don't
    // set one; regionCode already biased the search toward the country).
    const cc = opts.country.toUpperCase()
    list = list.filter((e) => !e.row.country || e.row.country === cc)
  }
  if (opts.minFollowers != null) list = list.filter((e) => (e.row.follower_count ?? 0) >= opts.minFollowers!)
  if (opts.maxFollowers != null) list = list.filter((e) => (e.row.follower_count ?? 0) <= opts.maxFollowers!)
  if (opts.minEngagement != null) list = list.filter((e) => e.row.engagement_rate != null && e.row.engagement_rate >= opts.minEngagement!)
  if (opts.maxEngagement != null) list = list.filter((e) => e.row.engagement_rate != null && e.row.engagement_rate <= opts.maxEngagement!)
  if (opts.bioKeywords?.length) {
    const kws = opts.bioKeywords.map((k) => k.toLowerCase())
    list = list.filter((e) => {
      const hay = `${e.desc} ${e.row.display_name || ''}`.toLowerCase()
      return kws.some((k) => hay.includes(k))
    })
  }
  if (opts.lastPost) {
    const cutoff = Date.now() - opts.lastPost * 24 * 60 * 60 * 1000
    // Lenient while recency is still being backfilled: unknown lastVideoAt
    // passes (dropping everyone until the backfill lands would be worse)
    list = list.filter((e) => !e.lastVideoAt || new Date(e.lastVideoAt).getTime() >= cutoff)
  }

  // Sort (relevancy = YouTube's own order)
  const dir = opts.sortOrder === 'asc' ? 1 : -1
  if (opts.sortBy === 'number_of_followers') {
    list = [...list].sort((a, b) => dir * ((a.row.follower_count ?? 0) - (b.row.follower_count ?? 0)))
  } else if (opts.sortBy === 'engagement_rate') {
    list = [...list].sort((a, b) => dir * ((a.row.engagement_rate ?? -1) - (b.row.engagement_rate ?? -1)))
  } else if (opts.sortBy && opts.sortBy !== 'relevancy') {
    warnings.push(`Sorting by "${opts.sortBy}" is not available for YouTube searches — showing relevance order.`)
  }

  if (needsBackfill) scheduleBackfill()

  const page = opts.page ?? 0
  const results = list.slice(page * opts.limit, page * opts.limit + opts.limit).map((e) => e.row)

  return {
    results,
    total: list.length,
    credits_left: null,
    platform_coverage: {},
    warnings,
    cache_hits: cacheHit ? 1 : 0,
    live_calls: cacheHit ? 0 : 1,
    cached: cacheHit,
  }
}

// Cached browse list: fresh row → serve; stale row → rebuild, falling back
// to the stale data if the rebuild fails; no row → build live.
export async function youtubeBrowseCreators(): Promise<{ results: any[] }> {
  let stale: { results: any[] } | null = null
  try {
    const { prisma } = await import('@/lib/prisma')
    const row = await prisma.clubSearchCache.findUnique({
      where: { key: YOUTUBE_BROWSE_CACHE_KEY },
    })
    if (row) {
      const data = row.data as any
      if (Date.now() - row.fetchedAt.getTime() < CACHE_TTL_MS) return data
      stale = data
    }
  } catch {
    // cache is best-effort
  }

  if (!youtubeConfigured()) {
    if (stale) return stale
    throw new Error('YouTube API not configured')
  }

  let built: { results: any[] }
  try {
    built = await buildBrowseList()
  } catch (err) {
    if (stale) {
      console.warn('YouTube browse rebuild failed; serving stale list:', (err as any)?.message)
      return stale
    }
    throw err
  }

  if (built.results.length > 0) {
    try {
      const { prisma } = await import('@/lib/prisma')
      await prisma.clubSearchCache.upsert({
        where: { key: YOUTUBE_BROWSE_CACHE_KEY },
        create: { key: YOUTUBE_BROWSE_CACHE_KEY, request: { youtube_browse: NICHE_QUERIES }, data: built },
        update: { request: { youtube_browse: NICHE_QUERIES }, data: built, fetchedAt: new Date() },
      })
    } catch (error) {
      console.error('YouTube browse persistence failed:', error)
    }
  } else if (stale) {
    return stale
  }

  return built
}
