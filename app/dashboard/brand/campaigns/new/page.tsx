import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import CampaignForm from '@/components/campaigns/CampaignForm'
import { NewCampaignHeading } from '@/components/dashboard/BrandCampaignHeadings'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function NewCampaignPage() {
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

  if (dbUser?.userType !== 'BRAND' && dbUser?.userType !== 'ADMIN') {
    redirect('/dashboard/influencer')
  }

  // Check if user has a brand profile
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

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-4xl mx-auto workspace-page-tight pb-8">
        <NewCampaignHeading />

        <CampaignForm categories={categories} platforms={platforms} />
      </div>
    </BrandWorkspaceLayout>
  )
}
