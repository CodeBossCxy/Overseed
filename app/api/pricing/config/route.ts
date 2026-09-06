export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getPlanConfigs, getActivePacks, getCreditPrices } from '@/lib/wallet'

// GET /api/pricing/config — public, config-driven pricing for the pricing page.
export async function GET() {
  const [planMap, packs, prices] = await Promise.all([
    getPlanConfigs(),
    getActivePacks(),
    getCreditPrices(),
  ])

  const plans = Array.from(planMap.values()).map((p) => ({
    tier: p.tier,
    priceMonthly: p.priceMonthly,
    priceAnnual: p.priceAnnual,
    compareAtMonthly: p.compareAtMonthly,
    baseCredits: p.baseCredits,
    bonusCredits: p.bonusCredits,
  }))

  return NextResponse.json({
    plans,
    packs: packs.map((p) => ({
      id: p.id,
      priceCents: p.priceCents,
      baseCredits: p.baseCredits,
      bonusCredits: p.bonusCredits,
      freeUserEligible: p.freeUserEligible,
    })),
    prices,
  })
}
