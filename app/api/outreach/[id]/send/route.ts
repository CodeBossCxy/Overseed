import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits, hasPriorCharge, gateFeature } from '@/lib/metering'
import { sendOutreachBatch, type OutreachEmailInput } from '@/lib/outreach-email'
import { markCreatorContacted } from '@/lib/outreach-ai'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const { id } = await params

    const campaign = await prisma.outreachCampaign.findFirst({
      where: { id, userId },
    })

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
    }

    if (campaign.status !== 'READY') {
      return NextResponse.json(
        { message: 'Campaign must be in READY status to send', code: 'INVALID_STATUS' },
        { status: 409 }
      )
    }

    const [brand, user] = await Promise.all([
      prisma.brandProfile.findUnique({ where: { userId }, select: { companyName: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    ])

    if (!brand || !user?.email) {
      return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    const pendingRecipients = await prisma.outreachRecipient.findMany({
      where: { outreachCampaignId: id, status: 'PENDING', email: { not: null } },
    })

    if (pendingRecipients.length === 0) {
      return NextResponse.json(
        { message: 'No pending recipients with email addresses', code: 'NO_RECIPIENTS' },
        { status: 400 }
      )
    }

    await prisma.outreachCampaign.update({
      where: { id },
      data: { status: 'SENDING' },
    })

    // Billing: pre-flight credit check for all recipients before sending any
    let totalCreditsCost = 0
    const chargeResults: Map<string, { cost: number; refund: () => Promise<void> } | null> = new Map()

    if (CREDIT_SYSTEM_ENABLED) {
      for (const recipient of pendingRecipients) {
        const unlockRef = `profile_view:${recipient.platform}:${recipient.handle.toLowerCase()}`
        const alreadyUnlocked = await hasPriorCharge(userId, unlockRef)

        if (alreadyUnlocked) {
          const gate = await gateFeature(userId, 'outreach')
          if (!gate.ok) {
            // Roll back any charges made so far
            for (const [, charge] of chargeResults) {
              if (charge) await charge.refund().catch(() => {})
            }
            await prisma.outreachCampaign.update({ where: { id }, data: { status: 'READY' } })
            return NextResponse.json(gate.body, { status: gate.status })
          }
          chargeResults.set(recipient.id, null)
        } else {
          const massRef = `mass_outreach:${campaign.id}:${recipient.handle.toLowerCase()}`
          const charge = await chargeCredits(userId, 'outreach', massRef)
          if (!charge.ok) {
            // Roll back any charges made so far
            for (const [, prior] of chargeResults) {
              if (prior) await prior.refund().catch(() => {})
            }
            await prisma.outreachCampaign.update({ where: { id }, data: { status: 'READY' } })
            return NextResponse.json(charge.body, { status: charge.status })
          }
          totalCreditsCost += charge.cost
          chargeResults.set(recipient.id, { cost: charge.cost, refund: charge.refund })
        }
      }
    }

    const brandName = brand.companyName || user.name || 'A brand on Overseed'

    const inputs: OutreachEmailInput[] = pendingRecipients.map((r) => ({
      recipientEmail: r.email!,
      recipientName: r.displayName,
      brandName,
      brandEmail: user.email!,
      briefMessage: campaign.briefMessage,
      platform: r.platform,
      handle: r.handle,
    }))

    const results = await sendOutreachBatch(inputs)

    let totalSent = 0
    let totalFailed = 0

    await Promise.all(
      pendingRecipients.map(async (recipient) => {
        const result = results.get(recipient.handle)
        const success = result?.success ?? false

        await prisma.outreachRecipient.update({
          where: { id: recipient.id },
          data: {
            status: success ? 'SENT' : 'FAILED',
            sentAt: success ? new Date() : null,
            errorMessage: success ? null : (result?.error ?? 'Unknown error'),
          },
        })

        if (success) {
          totalSent++
          await markCreatorContacted(recipient.creatorProfileId).catch(() => {})

          await prisma.conversation.create({
            data: {
              outreachRecipientId: recipient.id,
              participants: {
                create: [{ userId }],
              },
              messages: {
                create: [
                  {
                    senderId: userId,
                    content: campaign.briefMessage,
                    isSystemMessage: true,
                    messageType: 'outreach',
                  },
                ],
              },
            },
          })
        } else {
          totalFailed++
          // Refund credits for failed sends
          if (CREDIT_SYSTEM_ENABLED) {
            const charge = chargeResults.get(recipient.id)
            if (charge) await charge.refund().catch(() => {})
          }
        }
      })
    )

    const finalStatus = totalSent === 0 ? 'FAILED' : 'COMPLETED'

    await prisma.outreachCampaign.update({
      where: { id },
      data: {
        status: finalStatus,
        totalSent,
        totalFailed,
        creditsCost: totalCreditsCost,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ totalSent, totalFailed, creditsCost: totalCreditsCost })
  } catch (err: any) {
    console.error('POST /api/outreach/[id]/send error:', err)
    return NextResponse.json({ message: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
