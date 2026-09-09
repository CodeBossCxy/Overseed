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

  const usersWithUsage = users.map((u) => ({
    ...u,
    aiUsage: usageMap.get(u.id) || {
      monthlyTokens: 0,
      monthlyPromptTokens: 0,
      monthlyCompletionTokens: 0,
      monthlyRequests: 0,
    },
  }))

  return NextResponse.json({
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
