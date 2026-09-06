import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clubConfigured, clubEnrich, type ClubPlatform } from '@/lib/influencers-club'
import { deductCredits, hasPriorDeduction, refundDeduction } from '@/lib/credits'
import { getEffectiveTier } from '@/lib/subscription'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits, hasPriorCharge } from '@/lib/metering'
import { walletRefund } from '@/lib/wallet'

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

  // Profile view is charged per creator; repeat views of the same creator by
  // the same user are free (dedupe by stable reference).
  const viewRef = `profile_view:${platform}:${handle.toLowerCase()}`
  let alreadyViewed: boolean

  if (CREDIT_SYSTEM_ENABLED) {
    // Pricing v4: wallet charge (config price) + tier/verification gates.
    alreadyViewed = await hasPriorCharge(userId, viewRef)
    if (!alreadyViewed) {
      const charge = await chargeCredits(userId, 'profile_view', viewRef)
      if (!charge.ok) {
        return NextResponse.json(charge.body, { status: charge.status })
      }
    }
  } else {
    // Pricing v3 (legacy): 12 credits from the monthly/purchased pools.
    alreadyViewed = await hasPriorDeduction(userId, viewRef)
    if (!alreadyViewed) {
      const tier = await getEffectiveTier(userId)
      const deduction = await deductCredits(userId, tier, 'profile_view', viewRef)
      if (!deduction.ok) {
        return NextResponse.json(
          {
            message: 'Not enough AI credits to view this creator profile. Buy a credit pack or wait for your monthly allowance to reset.',
            code: 'INSUFFICIENT_CREDITS',
            required: deduction.cost,
            available: deduction.available,
          },
          { status: 402 }
        )
      }
    }
  }

  try {
    const detail = await clubEnrich(platform, handle)
    return NextResponse.json(detail)
  } catch (err: any) {
    // Don't charge for a failed first view
    if (!alreadyViewed) {
      try {
        if (CREDIT_SYSTEM_ENABLED) await walletRefund(userId, viewRef)
        else await refundDeduction(userId, viewRef)
      } catch (refundErr) {
        console.error('Credit refund failed:', refundErr)
      }
    }
    return NextResponse.json(
      { message: err?.message || 'Enrichment failed' },
      { status: 502 }
    )
  }
}
