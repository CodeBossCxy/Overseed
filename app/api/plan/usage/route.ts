import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS, getQuotaUsed } from '@/lib/plan'
import { getEffectiveTier } from '@/lib/subscription'
import { getCreditSummary } from '@/lib/credits'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { getWalletBalance, getPlanConfig } from '@/lib/wallet'

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
      ...(await creditItems(userId, tier, credits, {
        discoveryUsed,
        analyticsUsed,
        outreachUsed,
        limits,
      })),
    ],
  })
}

/**
 * Pricing v4: everything metered is one credit wallet, so the old per-feature
 * quota rows (discovery/analytics/outreach) disappear and aiCredits reflects
 * the wallet. With the flag off, the legacy v3 rows are returned unchanged.
 */
async function creditItems(
  userId: string,
  tier: Awaited<ReturnType<typeof getEffectiveTier>>,
  credits: Awaited<ReturnType<typeof getCreditSummary>>,
  legacy: {
    discoveryUsed: number
    analyticsUsed: number
    outreachUsed: number
    limits: (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS]
  },
) {
  if (CREDIT_SYSTEM_ENABLED) {
    const [balance, plan] = await Promise.all([getWalletBalance(userId), getPlanConfig(tier)])
    const cycleCredits = plan.baseCredits + plan.bonusCredits
    return [
      {
        key: 'aiCredits',
        used: Math.max(0, cycleCredits - balance.subscription),
        limit: cycleCredits,
        extra: balance.purchased,
        enabled: true,
      },
    ]
  }
  return [
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
      used: legacy.discoveryUsed,
      limit: legacy.limits.discoverySearchesPerMonth,
    },
    {
      key: 'advancedAnalytics',
      used: legacy.analyticsUsed,
      limit: legacy.limits.analyticsPerMonth,
      enabled: legacy.limits.analyticsPerMonth > 0,
    },
    {
      key: 'managedOutreach',
      used: legacy.outreachUsed,
      limit: legacy.limits.outreachPerMonth,
      enabled: legacy.limits.outreachPerMonth > 0,
    },
  ]
}
