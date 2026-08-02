import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import BrandDashboardClient from '@/components/dashboard/BrandDashboardClient'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function BrandDashboardPage() {
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

  if (userType === 'INFLUENCER') {
    redirect('/dashboard/influencer')
  }

  // Get or create brand profile
  let brandProfile = await prisma.brandProfile.findUnique({
    where: { userId },
  })

  if (!brandProfile) {
    brandProfile = await prisma.brandProfile.create({
      data: {
        userId,
        companyName: session.user.name,
        brandVerificationStatus: 'PENDING',
        verificationSubmittedAt: new Date(),
      },
    })
  }

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalCampaigns,
    liveCampaigns,
    liveRecent,
    draftCampaigns,
    applicationsToReview,
    ongoingCollaborations,
    campaigns,
  ] = await Promise.all([
    prisma.campaign.count({ where: { brandId: brandProfile.id } }),
    prisma.campaign.count({ where: { brandId: brandProfile.id, status: 'ACTIVE' } }),
    prisma.campaign.count({
      where: { brandId: brandProfile.id, status: 'ACTIVE', createdAt: { gte: monthAgo } },
    }),
    prisma.campaign.count({ where: { brandId: brandProfile.id, status: 'DRAFT' } }),
    // Spec: "Applications to Review" counts Applied (PENDING) only
    prisma.application.count({
      where: {
        campaign: { brandId: brandProfile.id },
        status: 'PENDING',
      },
    }),
    prisma.collaboration.count({
      where: {
        brandId: brandProfile.id,
        status: { in: ['AWAITING_CONFIRMATION', 'ACTIVE', 'SUBMITTED'] },
      },
    }),
    prisma.campaign.findMany({
      where: { brandId: brandProfile.id },
      include: {
        categories: { include: { category: true } },
        platforms: { include: { platform: true } },
        _count: { select: { applications: true } },
        collaborations: {
          take: 4,
          select: {
            id: true,
            influencer: {
              select: {
                displayName: true,
                avatarUrl: true,
                user: { select: { name: true, image: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ])

  // Recent conversations for this brand user, newest first
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    include: {
      participants: { where: { userId } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      application: {
        select: {
          influencer: {
            select: {
              displayName: true,
              avatarUrl: true,
              user: { select: { name: true, image: true } },
            },
          },
        },
      },
    },
  })

  const recentMessages = conversations
    .map((conv) => {
      const last = conv.messages[0]
      if (!last) return null
      const me = conv.participants[0]
      const influencer = conv.application?.influencer
      return {
        conversationId: conv.id,
        name: influencer?.displayName || influencer?.user?.name || 'Creator',
        avatarUrl: influencer?.avatarUrl || influencer?.user?.image || null,
        snippet: last.content,
        at: last.createdAt.toISOString(),
        unread: last.senderId !== userId && (!me || last.createdAt > me.lastReadAt),
      }
    })
    .filter(Boolean)

  const setup = {
    profile: !!(brandProfile.description && brandProfile.logoUrl),
    verification: brandProfile.brandVerificationStatus === 'APPROVED',
    payment: !!brandProfile.stripeCustomerId,
    firstCampaign: totalCampaigns > 0,
  }

  const stats = {
    liveCampaigns,
    liveRecent,
    applicationsToReview,
    ongoingCollaborations,
    draftCampaigns,
  }

  return (
    <BrandWorkspaceLayout>
      <BrandDashboardClient
        stats={stats}
        setup={setup}
        campaigns={JSON.parse(JSON.stringify(campaigns))}
        recentMessages={JSON.parse(JSON.stringify(recentMessages))}
        brandProfile={{
          companyName: brandProfile.companyName,
          logoUrl: brandProfile.logoUrl,
          brandVerificationStatus: brandProfile.brandVerificationStatus,
        }}
        userName={session.user?.name || 'Brand'}
      />
    </BrandWorkspaceLayout>
  )
}
