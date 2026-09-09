import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clubConfigured, clubAnalytics, type ClubPlatform } from '@/lib/influencers-club'
import { deductCredits, hasPriorDeduction, refundDeduction } from '@/lib/credits'
import { getEffectiveTier } from '@/lib/subscription'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits, hasPriorCharge } from '@/lib/metering'
import { walletRefund } from '@/lib/wallet'

// TEMP: GET /api/discovery/club-analytics?platform=&handle= — full audience
// analytics (demographics, languages, geo) for a club creator, brand-only.
// Charged once per creator via the "analytics" feature (tier-gated + priced
// in config); repeat views of the same creator are free (stable reference).
// Remove together with the other TEMP influencers.club pieces.

const CLUB_PLATFORMS: ClubPlatform[] = ['instagram', 'youtube', 'tiktok']

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

  if (!clubConfigured()) {
    return NextResponse.json(
      { message: 'Influencers Club API not configured', code: 'UPSTREAM_ERROR' },
      { status: 503 }
    )
  }

  const platform = req.nextUrl.searchParams.get('platform') as ClubPlatform
  const handle = req.nextUrl.searchParams.get('handle')?.trim()
  if (!CLUB_PLATFORMS.includes(platform) || !handle) {
    return NextResponse.json({ message: 'platform and handle required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const ref = `analytics:${platform}:${handle.toLowerCase()}`
  let alreadyCharged: boolean

  if (CREDIT_SYSTEM_ENABLED) {
    alreadyCharged = await hasPriorCharge(userId, ref)
    if (!alreadyCharged) {
      const charge = await chargeCredits(userId, 'analytics', ref)
      if (!charge.ok) {
        return NextResponse.json(charge.body, { status: charge.status })
      }
    }
  } else {
    alreadyCharged = await hasPriorDeduction(userId, ref)
    if (!alreadyCharged) {
      const tier = await getEffectiveTier(userId)
      const deduction = await deductCredits(userId, tier, 'analytics', ref)
      if (!deduction.ok) {
        return NextResponse.json(
          {
            message: 'Not enough AI credits for full analytics. Buy a credit pack or wait for your monthly allowance to reset.',
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
    const analytics = await clubAnalytics(platform, handle)
    return NextResponse.json(analytics)
  } catch (err: any) {
    // Don't charge for a failed first fetch
    if (!alreadyCharged) {
      try {
        if (CREDIT_SYSTEM_ENABLED) await walletRefund(userId, ref)
        else await refundDeduction(userId, ref)
      } catch (refundErr) {
        console.error('Credit refund failed:', refundErr)
      }
    }
    return NextResponse.json(
      { message: err?.message || 'Analytics failed', code: 'UPSTREAM_ERROR' },
      { status: 502 }
    )
  }
}
