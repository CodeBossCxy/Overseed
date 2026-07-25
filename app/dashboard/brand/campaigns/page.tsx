import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BrandCampaignsClient from '@/components/dashboard/BrandCampaignsClient'

export default async function BrandCampaignsPage() {
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
    <BrandWorkspaceLayout>
      <BrandCampaignsClient campaigns={JSON.parse(JSON.stringify(campaigns))} />
    </BrandWorkspaceLayout>
  )
}
