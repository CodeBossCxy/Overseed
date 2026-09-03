export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { CREDIT_PACKS, CURRENCY, type CreditPackId } from '@/lib/pricing'

// POST /api/stripe/credits — one-time checkout for an AI credit pack.
// Fulfilment happens in the webhook (checkout.session.completed, mode=payment)
// via metadata { userId, packCredits }.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const body = await req.json().catch(() => ({}))
    const packId = body?.pack as CreditPackId
    const pack = CREDIT_PACKS[packId]
    if (!pack) {
      return NextResponse.json({ error: 'Unknown credit pack' }, { status: 400 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            unit_amount: pack.amount,
            product_data: {
              name: pack.label,
              description: `${pack.credits} Overseed AI credits`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/pricing/brand?credits_purchased=true`,
      cancel_url: `${baseUrl}/pricing/brand?credits_cancelled=true`,
      metadata: { userId, packId, packCredits: String(pack.credits) },
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
