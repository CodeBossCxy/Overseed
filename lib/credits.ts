// AI credit ledger (pricing v3 — docs/PRICING_PLAN_V3.md).
//
// Balances are derived from the credit_transactions ledger:
// - The monthly allowance is virtual: a per-tier constant that implicitly
//   resets each calendar month. Consumption is recorded as MONTHLY_DEDUCTION
//   rows; remaining = allowance − used-this-month. Unused credits do NOT
//   roll over.
// - Purchased credits (packs) live in a persistent pool: sum of
//   PACK_PURCHASE / PURCHASED_DEDUCTION / REFUND / ADMIN_ADJUSTMENT amounts.
//   (12-month pack validity is policy; lot-level expiry is not enforced yet.)
// - Deductions consume the monthly allowance first, then the purchased pool.

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export type SubscriptionTier = 'FREE' | 'CAMPAIGN_PLUS' | 'OUTREACH_PLUS' | 'PRO'

/** Monthly included credits per tier (non-rollover). */
export const MONTHLY_CREDITS: Record<SubscriptionTier, number> = {
  FREE: 20,
  CAMPAIGN_PLUS: 100,
  OUTREACH_PLUS: 100,
  PRO: 250,
}

/** Credit cost per billable action. */
export const CREDIT_COSTS = {
  chat_standard: 1,
  chat_advanced: 3,
  image: 4,
  profile_view: 12,
  analytics: 45,
  // Discovery search beyond the monthly quota (quota itself is free).
  discovery_search_extra: 6,
} as const

export type CreditFeature = keyof typeof CREDIT_COSTS

export interface CreditSummary {
  monthlyAllowance: number
  monthlyUsed: number
  monthlyRemaining: number
  purchased: number
  total: number
}

function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

const PURCHASED_POOL_TYPES = [
  'PACK_PURCHASE',
  'PURCHASED_DEDUCTION',
  'REFUND',
  'ADMIN_ADJUSTMENT',
] as const

async function summarize(
  tx: Prisma.TransactionClient,
  userId: string,
  tier: SubscriptionTier,
): Promise<CreditSummary> {
  const [monthlyAgg, purchasedAgg] = await Promise.all([
    tx.creditTransaction.aggregate({
      where: { userId, type: 'MONTHLY_DEDUCTION', createdAt: { gte: startOfMonth() } },
      _sum: { amount: true },
    }),
    tx.creditTransaction.aggregate({
      where: { userId, type: { in: PURCHASED_POOL_TYPES as unknown as any } },
      _sum: { amount: true },
    }),
  ])
  const monthlyAllowance = MONTHLY_CREDITS[tier]
  const monthlyUsed = -(monthlyAgg._sum.amount || 0)
  const monthlyRemaining = Math.max(0, monthlyAllowance - monthlyUsed)
  const purchased = Math.max(0, purchasedAgg._sum.amount || 0)
  return {
    monthlyAllowance,
    monthlyUsed,
    monthlyRemaining,
    purchased,
    total: monthlyRemaining + purchased,
  }
}

export async function getCreditSummary(
  userId: string,
  tier: SubscriptionTier,
): Promise<CreditSummary> {
  return summarize(prisma, userId, tier)
}

export type DeductResult =
  | { ok: true; cost: number; summary: CreditSummary }
  | { ok: false; cost: number; available: number }

/**
 * Deduct the cost of `feature`, monthly allowance first, purchased pool for
 * the remainder. Fails (no writes) when the combined balance is insufficient.
 */
export async function deductCredits(
  userId: string,
  tier: SubscriptionTier,
  feature: CreditFeature,
  reference?: string,
): Promise<DeductResult> {
  const cost = CREDIT_COSTS[feature]
  return prisma.$transaction(async (tx) => {
    const before = await summarize(tx, userId, tier)
    if (before.total < cost) {
      return { ok: false as const, cost, available: before.total }
    }
    const fromMonthly = Math.min(before.monthlyRemaining, cost)
    const fromPurchased = cost - fromMonthly
    const rows: Prisma.CreditTransactionCreateManyInput[] = []
    if (fromMonthly > 0) {
      rows.push({ userId, amount: -fromMonthly, type: 'MONTHLY_DEDUCTION', feature, reference })
    }
    if (fromPurchased > 0) {
      rows.push({ userId, amount: -fromPurchased, type: 'PURCHASED_DEDUCTION', feature, reference })
    }
    await tx.creditTransaction.createMany({ data: rows })
    return {
      ok: true as const,
      cost,
      summary: {
        ...before,
        monthlyUsed: before.monthlyUsed + fromMonthly,
        monthlyRemaining: before.monthlyRemaining - fromMonthly,
        purchased: before.purchased - fromPurchased,
        total: before.total - cost,
      },
    }
  })
}

/**
 * Reverse a prior deduction (e.g. provider call failed after billing).
 * Inserts inverse rows of the same types so both pools are restored exactly.
 */
export async function refundDeduction(userId: string, reference: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.creditTransaction.findMany({
      where: {
        userId,
        reference,
        type: { in: ['MONTHLY_DEDUCTION', 'PURCHASED_DEDUCTION'] },
        amount: { lt: 0 },
      },
    })
    if (rows.length === 0) return
    await tx.creditTransaction.createMany({
      data: rows.map((r) => ({
        userId,
        amount: -r.amount,
        type: r.type,
        feature: r.feature,
        reference: `refund:${reference}`,
      })),
    })
  })
}

/** Credit a purchased pack (called from the Stripe webhook). Idempotent per reference. */
export async function grantPackCredits(
  userId: string,
  credits: number,
  reference: string,
): Promise<boolean> {
  const existing = await prisma.creditTransaction.findFirst({
    where: { userId, type: 'PACK_PURCHASE', reference },
    select: { id: true },
  })
  if (existing) return false
  await prisma.creditTransaction.create({
    data: { userId, amount: credits, type: 'PACK_PURCHASE', reference },
  })
  return true
}
