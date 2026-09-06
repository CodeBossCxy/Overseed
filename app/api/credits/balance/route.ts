export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { getWalletBalance, getPlanConfig } from '@/lib/wallet'
import { getCreditSummary } from '@/lib/credits'
import { getEffectiveTier } from '@/lib/subscription'

// GET /api/credits/balance — wallet breakdown by bucket + next expiry.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id

  const tier = await getEffectiveTier(userId)
  const plan = await getPlanConfig(tier)
  const cycleCredits = plan.baseCredits + plan.bonusCredits

  if (!CREDIT_SYSTEM_ENABLED) {
    // Legacy shape mapped onto the v4 contract so clients can ship early.
    const summary = await getCreditSummary(userId, tier)
    return NextResponse.json({
      subscription: summary.monthlyRemaining,
      purchased: summary.purchased,
      total: summary.total,
      nextExpiry: null,
      cycleCredits,
      legacy: true,
    })
  }

  const balance = await getWalletBalance(userId)
  return NextResponse.json({ ...balance, cycleCredits })
}
