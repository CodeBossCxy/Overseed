import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeLocalCreatorDiscovery } from '@/lib/discovery'
import { discoverySearch, getProvider } from '@/lib/discovery-provider'
import { youtubeConfigured, youtubeBrowseCreators } from '@/lib/youtube'

// GET /api/discovery/creators — brand-only creator database browse.
// Registered Overseed creators come first, followed by curated extras:
// YouTube gets the YouTube-API list; Instagram/TikTok get a CreatorDB
// top-creators query (sorted by followers, cached in club_search_cache).

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!brand) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const local = await safeLocalCreatorDiscovery(params)

  // Curated extras apply to the default view only: first page, no country filter.
  const platform = (params.get('platform') || '').toLowerCase()
  const offset = Number(params.get('offset') || 0)
  const defaultView = offset === 0 && !params.get('country')?.trim()
  const wantYoutube = defaultView && (!platform || platform === 'youtube') && youtubeConfigured()
  const wantCurated = defaultView && ['instagram', 'tiktok'].includes(platform) && getProvider() === 'creatordb'

  if (!wantYoutube && !wantCurated) return NextResponse.json(local)

  try {
    let curated: { results: any[] }
    if (wantYoutube) {
      curated = await youtubeBrowseCreators()
    } else {
      // Use CreatorDB to fetch top creators by followers for the browse view.
      // Check cache first to avoid unnecessary API calls.
      const cacheKey = `browse:${platform}:top20`
      const cached = await prisma.clubSearchCache.findUnique({ where: { key: cacheKey } }).catch(() => null)
      if (cached?.data && Array.isArray((cached.data as any).results)) {
        curated = cached.data as any
      } else {
        curated = await discoverySearch({
          platform: platform as any,
          limit: 20,
          page: 0,
          logUserId: userId,
        })
        // Cache for future browse views (best-effort)
        if (curated.results?.length > 0) {
          await prisma.clubSearchCache.upsert({
            where: { key: cacheKey },
            create: { key: cacheKey, data: curated as any },
            update: { data: curated as any },
          }).catch(() => {})
        }
      }
    }

    const min = Number(params.get('min_followers') || 0)
    const max = Number(params.get('max_followers') || 0)
    const seen = new Set(
      local.results.map((r: any) => `${r.platform}:${(r.handle || '').toLowerCase()}`)
    )
    const extras = (curated.results as any[]).filter((r) => {
      if (!r.handle || seen.has(`${r.platform}:${r.handle.toLowerCase()}`)) return false
      if (min && (r.follower_count ?? 0) < min) return false
      if (max && (r.follower_count ?? 0) > max) return false
      return true
    })
    return NextResponse.json({
      ...local,
      results: [...local.results, ...extras],
      cache_hits: (local.cache_hits ?? 0) + extras.length,
    })
  } catch (err: any) {
    // Curated lists are best-effort decoration; browse must never fail
    // because of them.
    console.warn('Discovery curated list unavailable:', err?.message)
    return NextResponse.json(local)
  }
}
