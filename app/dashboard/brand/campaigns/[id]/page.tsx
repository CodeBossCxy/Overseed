import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import BrandCampaignDetailClient from '@/components/dashboard/BrandCampaignDetailClient'

export default async function BrandCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = (session.user as any).id

  const campaign = await prisma.campaign.findUnique({
    where: { id: id },
    include: {
      brand: true,
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

  // Check if user owns this campaign
  if (campaign.brand.userId !== userId) {
    redirect('/dashboard/brand')
  }

  // Get application stats
  const applicationStats = await prisma.application.groupBy({
    by: ['status'],
    where: { campaignId: id },
    _count: true,
  })

  const stats = {
    total: campaign._count.applications,
    pending: applicationStats.find(s => s.status === 'PENDING')?._count || 0,
    approved: applicationStats.find(s => s.status === 'APPROVED')?._count || 0,
    rejected: applicationStats.find(s => s.status === 'REJECTED')?._count || 0,
    underReview: applicationStats.find(s => s.status === 'UNDER_REVIEW')?._count || 0,
  }

  return (
    <BrandWorkspaceLayout>
      <BrandCampaignDetailClient
        campaign={JSON.parse(JSON.stringify(campaign))}
        stats={stats}
      />
    </BrandWorkspaceLayout>
  )
}
