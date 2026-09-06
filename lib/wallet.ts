// Credit wallet (pricing v4) — lot-based balances with an append-only ledger.
//
// Model:
// - credit_lots: each grant is a lot (credits, remaining, expiresAt).
//   SUBSCRIPTION-bucket lots expire at billing-cycle end (no rollover);
//   PURCHASED lots 12 months after purchase.
// - credit_ledger: every grant / deduction / refund / expiry is a row.
//   A deduction spanning multiple lots writes one row per lot.
// - Deduction order: SUBSCRIPTION bucket first, then PURCHASED FIFO.
//
// Concurrency: every wallet mutation runs in a Prisma interactive
// transaction that first takes SELECT ... FOR UPDATE on the user row.
// This serializes wallet writes per user (safe through pgbouncer in
// transaction mode), which makes `remaining` and `balanceAfter` race-free.
//
// Prices/plans/packs live in DB config tables (credit_price_config,
// plan_config, credit_pack_config) — never hardcode amounts in feature code.

import { prisma } from '@/lib/prisma'
import type { Prisma, CreditBucket, CreditLotSource } from '@prisma/client'
import type { SubscriptionTier } from '@/lib/subscription'

type Tx = Prisma.TransactionClient

export const PACK_VALIDITY_MONTHS = 12

// ---------------------------------------------------------------------------
// Config (cached ~60s; admin edits take effect without redeploys)
// ---------------------------------------------------------------------------

const CONFIG_TTL_MS = 60_000

let priceCache: { at: number; prices: Record<string, number> } | null = null

export async function getCreditPrices(): Promise<Record<string, number>> {
  if (priceCache && Date.now() - priceCache.at < CONFIG_TTL_MS) return priceCache.prices
  const rows = await prisma.creditPriceConfig.findMany()
  const prices: Record<string, number> = {}
  for (const r of rows) prices[r.featureKey] = r.credits
  priceCache = { at: Date.now(), prices }
  return prices
}

export async function getCreditPrice(featureKey: string): Promise<number> {
  const prices = await getCreditPrices()
  const price = prices[featureKey]
  if (price === undefined) throw new Error(`Unknown credit feature: ${featureKey}`)
  return price
}

let planCache: { at: number; plans: Map<string, PlanConfigRow> } | null = null

export interface PlanConfigRow {
  tier: SubscriptionTier
  priceMonthly: number
  priceAnnual: number
  baseCredits: number
  bonusCredits: number
  migrationBonusPct: number
  migrationBonusCycles: number
}

export async function getPlanConfigs(): Promise<Map<string, PlanConfigRow>> {
  if (planCache && Date.now() - planCache.at < CONFIG_TTL_MS) return planCache.plans
  const rows = await prisma.planConfig.findMany()
  const plans = new Map<string, PlanConfigRow>()
  for (const r of rows) plans.set(r.tier, r as unknown as PlanConfigRow)
  planCache = { at: Date.now(), plans }
  return plans
}

export async function getPlanConfig(tier: SubscriptionTier): Promise<PlanConfigRow> {
  const plans = await getPlanConfigs()
  const plan = plans.get(tier)
  if (!plan) throw new Error(`Missing plan_config for tier: ${tier}`)
  return plan
}

export async function getActivePacks() {
  return prisma.creditPackConfig.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  })
}

/** Test hook / admin-save hook: drop the in-memory config caches. */
export function invalidateWalletConfigCache(): void {
  priceCache = null
  planCache = null
}

// ---------------------------------------------------------------------------
// Core primitives (call inside a wallet transaction only)
// ---------------------------------------------------------------------------

/** Serialize all wallet mutations for a user. */
async function lockUser(tx: Tx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
}

interface LiveLot {
  id: string
  bucket: CreditBucket
  remaining: number
  expiresAt: Date
  createdAt: Date
}

/** Live lots in deduction order: SUBSCRIPTION first, then PURCHASED FIFO. */
async function liveLots(tx: Tx, userId: string, now: Date): Promise<LiveLot[]> {
  return tx.creditLot.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
    select: { id: true, bucket: true, remaining: true, expiresAt: true, createdAt: true },
    // Postgres orders enums by definition order: SUBSCRIPTION before PURCHASED.
    orderBy: [{ bucket: 'asc' }, { createdAt: 'asc' }],
  })
}

/**
 * Write EXPIRY ledger rows for stale lots and zero them out. Returns the
 * remaining live-lot total after expiry.
 */
async function expireStaleLots(tx: Tx, userId: string, now: Date): Promise<void> {
  const stale = await tx.creditLot.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { lte: now } },
    orderBy: { expiresAt: 'asc' },
  })
  if (stale.length === 0) return
  let balance = await liveTotal(tx, userId, now)
  // liveTotal excludes stale lots already, so balanceAfter for each expiry
  // row is simply the live total (unchanged as we zero stale lots).
  for (const lot of stale) {
    await tx.creditLot.update({ where: { id: lot.id }, data: { remaining: 0 } })
    await tx.creditLedgerEntry.create({
      data: {
        userId,
        delta: -lot.remaining,
        type: 'EXPIRY',
        bucket: lot.bucket,
        lotId: lot.id,
        referenceId: `expiry:${lot.id}`,
        balanceAfter: balance,
      },
    })
  }
}

async function liveTotal(tx: Tx, userId: string, now: Date): Promise<number> {
  const agg = await tx.creditLot.aggregate({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
    _sum: { remaining: true },
  })
  return agg._sum.remaining || 0
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WalletBalance {
  subscription: number
  purchased: number
  total: number
  /** Soonest-expiring live lot (for "N credits expire on D" UI). */
  nextExpiry: { at: Date; credits: number } | null
}

export async function getWalletBalance(userId: string): Promise<WalletBalance> {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId)
    await expireStaleLots(tx, userId, now)
    const lots = await liveLots(tx, userId, now)
    let subscription = 0
    let purchased = 0
    let nextExpiry: WalletBalance['nextExpiry'] = null
    for (const lot of lots) {
      if (lot.bucket === 'SUBSCRIPTION') subscription += lot.remaining
      else purchased += lot.remaining
      if (!nextExpiry || lot.expiresAt < nextExpiry.at) {
        nextExpiry = { at: lot.expiresAt, credits: lot.remaining }
      } else if (lot.expiresAt.getTime() === nextExpiry.at.getTime()) {
        nextExpiry.credits += lot.remaining
      }
    }
    return { subscription, purchased, total: subscription + purchased, nextExpiry }
  })
}

export type WalletDeductResult =
  | { ok: true; cost: number; balance: WalletBalance }
  | { ok: false; cost: number; available: number }

/**
 * Deduct `featureKey`'s configured price (× quantity, or `costOverride`).
 * SUBSCRIPTION bucket first, then PURCHASED FIFO; fails atomically (no
 * writes) when the balance is insufficient. Zero-priced features are no-ops.
 */
export async function walletDeduct(
  userId: string,
  featureKey: string,
  referenceId: string,
  opts: { quantity?: number; costOverride?: number } = {},
): Promise<WalletDeductResult> {
  const unit = await getCreditPrice(featureKey)
  const cost = opts.costOverride ?? unit * (opts.quantity ?? 1)
  const now = new Date()
  if (cost <= 0) {
    return { ok: true, cost: 0, balance: await getWalletBalance(userId) }
  }
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId)
    await expireStaleLots(tx, userId, now)
    const lots = await liveLots(tx, userId, now)
    const total = lots.reduce((s, l) => s + l.remaining, 0)
    if (total < cost) return { ok: false as const, cost, available: total }

    let left = cost
    let balance = total
    for (const lot of lots) {
      if (left === 0) break
      const take = Math.min(lot.remaining, left)
      left -= take
      balance -= take
      await tx.creditLot.update({
        where: { id: lot.id },
        data: { remaining: { decrement: take } },
      })
      await tx.creditLedgerEntry.create({
        data: {
          userId,
          delta: -take,
          type: 'DEDUCTION',
          bucket: lot.bucket,
          lotId: lot.id,
          featureKey,
          referenceId,
          balanceAfter: balance,
        },
      })
    }

    let subscription = 0
    let purchased = 0
    let nextExpiry: WalletBalance['nextExpiry'] = null
    for (const lot of await liveLots(tx, userId, now)) {
      if (lot.bucket === 'SUBSCRIPTION') subscription += lot.remaining
      else purchased += lot.remaining
      if (!nextExpiry || lot.expiresAt < nextExpiry.at) {
        nextExpiry = { at: lot.expiresAt, credits: lot.remaining }
      }
    }
    return {
      ok: true as const,
      cost,
      balance: { subscription, purchased, total: balance, nextExpiry },
    }
  })
}

/**
 * Reverse a prior deduction (upstream failure / zero results). Restores the
 * exact lots when still live; credits from since-expired lots come back as a
 * fresh PURCHASED lot valid 12 months. Idempotent per referenceId.
 *
 * `opts.amount` refunds only part of the deduction (e.g. a discovery page
 * that came back short), consuming the deduction rows in reverse order —
 * one atomic operation, no separate re-charge needed.
 */
export async function walletRefund(
  userId: string,
  referenceId: string,
  opts: { amount?: number } = {},
): Promise<void> {
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId)
    const [deductions, priorRefund] = await Promise.all([
      tx.creditLedgerEntry.findMany({
        where: { userId, referenceId, type: 'DEDUCTION' },
        orderBy: { createdAt: 'desc' }, // reverse order for partial refunds
      }),
      tx.creditLedgerEntry.findFirst({
        where: { userId, referenceId: `refund:${referenceId}`, type: 'REFUND' },
        select: { id: true },
      }),
    ])
    if (deductions.length === 0 || priorRefund) return

    const deductedTotal = deductions.reduce((s, r) => s + -r.delta, 0)
    let toRefund = Math.min(opts.amount ?? deductedTotal, deductedTotal)
    if (toRefund <= 0) return

    let balance = await liveTotal(tx, userId, now)
    let orphaned = 0 // credits whose original lot has expired
    for (const row of deductions) {
      if (toRefund <= 0) break
      const amount = Math.min(-row.delta, toRefund)
      toRefund -= amount
      const lot = row.lotId
        ? await tx.creditLot.findUnique({ where: { id: row.lotId } })
        : null
      if (lot && lot.expiresAt > now) {
        await tx.creditLot.update({
          where: { id: lot.id },
          data: { remaining: { increment: amount } },
        })
        balance += amount
        await tx.creditLedgerEntry.create({
          data: {
            userId,
            delta: amount,
            type: 'REFUND',
            bucket: lot.bucket,
            lotId: lot.id,
            featureKey: row.featureKey,
            referenceId: `refund:${referenceId}`,
            balanceAfter: balance,
          },
        })
      } else {
        orphaned += amount
      }
    }
    if (orphaned > 0) {
      const newLot = await tx.creditLot.create({
        data: {
          userId,
          bucket: 'PURCHASED',
          source: 'ADMIN',
          credits: orphaned,
          remaining: orphaned,
          expiresAt: addMonths(now, PACK_VALIDITY_MONTHS),
          reference: `refundlot:${referenceId}`,
          note: 'Refund of a deduction whose original lot expired',
        },
      })
      balance += orphaned
      await tx.creditLedgerEntry.create({
        data: {
          userId,
          delta: orphaned,
          type: 'REFUND',
          bucket: 'PURCHASED',
          lotId: newLot.id,
          referenceId: `refund:${referenceId}`,
          balanceAfter: balance,
        },
      })
    }
  })
}

/** Net non-refunded deduction exists for this reference (repeat-view dedup). */
export async function walletHasDeduction(userId: string, referenceId: string): Promise<boolean> {
  const agg = await prisma.creditLedgerEntry.aggregate({
    where: {
      userId,
      referenceId: { in: [referenceId, `refund:${referenceId}`] },
      type: { in: ['DEDUCTION', 'REFUND'] },
    },
    _sum: { delta: true },
  })
  return (agg._sum.delta || 0) < 0
}

export interface GrantInput {
  bucket: CreditBucket
  source: CreditLotSource
  credits: number
  expiresAt: Date
  /** Unique idempotency key ('invoice:{id}', 'checkout:{id}', 'monthly:{userId}:{YYYY-MM}', ...). */
  reference: string
  note?: string
}

/**
 * Grant a lot + GRANT ledger row. Idempotent: returns false when a lot with
 * this reference already exists (webhook retries, double cron runs).
 */
export async function walletGrant(userId: string, input: GrantInput): Promise<boolean> {
  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, userId)
      const lot = await tx.creditLot.create({
        data: {
          userId,
          bucket: input.bucket,
          source: input.source,
          credits: input.credits,
          remaining: input.credits,
          expiresAt: input.expiresAt,
          reference: input.reference,
          note: input.note,
        },
      })
      const balance = await liveTotal(tx, userId, now)
      await tx.creditLedgerEntry.create({
        data: {
          userId,
          delta: input.credits,
          type: input.source === 'ADMIN' ? 'ADMIN_ADJUSTMENT' : 'GRANT',
          bucket: input.bucket,
          lotId: lot.id,
          referenceId: input.reference,
          note: input.note,
          balanceAfter: balance,
        },
      })
    })
    return true
  } catch (e: unknown) {
    // P2002 = unique violation on credit_lots.reference → already granted.
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
      return false
    }
    throw e
  }
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  // Clamp end-of-month overflow (Jan 31 + 1mo must not land in March).
  if (d.getDate() !== day) d.setDate(0)
  return d
}

/**
 * Grant this cycle's subscription credits (base + bonus, plus the migration
 * bonus for grandfathered users still within their bonus cycles). The lot
 * expires at `periodEnd`. Idempotent per `reference`.
 */
export async function grantSubscriptionCycleCredits(
  userId: string,
  tier: SubscriptionTier,
  periodEnd: Date,
  reference: string,
): Promise<boolean> {
  const plan = await getPlanConfig(tier)
  let credits = plan.baseCredits + plan.bonusCredits
  let note: string | undefined

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { migrationBonusEligible: true },
  })
  if (user?.migrationBonusEligible) {
    const granted = await prisma.creditLot.count({
      where: { userId, source: 'MIGRATION_BONUS' },
    })
    if (granted < plan.migrationBonusCycles) {
      const bonus = Math.floor((credits * plan.migrationBonusPct) / 100)
      if (bonus > 0) {
        const bonusGranted = await walletGrant(userId, {
          bucket: 'SUBSCRIPTION',
          source: 'MIGRATION_BONUS',
          credits: bonus,
          expiresAt: periodEnd,
          reference: `${reference}:migration-bonus`,
          note: `迁移加赠 ${plan.migrationBonusPct}% (cycle ${granted + 1}/${plan.migrationBonusCycles})`,
        })
        if (bonusGranted) {
          await notifyMigrationBonus(userId, bonus, plan.migrationBonusPct)
        }
      }
      note = 'v4 cutover cycle with migration bonus'
    }
  }

  return walletGrant(userId, {
    bucket: 'SUBSCRIPTION',
    source: 'SUBSCRIPTION',
    credits,
    expiresAt: periodEnd,
    reference,
    note,
  })
}

/** Migration promo notice (pricing v4 cutover). Never throws. */
async function notifyMigrationBonus(userId: string, bonus: number, pct: number): Promise<void> {
  try {
    const { sendStatusEmail } = await import('@/lib/notification-emails')
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        preferredLanguage: true,
        emailNotifications: true,
        emailCampaignUpdates: true,
        emailCollaborationUpdates: true,
      },
    })
    if (!user) return
    await sendStatusEmail({
      recipient: user,
      category: 'account',
      subject: {
        en: `You received ${bonus} bonus credits`,
        zh: `您获得了 ${bonus} 迁移加赠 credits`,
      },
      title: {
        en: 'Migration bonus credits added',
        zh: '迁移加赠已到账',
      },
      intro: {
        en: `Overseed now uses one unified credit balance for all AI and creator-data features. As an existing subscriber you received ${pct}% extra credits (${bonus}) this cycle — enjoy!`,
        zh: `Overseed 已升级为统一的 credits 计费。作为老用户，本周期您额外获得 ${pct}% 迁移加赠（${bonus} credits）。`,
      },
      cta: { label: { en: 'View my credits', zh: '查看我的 credits' }, path: '/pricing/brand' },
    })
  } catch (e) {
    console.error('Migration bonus email failed:', e)
  }
}
