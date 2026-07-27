import MainLayout from '@/components/MainLayout'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { BrowseTitle, BrowseCampaignList, BrowseProGate } from '@/components/browse/BrowseI18nText'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Signed-in users see the campaign board inside their workspace shell;
// logged-out visitors keep the public header layout. Creators also get
// their saved-campaign ids so cards can show a save heart.
async function resolveViewer(userId: string | undefined) {
  if (!userId) return { Shell: MainLayout, savedIds: [] as string[], canSave: false, niche: null as string | null }
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { userType: true },
  })
  if (!dbUser) return { Shell: MainLayout, savedIds: [] as string[], canSave: false, niche: null as string | null }
  if (dbUser.userType !== 'INFLUENCER') {
    return { Shell: BrandWorkspaceLayout, savedIds: [] as string[], canSave: false, niche: null as string | null }
  }
  const influencer = await prisma.influencerProfile.findUnique({
    where: { userId },
    select: { primaryNiche: true, savedCampaigns: { select: { campaignId: true } } },
  })
  return {
    Shell: CreatorWorkspaceLayout,
    savedIds: influencer?.savedCampaigns.map((s) => s.campaignId) ?? [],
    canSave: !!influencer,
    niche: influencer?.primaryNiche ?? null,
  }
}

interface SearchParams {
  category?: string
  platform?: string
  compensation?: string
  minFollowers?: string
  sort?: string
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await getServerSession(authOptions)
  const subscriptionTier = (session?.user as any)?.subscriptionTier || 'FREE'
  const isPro = subscriptionTier === 'PRO'
  const { Shell, savedIds, canSave, niche } = await resolveViewer((session?.user as any)?.id)

  // If user is not logged in or not PRO, show upgrade prompt
  if (!session?.user || !isPro) {
    return (
      <Shell>
        <BrowseProGate isLoggedIn={!!session?.user} />
      </Shell>
    )
  }

  const params = await searchParams
  const category = params.category
  const platform = params.platform
  const compensation = params.compensation
  const minFollowers = params.minFollowers
  // Creators default to the recommendation ordering (their niche floats to
  // the top, without hiding anything else)
  const sort = params.sort || (canSave ? 'recommended' : 'latest')

  // Build filter query
  const where: Prisma.CampaignWhereInput = { status: 'ACTIVE' }

  if (category && category !== 'all') {
    where.categories = {
      some: {
        category: { slug: category },
      },
    }
  }

  if (platform && platform !== 'all') {
    where.platforms = {
      some: {
        platform: { slug: platform },
      },
    }
  }

  if (compensation) {
    where.compensationType = compensation as Prisma.EnumCompensationTypeFilter
  }

  // "Min followers required" from the creator's perspective: show campaigns
  // whose requirement is within the selected follower count (or that have
  // no follower requirement at all).
  if (minFollowers && !isNaN(Number(minFollowers))) {
    where.OR = [
      { followerRequirements: { none: {} } },
      { followerRequirements: { some: { minFollowers: { lte: Number(minFollowers) } } } },
    ]
  }

  // Build sort query ('recommended' fetches latest, then reorders below)
  let orderBy: Prisma.CampaignOrderByWithRelationInput = {}
  if (sort === 'deadline') orderBy = { deadline: 'asc' }
  else if (sort === 'payment') orderBy = { paymentMax: 'desc' }
  else orderBy = { createdAt: 'desc' }

  const [campaigns, categories, platforms] = await Promise.all([
    prisma.campaign.findMany({
      where,
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
      orderBy,
      take: 50,
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.platform.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    }),
  ])

  // Recommended: campaigns matching the creator's niche first (never hidden)
  let orderedCampaigns = campaigns
  if (sort === 'recommended' && niche) {
    const matches = (c: (typeof campaigns)[number]) =>
      c.categories.some(({ category }) => category.name.toLowerCase() === niche.toLowerCase())
    orderedCampaigns = [...campaigns.filter(matches), ...campaigns.filter((c) => !matches(c))]
  }

  return (
    <Shell>
      <div className="max-w-6xl mx-auto pt-6 pb-8">
        <BrowseTitle recommended={canSave} />

        <BrowseCampaignList
          initialCampaigns={JSON.parse(JSON.stringify(orderedCampaigns))}
          filters={{ category, platform, compensation, minFollowers, sort }}
          categories={JSON.parse(JSON.stringify(categories))}
          platforms={JSON.parse(JSON.stringify(platforms))}
          savedIds={savedIds}
          canSave={canSave}
          recommendedAvailable={canSave}
        />
      </div>
    </Shell>
  )
}
