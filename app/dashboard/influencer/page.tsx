import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import InfluencerDashboardClient from '@/components/dashboard/InfluencerDashboardClient'

const ONGOING = ['AWAITING_CONFIRMATION', 'ACTIVE', 'SUBMITTED'] as const

export default async function InfluencerDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = (session.user as any).id

  // Read userType from DB (not JWT session) to avoid stale-token redirects
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { userType: true },
  })
  const userType = dbUser?.userType || 'INFLUENCER'

  if (userType === 'BRAND') {
    redirect('/dashboard/brand')
  }

  // Get or create influencer profile
  let influencerProfile = await prisma.influencerProfile.findUnique({
    where: { userId },
    include: { socialAccounts: { include: { platform: true } } },
  })

  if (!influencerProfile) {
    influencerProfile = await prisma.influencerProfile.create({
      data: { userId, displayName: session.user.name },
      include: { socialAccounts: { include: { platform: true } } },
    })
  }

  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [appsInReview, collaborations, savedCampaigns, recommended, conversations] =
    await Promise.all([
      prisma.application.count({
        where: { influencerId: influencerProfile.id, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      }),
      prisma.collaboration.findMany({
        where: { influencerId: influencerProfile.id },
        include: {
          campaign: { select: { id: true, title: true } },
          payment: { select: { status: true, amount: true, creatorPayout: true } },
        },
      }),
      prisma.savedCampaign.count({ where: { influencerId: influencerProfile.id } }),
      prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
        include: { categories: { include: { category: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.conversation.findMany({
        where: { participants: { some: { userId } } },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        include: {
          participants: { where: { userId } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          application: {
            select: {
              campaign: { select: { brand: { select: { companyName: true, logoUrl: true } } } },
            },
          },
        },
      }),
    ])

  const ongoing = collaborations.filter((c) => (ONGOING as readonly string[]).includes(c.status))
  const tasksDueSoon = ongoing.filter(
    (c) => c.status === 'ACTIVE' && c.deadline && c.deadline <= weekAhead
  )
  const upcoming = ongoing
    .filter((c) => c.status === 'ACTIVE' && c.deadline)
    .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())[0]

  const availableEarnings = collaborations
    .filter((c) => c.payment && ['RELEASED', 'PAYOUT_PROCESSING'].includes(c.payment.status))
    .reduce((sum, c) => sum + Number(c.payment!.creatorPayout ?? c.payment!.amount ?? 0), 0)

  const recentMessages = conversations
    .map((conv) => {
      const last = conv.messages[0]
      if (!last) return null
      const me = conv.participants[0]
      const brand = conv.application?.campaign?.brand
      return {
        conversationId: conv.id,
        name: brand?.companyName || 'Brand',
        avatarUrl: brand?.logoUrl || null,
        snippet: last.content,
        at: last.createdAt.toISOString(),
        unread: last.senderId !== userId && (!me || last.createdAt > me.lastReadAt),
      }
    })
    .filter(Boolean)

  const setup = {
    profile: !!(influencerProfile.displayName && influencerProfile.bio && influencerProfile.primaryNiche),
    social: influencerProfile.socialAccounts.length > 0,
    identity: influencerProfile.isVerified,
    payouts: influencerProfile.stripeOnboardingComplete || !!influencerProfile.stripeConnectId,
  }

  const stats = {
    appsInReview,
    activeCollabs: ongoing.length,
    tasksDue: tasksDueSoon.length,
    availableEarnings,
    savedCampaigns,
  }

  return (
    <CreatorWorkspaceLayout>
      <InfluencerDashboardClient
        userName={session.user?.name || 'Creator'}
        isVerified={influencerProfile.isVerified}
        setup={setup}
        stats={stats}
        recommended={JSON.parse(JSON.stringify(recommended))}
        recentMessages={JSON.parse(JSON.stringify(recentMessages))}
        upcomingTask={
          upcoming
            ? {
                collaborationId: upcoming.id,
                campaignTitle: upcoming.campaign?.title || '',
                deadline: upcoming.deadline!.toISOString(),
              }
            : null
        }
      />
    </CreatorWorkspaceLayout>
  )
}
