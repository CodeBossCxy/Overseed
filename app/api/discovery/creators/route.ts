import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeLocalCreatorDiscovery } from '@/lib/discovery'
import { clubConfigured, clubShowcase } from '@/lib/influencers-club'
import { youtubeConfigured, youtubeBrowseCreators } from '@/lib/youtube'

// GET /api/discovery/creators — brand-only creator database browse.
// Registered Overseed creators come first, followed by a fixed influencers.club
// "showcase" (top 10 Instagram creators who are also on YouTube + TikTok).
// The showcase is fetched from the club API exactly once (~0.1 vendor
// credits) and permanently cached — browsing never charges brands.

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

  // Curated extras apply to the default view only: first page, no country
  // filter (curated creators' countries are mostly unknown). YouTube (the
  // default pill) gets the YouTube-API list ranked by subscribers desc;
  // Instagram keeps the permanently cached club showcase.
  const platform = (params.get('platform') || '').toLowerCase()
  const offset = Number(params.get('offset') || 0)
  const defaultView = offset === 0 && !params.get('country')?.trim()
  const wantYoutube = defaultView && (!platform || platform === 'youtube') && youtubeConfigured()
  const wantShowcase = defaultView && platform === 'instagram' && clubConfigured()

  if (!wantYoutube && !wantShowcase) return NextResponse.json(local)

  try {
    const curated = wantYoutube ? await youtubeBrowseCreators() : await clubShowcase()
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
