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

async function ytGet(path: string, params: Record<string, string>) {
  const url = new URL(`${YT_BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
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
