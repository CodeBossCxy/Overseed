import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'

// TEMP (beta): "Founding Beta Challenge" progress for the V2 brand pricing
// page. Five goals, to be completed within the first 30 days of the account:
//   feedback  — 5 beta feedbacks
//   legit     — company profile verified (brandVerificationStatus APPROVED)
//   launch    — 3 published campaigns
//   outreach  — managed outreach to 10 creators
//   connect   — 1 creator moved into a collaboration
// Rewards (idempotent one-time lots, 1-month validity):
//   3 of 5 goals → 450 credits; all 5 → another 450 (900 total).
// Separate "First Collaboration Bonus" (+100, no 30-day window): first
// real collaboration started through Overseed.

const CHALLENGE_WINDOW_DAYS = 30

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id

  const [user, brand] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.brandProfile.findUnique({
      where: { userId },
      select: { id: true, brandVerificationStatus: true },
    }),
  ])

  const [feedback, campaigns, campaignOutreach, directOutreach, collaborations] =
    await Promise.all([
      prisma.betaFeedback.count({ where: { userId } }),
      brand
        ? prisma.campaign.count({
            where: { brandId: brand.id, publishedAt: { not: null } },
          })
        : 0,
      brand
        ? prisma.campaignOutreach.count({
            where: { campaign: { brandId: brand.id }, requestedAt: { not: null } },
          })
        : 0,
      // Direct creator outreach sends (logged by club-contact on success)
      prisma.pageViewEvent.count({ where: { userId, path: 'action:club-outreach' } }),
      // "Creator expresses interest + brand confirms" = a collaboration
      // exists (any non-cancelled status; content/payment not required)
      brand
        ? prisma.collaboration.count({
            where: { brandId: brand.id, status: { not: 'CANCELLED' } },
          })
        : 0,
    ])

  const goals = {
    feedback: { count: feedback, target: 5 },
    legit: { count: brand?.brandVerificationStatus === 'APPROVED' ? 1 : 0, target: 1 },
    launch: { count: campaigns, target: 3 },
    outreach: { count: campaignOutreach + directOutreach, target: 10 },
    connect: { count: collaborations, target: 1 },
  }
  const completedCount = Object.values(goals).filter((g) => g.count >= g.target).length

  const deadline = user
    ? new Date(user.createdAt.getTime() + CHALLENGE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    : null
  const withinWindow = deadline ? new Date() <= deadline : false

  let reward450Granted = false
  let reward900Granted = false
  let firstCollabGranted = false

  if (CREDIT_SYSTEM_ENABLED) {
    try {
      const { walletGrant, addMonths } = await import('@/lib/wallet')
      const expiresAt = addMonths(new Date(), 1)
      const grant = (reference: string, credits: number, note: string) =>
        walletGrant(userId, {
          bucket: 'PURCHASED',
          source: 'ADMIN',
          credits,
          expiresAt,
          reference,
          note,
        })

      if (completedCount >= 3 && withinWindow) {
        await grant(`beta-challenge-3of5:${userId}`, 450, 'Beta Challenge — 3 of 5 goals')
      }
      if (completedCount === 5 && withinWindow) {
        await grant(`beta-challenge-5of5:${userId}`, 450, 'Beta Challenge — all 5 goals')
      }
      if (goals.connect.count >= goals.connect.target) {
        await grant(`first-collab:${userId}`, 100, 'First Collaboration Bonus')
      }

      // Claimed = lot exists (covers grants from earlier visits too, so a
      // reward earned in-window stays claimed after the window closes).
      const lots = await prisma.creditLot.findMany({
        where: {
          userId,
          reference: {
            in: [
              `beta-challenge-3of5:${userId}`,
              `beta-challenge-5of5:${userId}`,
              `first-collab:${userId}`,
            ],
          },
        },
        select: { reference: true },
      })
      const refs = new Set(lots.map((l) => l.reference))
      reward450Granted = refs.has(`beta-challenge-3of5:${userId}`)
      reward900Granted = refs.has(`beta-challenge-5of5:${userId}`)
      firstCollabGranted = refs.has(`first-collab:${userId}`)
    } catch (error) {
      console.error('Beta challenge reward grant failed:', error)
    }
  }

  return NextResponse.json({
    goals,
    completedCount,
    deadline: deadline?.toISOString() ?? null,
    withinWindow,
    reward450Granted,
    reward900Granted,
    firstCollab: {
      achieved: goals.connect.count >= goals.connect.target,
      granted: firstCollabGranted,
    },
  })
}
