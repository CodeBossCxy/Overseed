// Plan limits — pricing v3 (docs/PRICING_PLAN_V3.md §1).
// Single source of truth for per-tier quotas, shared by the usage endpoint
// and quota enforcement points.

import { prisma } from '@/lib/prisma'
import { MONTHLY_CREDITS, type SubscriptionTier } from '@/lib/credits'

export interface PlanLimits {
  campaignsPerDay: number
  activeCampaigns: number
  conversationsPerDay: number
  teamSeats: number
  aiCreditsPerMonth: number
  discoverySearchesPerMonth: number
  analyticsPerMonth: number
  outreachPerMonth: number
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  FREE: {
    campaignsPerDay: 1,
    activeCampaigns: 1,
    conversationsPerDay: 10,
    teamSeats: 1,
    aiCreditsPerMonth: MONTHLY_CREDITS.FREE,
    discoverySearchesPerMonth: 5,
    analyticsPerMonth: 0,
    outreachPerMonth: 0,
  },
  CAMPAIGN_PLUS: {
    campaignsPerDay: 5,
    activeCampaigns: 50,
    conversationsPerDay: 50,
    teamSeats: 1,
    aiCreditsPerMonth: MONTHLY_CREDITS.CAMPAIGN_PLUS,
    discoverySearchesPerMonth: 50,
    analyticsPerMonth: 1,
    outreachPerMonth: 5,
  },
  OUTREACH_PLUS: {
    campaignsPerDay: 5,
    activeCampaigns: 10,
    conversationsPerDay: 20,
    teamSeats: 1,
    aiCreditsPerMonth: MONTHLY_CREDITS.OUTREACH_PLUS,
    discoverySearchesPerMonth: 80,
    analyticsPerMonth: 3,
    outreachPerMonth: 15,
  },
  PRO: {
    campaignsPerDay: 10,
    activeCampaigns: 80,
    conversationsPerDay: 50,
    teamSeats: 1,
    aiCreditsPerMonth: MONTHLY_CREDITS.PRO,
    discoverySearchesPerMonth: 150,
    analyticsPerMonth: 6,
    outreachPerMonth: 30,
  },
}

export type QuotaKind = 'discovery_search' | 'analytics' | 'outreach'

const QUOTA_LIMIT_KEY: Record<QuotaKind, keyof PlanLimits> = {
  discovery_search: 'discoverySearchesPerMonth',
  analytics: 'analyticsPerMonth',
  outreach: 'outreachPerMonth',
}

function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export async function getQuotaUsed(userId: string, kind: QuotaKind): Promise<number> {
  return prisma.quotaUsage.count({
    where: { userId, kind, createdAt: { gte: startOfMonth() } },
  })
}

/**
 * Consume one unit of a monthly quota. Returns false (no write) when the
 * tier's monthly limit is exhausted.
 */
export async function consumeQuota(
  userId: string,
  tier: SubscriptionTier,
  kind: QuotaKind,
): Promise<{ ok: boolean; used: number; limit: number; usageId?: string }> {
  const limit = PLAN_LIMITS[tier][QUOTA_LIMIT_KEY[kind]]
  const used = await getQuotaUsed(userId, kind)
  if (used >= limit) return { ok: false, used, limit }
  const row = await prisma.quotaUsage.create({ data: { userId, kind } })
  return { ok: true, used: used + 1, limit, usageId: row.id }
}

/** Undo a quota consumption (e.g. the metered action failed downstream). */
export async function releaseQuota(usageId: string): Promise<void> {
  await prisma.quotaUsage.deleteMany({ where: { id: usageId } })
}
