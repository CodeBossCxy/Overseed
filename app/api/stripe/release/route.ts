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

    if (userType !== 'BRAND' && userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only brands can release payments' },
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

    // Find the application with payment and influencer
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

    // Brand must own the campaign
    if (application.campaign.brand.userId !== userId) {
      return NextResponse.json(
        { error: 'You do not own this campaign' },
        { status: 403 },
      )
    }

    // Payment must exist with status HELD
    if (!application.payment) {
      return NextResponse.json(
        { error: 'No payment found for this application' },
        { status: 400 },
      )
    }

    if (application.payment.status !== 'HELD') {
      return NextResponse.json(
        { error: 'Payment must be in HELD status to release' },
        { status: 400 },
      )
    }

    // Creator must have completed Stripe onboarding
    const creator = application.influencer
    if (!creator.stripeConnectId || !creator.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: 'Creator has not completed Stripe onboarding' },
        { status: 400 },
      )
    }

    // Create the transfer to the creator
    const creatorPayoutInCents = Math.round(
      Number(application.payment.creatorPayout) * 100,
    )

    const transfer = await stripe.transfers.create({
      amount: creatorPayoutInCents,
      currency: application.payment.currency,
      destination: creator.stripeConnectId,
      transfer_group: application.payment.id,
    })

    // Update payment record
    await prisma.payment.update({
      where: { id: application.payment.id },
      data: {
        status: 'RELEASED',
        stripeTransferId: transfer.id,
        releasedAt: new Date(),
      },
    })

    // Update application status to COMPLETED
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[Stripe Release]', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
