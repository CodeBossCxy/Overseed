export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, PLATFORM_FEE_PERCENT } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userType = (session.user as any).userType

    if (userType !== 'BRAND' && userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only brands can create payments' },
        { status: 403 },
      )
    }

    const { applicationId } = await req.json()
    if (!applicationId) {
      return NextResponse.json(
        { error: 'applicationId is required' },
        { status: 400 },
      )
    }

    // Find the application with campaign and influencer
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        campaign: { include: { brand: true } },
        influencer: true,
        payment: true,
      },
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 },
      )
    }

    // Verify the brand owns this campaign
    if (application.campaign.brand.userId !== userId) {
      return NextResponse.json(
        { error: 'You do not own this campaign' },
        { status: 403 },
      )
    }

    // Application must be APPROVED
    if (application.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Application must be in APPROVED status' },
        { status: 400 },
      )
    }

    // Must not already have a payment
    if (application.payment) {
      return NextResponse.json(
        { error: 'Payment already exists for this application' },
        { status: 400 },
      )
    }

    // Get or create Stripe Customer for the brand
    const brandProfile = application.campaign.brand
    let stripeCustomerId = brandProfile.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: application.campaign.brand.contactEmail || undefined,
        metadata: { brandProfileId: brandProfile.id, userId },
      })

      stripeCustomerId = customer.id

      await prisma.brandProfile.update({
        where: { id: brandProfile.id },
        data: { stripeCustomerId },
      })
    }

    // Calculate amounts
    const proposedRate = application.proposedRate
      ? Number(application.proposedRate)
      : null
    const fallbackRate = application.campaign.paymentMin
      ? Number(application.campaign.paymentMin)
      : null

    const amount = proposedRate || fallbackRate
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'No valid payment amount found' },
        { status: 400 },
      )
    }

    const amountInCents = Math.round(amount * 100)
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT) / 100
    const creatorPayout = amount - platformFee

    // Create the Payment record first so we can reference its ID in metadata
    const payment = await prisma.payment.create({
      data: {
        applicationId,
        amount,
        platformFee,
        creatorPayout,
        currency: 'usd',
        status: 'PENDING',
      },
    })

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: stripeCustomerId,
      metadata: {
        applicationId,
        paymentId: payment.id,
      },
    })

    // Save the PaymentIntent ID on the payment record
    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
    })
  } catch (error: any) {
    console.error('[Stripe Checkout]', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
