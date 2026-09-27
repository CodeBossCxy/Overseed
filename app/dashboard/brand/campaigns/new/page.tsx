import { Suspense } from 'react'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import CampaignForm from '@/components/campaigns/CampaignForm'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLoading from '../../loading'

async function NewCampaignContent() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = (session.user as any).id

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { userType: true },
  })

  if (dbUser?.userType !== 'BRAND' && dbUser?.userType !== 'ADMIN') {
    redirect('/dashboard/influencer')
  }

  const brandProfile = await prisma.brandProfile.findUnique({
    where: { userId },
  })

  if (!brandProfile) {
    redirect('/dashboard/brand')
  }

  const [categories, platforms] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.platform.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    }),
  ])

  return <CampaignForm categories={categories} platforms={platforms} />
}

export default function NewCampaignPage() {
  return (
    <BrandWorkspaceLayout>
      <Suspense fallback={<DashboardLoading />}>
        <NewCampaignContent />
      </Suspense>
    </BrandWorkspaceLayout>
  )
}
