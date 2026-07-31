import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clubConfigured, clubEnrich, type ClubPlatform } from '@/lib/influencers-club'

// TEMP: GET /api/discovery/club-enrich?platform=&handle= — influencers.club
// creator detail (1 credit per uncached lookup), brand-only. Contact info is
// stripped server-side in lib/influencers-club.ts. Remove together with the
// other TEMP influencers.club pieces.

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
    return NextResponse.json(
      { message: 'Influencers Club API not configured' },
      { status: 503 }
    )
  }

  const platform = req.nextUrl.searchParams.get('platform') as ClubPlatform
  const handle = req.nextUrl.searchParams.get('handle')?.trim()
  if (!CLUB_PLATFORMS.includes(platform) || !handle) {
    return NextResponse.json({ message: 'platform and handle required' }, { status: 400 })
  }

  try {
    const detail = await clubEnrich(platform, handle)
    return NextResponse.json(detail)
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'Enrichment failed' },
      { status: 502 }
    )
  }
}
