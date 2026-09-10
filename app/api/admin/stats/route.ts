import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clubCreditsLeft } from '@/lib/influencers-club'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).userType !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    users,
    totalUsers,
    proUsers,
    totalCampaigns,
    totalApplications,
    aiUsageByUser,
    aiUsageMonthly,
    recentAiLogs,
    clubCredits,
    creditBalances,
    clubUsageRaw,
  ] = await Promise.all([
    // All users with their AI usage
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        userType: true,
        subscriptionTier: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { aiTokenUsage: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { subscriptionTier: 'PRO' } }),
    prisma.campaign.count(),
    prisma.application.count(),
    // AI usage per user this month
    prisma.aiTokenUsage.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: true,
    }),
    // Total AI usage this month
    prisma.aiTokenUsage.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: true,
    }),
    // Recent AI usage logs
    prisma.aiTokenUsage.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, name: true } },
      },
    }),
    // Influencers Club remaining balance (null if unconfigured/unreachable)
    clubCreditsLeft(),
    // Spendable balance per user. Expired and depleted lots are excluded so
    // this matches the balance exposed by the credit wallet.
    prisma.creditLot.groupBy({
      by: ['userId'],
      where: {
        remaining: { gt: 0 },
        expiresAt: { gt: now },
      },
      _sum: { remaining: true },
    }),
    // Per-user usage of club-backed features (profile views, analytics,
    // outreach). Counts platform charges — cache hits don't re-bill upstream,
    // so this is an upper bound on actual club credits consumed per user.
    prisma.creditLedgerEntry.groupBy({
      by: ['userId', 'featureKey'],
      where: {
        type: 'DEDUCTION',
        featureKey: { in: ['profile_view', 'analytics', 'outreach'] },
      },
      _count: true,
    }),
  ])

  // Merge AI usage into user data
  const usageMap = new Map(
    aiUsageByUser.map((u) => [u.userId, {
      monthlyTokens: u._sum.totalTokens || 0,
      monthlyPromptTokens: u._sum.promptTokens || 0,
      monthlyCompletionTokens: u._sum.completionTokens || 0,
      monthlyRequests: u._count,
    }])
  )
  const creditBalanceMap = new Map(
    creditBalances.map((row) => [row.userId, row._sum.remaining || 0])
  )

  const usersWithUsage = users.map((u) => ({
    ...u,
    creditsRemaining: creditBalanceMap.get(u.id) || 0,
    aiUsage: usageMap.get(u.id) || {
      monthlyTokens: 0,
      monthlyPromptTokens: 0,
      monthlyCompletionTokens: 0,
      monthlyRequests: 0,
    },
  }))

  // userId -> { profileViews, analytics, outreach }
  const userById = new Map(users.map((u) => [u.id, u]))
  const clubUsageByUser = new Map<
    string,
    { profileViews: number; analytics: number; outreach: number }
  >()
  for (const row of clubUsageRaw) {
    const entry =
      clubUsageByUser.get(row.userId) ||
      { profileViews: 0, analytics: 0, outreach: 0 }
    if (row.featureKey === 'profile_view') entry.profileViews += row._count
    else if (row.featureKey === 'analytics') entry.analytics += row._count
    else if (row.featureKey === 'outreach') entry.outreach += row._count
    clubUsageByUser.set(row.userId, entry)
  }
  const clubUsage = Array.from(clubUsageByUser.entries())
    .map(([id, counts]) => {
      const u = userById.get(id)
      return {
        userId: id,
        email: u?.email ?? id,
        name: u?.name ?? null,
        ...counts,
        total: counts.profileViews + counts.analytics + counts.outreach,
      }
    })
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({
    clubUsage,
    overview: {
      totalUsers,
      proUsers,
      freeUsers: totalUsers - proUsers,
      totalCampaigns,
      totalApplications,
      aiMonthlyTokens: aiUsageMonthly._sum.totalTokens || 0,
      aiMonthlyRequests: aiUsageMonthly._count || 0,
      clubCreditsLeft: clubCredits?.creditsLeft ?? null,
      clubTrialSearchesLeft: clubCredits?.trialSearchesLeft ?? null,
    },
    users: usersWithUsage,
    recentAiLogs,
  })
}
