import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { creatorDbFetch } from '@/lib/creatordb-usage'

const BASE = 'https://apiv3.creatordb.app'
const PLATFORM_PATH: Record<string, string> = { instagram: 'instagram', tiktok: 'tiktok', youtube: 'youtube' }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Content type to request per platform (one post only)
const CONTENT_FIELDS: Record<string, Record<string, number>> = {
  youtube: { recentShorts: 1 },
  instagram: { recentReels: 1 },
  tiktok: { recentVideos: 1 },
}

// Content type label per platform
const CONTENT_LABEL: Record<string, string> = {
  youtube: 'Latest Short',
  instagram: 'Latest Reel',
  tiktok: 'Latest Video',
}

// Build the content URL from platform + contentId
function buildContentUrl(platform: string, contentId: string, handle: string): string | null {
  if (!contentId) return null
  switch (platform) {
    case 'youtube': return `https://www.youtube.com/shorts/${contentId}`
    case 'instagram': return `https://www.instagram.com/reel/${contentId}/`
    case 'tiktok': return `https://www.tiktok.com/@${handle}/video/${contentId}`
    default: return null
  }
}

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 500

async function fetchContentForCreator(
  platform: string,
  handle: string,
  userId?: string,
): Promise<any | null> {
  const platformPath = PLATFORM_PATH[platform]
  if (!platformPath) return null
  const fields = CONTENT_FIELDS[platform]
  if (!fields) return null

  const isYoutube = platform === 'youtube'
  const body = isYoutube
    ? { channelId: handle, fields }
    : { uniqueId: handle, fields }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await creatorDbFetch(`${BASE}/${platformPath}/content-detail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.CREATORDB_API_KEY || '',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      }, { userId })

      if (res.status === 429) {
        // Rate limited — backoff and retry
        const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.success) {
        // FractionalCallsNotEnabled — don't retry
        if (data?.errorCode === 'FractionalCallsNotEnabled' || data?.errorCode === 'FRACTIONAL_CALLS_NOT_ENABLED') {
          console.warn(`[content-detail] Fractional calls not enabled for ${platform}:${handle}`)
          return null
        }
        if (res.status >= 500) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        return null
      }

      // Extract the first post from the response
      const contentData = data.data || {}
      // Response shape: { recentShorts: [...], recentReels: [...], recentVideos: [...] }
      const fieldKey = Object.keys(fields)[0] // e.g. 'recentShorts'
      const posts = Array.isArray(contentData[fieldKey]) ? contentData[fieldKey] : []
      if (posts.length === 0) return null

      const post = posts[0]
      const postId = post.contentId || post.id || null
      // YouTube doesn't return coverImageUrl — construct from contentId
      const coverImage = post.coverImageUrl || post.thumbnailUrl || post.thumbnail
        || (platform === 'youtube' && postId ? `https://img.youtube.com/vi/${postId}/hqdefault.jpg` : null)
      return {
        contentId: postId,
        coverImageUrl: coverImage,
        description: post.description || post.title || post.caption || null,
        publishTime: post.publishTime || post.createdAt || post.timestamp || null,
        likes: post.likes ?? post.likeCount ?? null,
        comments: post.comments ?? post.commentCount ?? null,
        views: post.views ?? post.viewCount ?? post.playCount ?? null,
        contentUrl: buildContentUrl(platform, post.contentId || post.id || '', handle),
        label: CONTENT_LABEL[platform] || 'Latest Post',
      }
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      console.warn(`[content-detail] Failed for ${platform}:${handle}:`, err)
      return null
    }
  }
  return null
}

// POST /api/discovery/creator-content
// Batch-fetch latest posts for up to 25 creators.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id

  const body = await req.json().catch(() => null)
  const raw: { platform: string; handle: string }[] = body?.creators
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ message: 'creators array required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Deduplicate and limit
  const unique = raw
    .filter((c) => c.platform && c.handle && PLATFORM_PATH[c.platform])
    .map((c) => ({ platform: c.platform, handle: c.handle.replace(/^@/, '').toLowerCase() }))
    .filter((c, i, arr) => arr.findIndex((x) => x.platform === c.platform && x.handle === c.handle) === i)
    .slice(0, 25)

  // Check cache (within 24h TTL)
  const cutoff = new Date(Date.now() - CACHE_TTL_MS)
  const cached = await prisma.creatorContentCache.findMany({
    where: {
      OR: unique.map((c) => ({ platform: c.platform, handle: c.handle })),
      fetchedAt: { gte: cutoff },
    },
  }).catch(() => [] as any[])

  const cachedMap = new Map<string, any>()
  for (const c of cached) {
    cachedMap.set(`${c.platform}:${c.handle}`, c.data)
  }

  // Determine which need fetching
  const toFetch = unique.filter((c) => !cachedMap.has(`${c.platform}:${c.handle}`))

  // Fetch all uncached in parallel
  const fetchResults = await Promise.allSettled(
    toFetch.map(async (c) => {
      const content = await fetchContentForCreator(c.platform, c.handle, userId)
      // Cache even null results to avoid re-fetching within TTL
      await prisma.creatorContentCache.upsert({
        where: { platform_handle: { platform: c.platform, handle: c.handle } },
        create: { platform: c.platform, handle: c.handle, data: content ?? {} },
        update: { data: content ?? {}, fetchedAt: new Date() },
      }).catch(() => {})
      return { key: `${c.platform}:${c.handle}`, content }
    }),
  )

  // Build response map
  const contentMap: Record<string, any> = {}
  for (const [key, value] of cachedMap.entries()) {
    if (value && Object.keys(value).length > 0) contentMap[key] = value
  }
  for (const result of fetchResults) {
    if (result.status === 'fulfilled' && result.value.content) {
      contentMap[result.value.key] = result.value.content
    }
  }

  // Pre-warm the image cache for TikTok cover images (signed URLs expire).
  // This runs in the background — don't block the response.
  const tiktokCovers = Object.values(contentMap)
    .filter((c: any) => c?.coverImageUrl?.includes('tiktokcdn.com'))
    .map((c: any) => c.coverImageUrl as string)
  if (tiktokCovers.length > 0) {
    import('@/lib/avatar-cache').then(({ warmCache }) => {
      Promise.allSettled(tiktokCovers.map((url) => warmCache(url)))
        .catch(() => {})
    })
  }

  return NextResponse.json({
    content: contentMap,
    cached: cached.length,
    fetched: toFetch.length,
  })
}
