export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userType = (session.user as any).userType
    const subscriptionTier = (session.user as any).subscriptionTier || 'FREE'

    if (subscriptionTier === 'PRO') {
      return NextResponse.json({ error: 'Already on Pro plan' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    // Get or create Stripe customer
    let stripeCustomerId: string | null = null

    if (userType === 'BRAND' || userType === 'ADMIN') {
      const brand = await prisma.brandProfile.findUnique({ where: { userId } })
      stripeCustomerId = brand?.stripeCustomerId || null
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user?.email || undefined,
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
        email: user?.email || undefined,
        metadata: { userId, userType },
      })
      stripeCustomerId = customer.id
    }

    // Look up or create the Pro price
    // Search for existing product named "Overseed Pro"
    const products = await stripe.products.search({
      query: "name:'Overseed Pro'",
    })

    let priceId: string

    if (products.data.length > 0 && products.data[0].default_price) {
      priceId = typeof products.data[0].default_price === 'string'
        ? products.data[0].default_price
        : products.data[0].default_price.id
    } else {
      // Create the product and price
      const product = await stripe.products.create({
        name: 'Overseed Pro',
        description: 'Pro subscription for Overseed platform',
      })

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 999, // $9.99
        currency: 'usd',
        recurring: { interval: 'month' },
      })

      priceId = price.id
    }

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
      metadata: { userId, userType },
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
