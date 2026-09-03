import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEffectiveTier } from '@/lib/subscription'
import { getCreditSummary } from '@/lib/credits'

// Pricing v3: usage is credit-based. `used`/`limit`/`percentage` keep the old
// response shape (now in credits) so existing UI meters keep working;
// `purchased`/`total` are additive.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const tier = await getEffectiveTier(userId)
  const summary = await getCreditSummary(userId, tier)

  const used = Math.min(summary.monthlyUsed, summary.monthlyAllowance)
  const limit = summary.monthlyAllowance
  const percentage = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 100

  return NextResponse.json({
    used,
    limit,
    percentage,
    purchased: summary.purchased,
    total: summary.total,
    unit: 'credits',
  })
}
