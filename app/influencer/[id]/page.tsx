import RoleShell from '@/components/workspace/RoleShell'
import InfluencerProfileWrapper from '@/components/profiles/InfluencerProfileWrapper'
import CreatorSaveBar from '@/components/profiles/CreatorSaveBar'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function InfluencerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const influencer = await prisma.influencerProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          name: true,
          image: true,
          createdAt: true,
        },
      },
      socialAccounts: {
        include: {
          platform: true,
        },
        orderBy: {
          followerCount: 'desc',
        },
      },
    },
  })

  if (!influencer) {
    notFound()
  }

  // Get completed campaigns count
  const completedCampaigns = await prisma.application.count({
    where: {
      influencerId: id,
      status: 'COMPLETED',
    },
  })

  // Brand viewers get save (bookmark) + report actions on creator profiles
  const session = await getServerSession(authOptions)
  const viewerIsBrand = session?.user
    ? !!(await prisma.brandProfile.findUnique({
        where: { userId: (session.user as any).id },
        select: { id: true },
      }))
    : false

  return (
    <RoleShell>
      {viewerIsBrand && <CreatorSaveBar influencerId={id} />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InfluencerProfileWrapper
          initialInfluencer={{
            ...influencer,
            completedCampaigns,
          } as any}
        />
      </div>
    </RoleShell>
  )
}
