export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { SUBSCRIPTION_PLANS, CURRENCY, type PaidTier, type BillingInterval } from '@/lib/pricing'

/** Find or create the Stripe price for a plan/interval (idempotent by product name). */
async function resolvePriceId(tier: PaidTier, interval: BillingInterval): Promise<string> {
  const plan = SUBSCRIPTION_PLANS[tier]
  const unitAmount = interval === 'year' ? plan.annual : plan.monthly

  const products = await stripe.products.search({
    query: `name:'${plan.productName}'`,
  })
  let productId = products.data[0]?.id
  if (!productId) {
    const product = await stripe.products.create({
      name: plan.productName,
      description: `Overseed subscription — ${plan.productName}`,
      metadata: { tier },
    })
    productId = product.id
  }

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  const existing = prices.data.find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === unitAmount &&
      p.currency === CURRENCY,
  )
  if (existing) return existing.id

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: CURRENCY,
    recurring: { interval },
    metadata: { tier },
  })
  return price.id
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userType = (session.user as any).userType

    const body = await req.json().catch(() => ({}))
    const tier = (body?.tier || 'CAMPAIGN_PLUS') as PaidTier
    const interval: BillingInterval = body?.interval === 'year' ? 'year' : 'month'
    if (!SUBSCRIPTION_PLANS[tier]) {
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
    }

    const currentTier = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, proTrialEndsAt: true, email: true },
    })
    // Paying users can't re-subscribe to the same tier (trials may convert).
    if (currentTier?.subscriptionTier === tier && !currentTier?.proTrialEndsAt) {
      return NextResponse.json({ error: 'Already on this plan' }, { status: 400 })
    }

    // Get or create Stripe customer
    let stripeCustomerId: string | null = null

    if (userType === 'BRAND' || userType === 'ADMIN') {
      const brand = await prisma.brandProfile.findUnique({ where: { userId } })
      stripeCustomerId = brand?.stripeCustomerId || null
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: currentTier?.email || undefined,
          metadata: { userId, userType },
        })
        stripeCustomerId = customer.id
        if (brand) {
          await prisma.brandProfile.update({
            where: { id: brand.id },
            data: { stripeCustomerId },
          })
        }
      }
    } else {
      // For influencers, create a one-off customer (separate from Connect account)
      const customer = await stripe.customers.create({
        email: currentTier?.email || undefined,
        metadata: { userId, userType },
      })
      stripeCustomerId = customer.id
    }

    const priceId = await resolvePriceId(tier, interval)

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const dashboardPath = userType === 'BRAND' || userType === 'ADMIN' ? '/dashboard/brand' : '/dashboard/influencer'

    // Create Checkout Session for subscription
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}${dashboardPath}?upgraded=true`,
      cancel_url: `${baseUrl}/dashboard/upgrade?cancelled=true`,
      metadata: { userId, userType, tier },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error('[Stripe Subscribe]', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
