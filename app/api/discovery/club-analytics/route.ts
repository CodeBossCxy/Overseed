import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { type ClubPlatform } from '@/lib/influencers-club'
import { discoveryAnalytics } from '@/lib/discovery-provider'

// TEMP: GET /api/discovery/club-analytics?platform=&handle= — full audience
// analytics (demographics, languages, geo) for a club creator, brand-only.
// Charged once per creator via the "analytics" feature (tier-gated + priced
// in config); repeat views of the same creator are free (stable reference).
// Remove together with the other TEMP influencers.club pieces.

const CLUB_PLATFORMS: ClubPlatform[] = ['instagram', 'youtube', 'tiktok', 'twitter', 'onlyfans', 'twitch']

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

  const platform = req.nextUrl.searchParams.get('platform') as ClubPlatform
  const handle = req.nextUrl.searchParams.get('handle')?.trim()
  if (!CLUB_PLATFORMS.includes(platform) || !handle) {
    return NextResponse.json({ message: 'platform and handle required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Analytics is now free at the top level — individual audience sections
  // (gender, age, country, brand collaborations) are billed per-unlock via
  // the /api/discovery/creator-unlock endpoint.

  // Serve from cache if this user already viewed this creator's analytics
  const cacheKey = { userId, kind: 'analytics', platform, handle: handle.toLowerCase() }
  try {
    const cached = await prisma.discoveryViewCache.findUnique({
      where: { userId_kind_platform_handle: cacheKey },
    })
    if (cached) {
      return NextResponse.json(cached.data)
    }
  } catch {
    // Cache miss or DB error — proceed with live fetch
  }

  try {
    const analytics = await discoveryAnalytics(platform, handle, { logUserId: userId })
    // Cache the result for future free views
    try {
      await prisma.discoveryViewCache.upsert({
        where: { userId_kind_platform_handle: cacheKey },
        create: { ...cacheKey, data: analytics },
        update: { data: analytics, fetchedAt: new Date() },
      })
    } catch {
      // Caching is best-effort; don't fail the response
    }
    return NextResponse.json(analytics)
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'Analytics failed', code: 'UPSTREAM_ERROR' },
      { status: 502 }
    )
  }
}
