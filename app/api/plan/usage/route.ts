import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS, getQuotaUsed } from '@/lib/plan'
import { getEffectiveTier } from '@/lib/subscription'
import { getCreditSummary } from '@/lib/credits'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const tier = await getEffectiveTier(userId)
  const limits = PLAN_LIMITS[tier]

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

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
    credits,
    discoveryUsed,
    analyticsUsed,
    outreachUsed,
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
    // AI credit summary (monthly allowance + purchased pool)
    getCreditSummary(userId, tier),
    getQuotaUsed(userId, 'discovery_search'),
    getQuotaUsed(userId, 'analytics'),
    getQuotaUsed(userId, 'outreach'),
  ])

  return NextResponse.json({
    tier,
    items: [
      {
        key: 'translation',
        used: null,
        limit: null, // unlimited on every tier
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
        // Unified AI credits (chat/image/profile views/analytics-on-demand).
        // `used`/`limit` cover the monthly allowance; `extra` = purchased pool.
        key: 'aiCredits',
        used: Math.min(credits.monthlyUsed, credits.monthlyAllowance),
        limit: credits.monthlyAllowance,
        extra: credits.purchased,
        enabled: true,
      },
      {
        key: 'discoverySearches',
        used: discoveryUsed,
        limit: limits.discoverySearchesPerMonth,
      },
      {
        key: 'advancedAnalytics',
        used: analyticsUsed,
        limit: limits.analyticsPerMonth,
        enabled: limits.analyticsPerMonth > 0,
      },
      {
        key: 'managedOutreach',
        used: outreachUsed,
        limit: limits.outreachPerMonth,
        enabled: limits.outreachPerMonth > 0,
      },
    ],
  })
}
