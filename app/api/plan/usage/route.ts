import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PLAN_LIMITS = {
  FREE: {
    campaignsPerDay: 2,
    activeCampaigns: 5,
    conversationsPerDay: 10,
    teamSeats: 1,
    aiChat: false,
    aiTokensPerMonth: 0,
  },
  PRO: {
    campaignsPerDay: 5,
    activeCampaigns: 50,
    conversationsPerDay: 50,
    teamSeats: 1,
    aiChat: true,
    aiTokensPerMonth: 150_000,
  },
} as const

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const tier = ((session.user as any).subscriptionTier || 'FREE') as 'FREE' | 'PRO'
  const limits = PLAN_LIMITS[tier]

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Get brand profile for campaign queries
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })

  const brandId = brandProfile?.id

  // Parallel queries for usage
  const [
    campaignsToday,
    activeCampaigns,
    conversationsToday,
    aiTokenUsage,
  ] = await Promise.all([
    // Campaigns created today
    brandId
      ? prisma.campaign.count({
          where: { brandId, createdAt: { gte: startOfDay } },
        })
      : 0,
    // Active campaigns
    brandId
      ? prisma.campaign.count({
          where: { brandId, status: 'ACTIVE' },
        })
      : 0,
    // Conversations started today (via participant join)
    prisma.conversationParticipant.count({
      where: { userId, createdAt: { gte: startOfDay } },
    }),
    // AI token usage this month
    tier === 'PRO'
      ? prisma.aiTokenUsage.aggregate({
          where: { userId, createdAt: { gte: startOfMonth } },
          _sum: { totalTokens: true },
        })
      : null,
  ])

  const aiTokensUsed = aiTokenUsage?._sum.totalTokens || 0

  return NextResponse.json({
    tier,
    items: [
      {
        key: 'translation',
        used: null,
        limit: null, // unlimited for both
      },
      {
        key: 'campaignsPerDay',
        used: campaignsToday,
        limit: limits.campaignsPerDay,
      },
      {
        key: 'activeCampaigns',
        used: activeCampaigns,
        limit: limits.activeCampaigns,
      },
      {
        key: 'conversationsPerDay',
        used: conversationsToday,
        limit: limits.conversationsPerDay,
      },
      {
        key: 'teamSeats',
        used: 1,
        limit: limits.teamSeats,
      },
      {
        key: 'aiChat',
        used: tier === 'PRO' ? aiTokensUsed : null,
        limit: tier === 'PRO' ? limits.aiTokensPerMonth : null,
        enabled: limits.aiChat,
      },
      {
        // Image credits ledger lands with the image-generation feature;
        // shown as "—" until then.
        key: 'aiImage',
        used: null,
        limit: null,
        enabled: limits.aiChat,
      },
    ],
  })
}
