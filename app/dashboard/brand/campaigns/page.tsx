import { Suspense } from 'react'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BrandCampaignsClient from '@/components/dashboard/BrandCampaignsClient'
import DashboardLoading from '../loading'

async function CampaignsContent() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = (session.user as any).id

  const brandProfile = await prisma.brandProfile.findUnique({
    where: { userId },
  })

  if (!brandProfile) {
    redirect('/dashboard/brand')
  }

  const campaigns = await prisma.campaign.findMany({
    where: { brandId: brandProfile.id },
    include: {
      categories: {
        include: { category: true },
      },
      platforms: {
        include: { platform: true },
      },
      _count: {
        select: { applications: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <BrandCampaignsClient
      campaigns={JSON.parse(JSON.stringify(campaigns))}
      isVerified={brandProfile.brandVerificationStatus === 'APPROVED'}
    />
  )
}

export default function BrandCampaignsPage() {
  return (
    <BrandWorkspaceLayout>
      <Suspense fallback={<DashboardLoading />}>
        <CampaignsContent />
      </Suspense>
    </BrandWorkspaceLayout>
  )
}
