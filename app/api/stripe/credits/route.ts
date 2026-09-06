export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { CREDIT_PACKS, CURRENCY, type CreditPackId } from '@/lib/pricing'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { getEffectiveTier, isPaidTier } from '@/lib/subscription'

// POST /api/stripe/credits — one-time checkout for a credit pack.
// Fulfilment happens in the webhook (checkout.session.completed, mode=payment).
//
// Pricing v4 rules:
// - Packs come from credit_pack_config (no names; "¥X / N credits").
// - Paid subscribers may buy any active pack.
// - FREE users may buy the smallest (freeUserEligible) pack exactly once;
//   after that they get an upgrade prompt instead (409 UPGRADE_REQUIRED).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const body = await req.json().catch(() => ({}))
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    // Legacy v3 named pack ids still resolve (rollback safety); the rebuilt
    // pricing page sends credit_pack_config ids.
    const requested = String(body?.pack || '')
    const legacyPack = CREDIT_PACKS[requested as CreditPackId]
    if (!CREDIT_SYSTEM_ENABLED && legacyPack) {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: CURRENCY,
              unit_amount: legacyPack.amount,
              product_data: {
                name: legacyPack.label,
                description: `${legacyPack.credits} Overseed AI credits`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/pricing/brand?credits_purchased=true`,
        cancel_url: `${baseUrl}/pricing/brand?credits_cancelled=true`,
        metadata: { userId, packId: requested, packCredits: String(legacyPack.credits) },
      })
      return NextResponse.json({ url: checkoutSession.url })
    }

    // DB-config packs (used in both modes; the webhook decides between the
    // legacy pool grant and the v4 lot grant based on the flag).
    const pack = await prisma.creditPackConfig.findUnique({ where: { id: requested } })
    if (!pack || !pack.active) {
      return NextResponse.json({ error: 'Unknown credit pack' }, { status: 400 })
    }

    const tier = await getEffectiveTier(userId)
    // Eligibility rules are a v4 policy; v3 sold packs to everyone.
    if (CREDIT_SYSTEM_ENABLED && !isPaidTier(tier)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { freePackPurchasedAt: true },
      })
      const eligible = pack.freeUserEligible && !user?.freePackPurchasedAt
      if (!eligible) {
        return NextResponse.json(
          {
            error:
              'Credit packs are for subscribers. Subscribe to a plan to buy credits — 订阅每credit低至 ¥0.11，加购 ¥0.13起，升级套餐更划算。',
            code: 'UPGRADE_REQUIRED',
          },
          { status: 409 },
        )
      }
    }

    const totalCredits = pack.baseCredits + pack.bonusCredits
    const priceLabel = `¥${(pack.priceCents / 100).toLocaleString('en-US')}`
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            unit_amount: pack.priceCents,
            product_data: {
              name: `${priceLabel} / ${totalCredits} credits`,
              description: `Overseed credits (valid 12 months)${pack.bonusCredits > 0 ? ` — ${pack.baseCredits} + ${pack.bonusCredits} bonus` : ''}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/pricing/brand?credits_purchased=true`,
      cancel_url: `${baseUrl}/pricing/brand?credits_cancelled=true`,
      metadata: {
        userId,
        packConfigId: pack.id,
        packCredits: String(totalCredits),
        freePack: isPaidTier(tier) ? 'false' : 'true',
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error('[Stripe Credits]', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
