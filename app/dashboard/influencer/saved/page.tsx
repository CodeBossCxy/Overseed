import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import InfluencerSavedClient from '@/components/dashboard/InfluencerSavedClient'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function SavedCampaignsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = (session.user as any).id

  const influencerProfile = await prisma.influencerProfile.findUnique({
    where: { userId },
  })

  if (!influencerProfile) {
    redirect('/dashboard/influencer')
  }

  const savedCampaigns = await prisma.savedCampaign.findMany({
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
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  return (
    <CreatorWorkspaceLayout>
      <InfluencerSavedClient savedCampaigns={JSON.parse(JSON.stringify(savedCampaigns))} />
    </CreatorWorkspaceLayout>
  )
}
