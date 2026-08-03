import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clubConfigured, clubSearch, type ClubPlatform } from '@/lib/influencers-club'
import { safeLocalCreatorDiscovery } from '@/lib/discovery'

// TEMP: GET /api/discovery/club-search — influencers.club-backed creator
// search, brand-only like /api/discovery/search. The API key never leaves
// the server. Remove together with lib/influencers-club.ts and the
// "Data source" picker in DiscoverPanel.tsx.

const CLUB_PLATFORMS: ClubPlatform[] = ['instagram', 'youtube', 'tiktok']

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!brand) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  if (!clubConfigured()) {
    return NextResponse.json(await safeLocalCreatorDiscovery(req.nextUrl.searchParams, true))
  }

  const params = req.nextUrl.searchParams
  const platform = (params.get('platform') || 'instagram') as ClubPlatform
  if (!CLUB_PLATFORMS.includes(platform)) {
    return NextResponse.json({ message: 'Unsupported platform' }, { status: 400 })
  }

  const num = (key: string) => {
    const v = params.get(key)
    if (!v) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  try {
    const result = await clubSearch({
      platform,
      query: params.get('q')?.trim() || undefined,
      country: params.get('country')?.trim() || undefined,
      minFollowers: num('min_followers'),
      maxFollowers: num('max_followers'),
      // Small pages: influencers.club bills 0.01 credits per returned creator
      limit: Math.min(num('limit') ?? 10, 25),
      page: num('page') ?? 0,
    })
    return NextResponse.json(result)
  } catch (err: any) {
    console.warn('Influencers Club search unavailable; using Overseed creator index:', err?.message)
    return NextResponse.json(await safeLocalCreatorDiscovery(params, true))
  }
}
