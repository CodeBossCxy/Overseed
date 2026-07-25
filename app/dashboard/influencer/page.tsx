import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import InfluencerDashboardClient from '@/components/dashboard/InfluencerDashboardClient'

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
    include: {
      socialAccounts: {
        include: {
          platform: true,
        },
      },
    },
  })

  if (!influencerProfile) {
    // Create a basic profile
    influencerProfile = await prisma.influencerProfile.create({
      data: {
        userId,
        displayName: session.user.name,
      },
      include: {
        socialAccounts: {
          include: {
            platform: true,
          },
        },
      },
    })
  }

  // Get recent applications
  const recentApplications = await prisma.application.findMany({
    where: { influencerId: influencerProfile.id },
    include: {
      campaign: {
        include: {
          brand: {
            select: {
              id: true,
              companyName: true,
              logoUrl: true,
              isVerified: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
          platforms: {
            include: {
              platform: true,
            },
          },
        },
      },
      socialAccount: {
        include: {
          platform: true,
        },
      },
    },
    orderBy: { appliedAt: 'desc' },
    take: 5,
  })

  // Get stats
  const stats = {
    totalApplications: await prisma.application.count({
      where: { influencerId: influencerProfile.id },
    }),
    pendingApplications: await prisma.application.count({
      where: { influencerId: influencerProfile.id, status: 'PENDING' },
    }),
    approvedApplications: await prisma.application.count({
      where: { influencerId: influencerProfile.id, status: 'APPROVED' },
    }),
    completedCampaigns: await prisma.application.count({
      where: { influencerId: influencerProfile.id, status: 'COMPLETED' },
    }),
    savedCampaigns: await prisma.savedCampaign.count({
      where: { influencerId: influencerProfile.id },
    }),
  }

  const totalFollowers = influencerProfile.socialAccounts.reduce(
    (sum, acc) => sum + acc.followerCount,
    0
  )

  return (
    <CreatorWorkspaceLayout>
      <InfluencerDashboardClient
        stats={stats}
        recentApplications={JSON.parse(JSON.stringify(recentApplications))}
        influencerProfile={JSON.parse(JSON.stringify(influencerProfile))}
        totalFollowers={totalFollowers}
        userName={session.user?.name || 'Influencer'}
        stripeOnboardingComplete={influencerProfile.stripeOnboardingComplete}
      />
    </CreatorWorkspaceLayout>
  )
}
