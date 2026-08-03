import RoleShell from '@/components/workspace/RoleShell'
import CampaignDetailWrapper from '@/components/campaigns/CampaignDetailWrapper'
import SimilarCampaigns from '@/components/campaigns/SimilarCampaigns'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { title: true, description: true, brand: { select: { companyName: true } } },
  })
  if (!campaign) return { title: 'Campaign Not Found' }
  return {
    title: campaign.title,
    description: campaign.description?.slice(0, 160) || `Campaign by ${campaign.brand.companyName}`,
    openGraph: {
      title: campaign.title,
      description: campaign.description?.slice(0, 160) || undefined,
    },
  }
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      brand: {
        select: {
          id: true,
          userId: true,
          companyName: true,
          logoUrl: true,
          websiteUrl: true,
          description: true,
          industry: true,
          isVerified: true,
        },
      },
      agency: {
        select: {
          id: true,
          agencyName: true,
          logoUrl: true,
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
      followerRequirements: {
        include: {
          platform: true,
        },
      },
      media: {
        orderBy: {
          displayOrder: 'asc',
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  })

  if (!campaign) {
    notFound()
  }

  // Check ownership and application status + get similar campaigns in parallel
  let isOwner = false
  let hasApplied = false
  let isSaved = false

  const categoryIds = campaign.categories.map((c) => c.categoryId)

  // Run view count increment and similar campaigns fetch in parallel with user checks
  const [similarCampaigns, userCheckResult] = await Promise.all([
    // Similar campaigns
    prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        id: { not: id },
        categories: {
          some: {
            categoryId: { in: categoryIds },
          },
        },
      },
      include: {
        brand: {
          select: {
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
        _count: {
          select: {
            applications: true,
          },
        },
      },
      take: 3,
    }),
    // User checks + view increment
    (async () => {
      // Fire-and-forget view count increment (non-blocking)
      prisma.campaign.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {})

      if (!session?.user) return { isOwner: false, hasApplied: false, isSaved: false }

      const userId = (session.user as any).id
      const ownerCheck = campaign.brand.userId === userId

      const influencerProfile = await prisma.influencerProfile.findUnique({
        where: { userId },
      })

      if (!influencerProfile) return { isOwner: ownerCheck, hasApplied: false, isSaved: false }

      const [application, saved] = await Promise.all([
        prisma.application.findUnique({
          where: {
            campaignId_influencerId: {
              campaignId: id,
              influencerId: influencerProfile.id,
            },
          },
        }),
        prisma.savedCampaign.findUnique({
          where: {
            influencerId_campaignId: {
              influencerId: influencerProfile.id,
              campaignId: id,
            },
          },
        }),
      ])

      return { isOwner: ownerCheck, hasApplied: !!application, isSaved: !!saved }
    })(),
  ])

  isOwner = userCheckResult.isOwner
  hasApplied = userCheckResult.hasApplied
  isSaved = userCheckResult.isSaved

  return (
    <RoleShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8">
        <CampaignDetailWrapper
          initialCampaign={campaign as any}
          isOwner={isOwner}
          hasApplied={hasApplied}
          isSaved={isSaved}
          isAuthenticated={!!session}
          userType={session ? ((session.user as any).userType || 'INFLUENCER') : null}
          subscriptionTier={session ? ((session.user as any).subscriptionTier || 'FREE') : null}
        />

        {/* Similar Campaigns */}
        <SimilarCampaigns campaignId={id} initialCampaigns={similarCampaigns as any} />
      </div>
    </RoleShell>
  )
}
