import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import CampaignForm from '@/components/campaigns/CampaignForm'
import { EditCampaignHeading } from '@/components/dashboard/BrandCampaignHeadings'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = (session.user as any).id

  // Fetch campaign with all relations
  const campaign = await prisma.campaign.findUnique({
    where: { id: id },
    include: {
      brand: true,
      categories: { include: { category: true } },
      platforms: { include: { platform: true } },
      followerRequirements: { include: { platform: true } },
    },
  })

  if (!campaign) {
    notFound()
  }

  // Check ownership
  if (campaign.brand.userId !== userId) {
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
      <div className="max-w-4xl mx-auto pt-6 pb-8">
        <EditCampaignHeading />

        <CampaignForm
          categories={categories}
          platforms={platforms}
          initialData={campaign}
          isEditing
        />
      </div>
    </BrandWorkspaceLayout>
  )
}
