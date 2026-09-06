export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import {
  walletGrant,
  grantSubscriptionCycleCredits,
  getPlanConfig,
  addMonths,
} from '@/lib/wallet'

// GET /api/cron/credits — daily wallet maintenance (Vercel cron):
// 1. Expire stale lots (write EXPIRY ledger rows) for users with any.
// 2. Grant monthly subscription credits to users whose cycle isn't driven
//    by a Stripe invoice: FREE users, verified-trial users, and annual
//    subscribers mid-year (monthly no-rollover lots inside a yearly period).
// 3. Ledger/lot invariant check — log any mismatch.
//
// All grants are idempotent (unique lot reference), so double runs are safe.

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function startOfNextMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

export async function GET(req: NextRequest) {
  // Fail closed: without a configured secret the endpoint is unusable.
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  if (!CREDIT_SYSTEM_ENABLED) {
    return NextResponse.json({ skipped: 'credit system disabled' })
  }

  const now = new Date()
  const stats = { expiredLots: 0, grantsFree: 0, grantsCycle: 0, invariantErrors: 0 }

  // --- 1. Expiry sweep -----------------------------------------------------
  const staleOwners = await prisma.creditLot.findMany({
    where: { remaining: { gt: 0 }, expiresAt: { lte: now } },
    select: { userId: true },
    distinct: ['userId'],
    take: 500,
  })
  for (const { userId } of staleOwners) {
    // getWalletBalance lazily expires inside the per-user lock.
    const { getWalletBalance } = await import('@/lib/wallet')
    await getWalletBalance(userId)
    stats.expiredLots++
  }

  // --- 2a. FREE-tier monthly grants (calendar month, expires at month end) --
  const freePlan = await getPlanConfig('FREE')
  const freeCredits = freePlan.baseCredits + freePlan.bonusCredits
  if (freeCredits > 0) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const freeUsers = await prisma.user.findMany({
      where: {
        subscriptionTier: 'FREE',
        isActive: true,
        creditLots: { none: { source: 'SUBSCRIPTION', createdAt: { gte: monthStart } } },
      },
      select: { id: true },
      take: 2000,
    })
    for (const { id } of freeUsers) {
      const granted = await walletGrant(id, {
        bucket: 'SUBSCRIPTION',
        source: 'SUBSCRIPTION',
        credits: freeCredits,
        expiresAt: startOfNextMonth(now),
        reference: `monthly:${id}:${monthKey(now)}`,
      })
      if (granted) stats.grantsFree++
    }
  }

  // --- 2b. Cycle grants not driven by invoices -----------------------------
  // Trial users (paid tier, no Stripe sub) and annual subscribers whose last
  // monthly lot has lapsed while the paid period is still running.
  const cycleUsers = await prisma.user.findMany({
    where: {
      subscriptionTier: { in: ['CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO'] },
      isActive: true,
      OR: [
        { proTrialEndsAt: { gt: now } }, // verified trial
        // Any Stripe period still running: covers annual subs every month
        // INCLUDING the final one, and monthly subs only if their invoice
        // grant somehow never landed (invoice.paid normally wins because the
        // live invoice lot suppresses this via the `none` filter below).
        { currentPeriodEnd: { gt: now } },
      ],
      creditLots: {
        none: {
          source: { in: ['SUBSCRIPTION', 'MIGRATION_BONUS'] },
          expiresAt: { gt: now },
        },
      },
    },
    select: { id: true, subscriptionTier: true, proTrialEndsAt: true, currentPeriodEnd: true },
    take: 2000,
  })
  for (const u of cycleUsers) {
    let boundary = u.currentPeriodEnd ?? u.proTrialEndsAt ?? addMonths(now, 1)
    if (boundary <= now) boundary = addMonths(now, 1) // stale mirror guard
    const expiry = addMonths(now, 1) < boundary ? addMonths(now, 1) : boundary
    const granted = await grantSubscriptionCycleCredits(
      u.id,
      u.subscriptionTier as 'CAMPAIGN_PLUS' | 'OUTREACH_PLUS' | 'PRO',
      expiry,
      `monthly:${u.id}:${monthKey(now)}`,
    )
    if (granted) stats.grantsCycle++
  }

  // --- 3. Invariant: sum(live lot remaining) == sum(ledger deltas) ---------
  const mismatches = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT l."userId"
    FROM (
      SELECT "userId", COALESCE(SUM(remaining), 0) AS lots
      FROM credit_lots WHERE remaining > 0 AND "expiresAt" > NOW()
      GROUP BY "userId"
    ) l
    FULL OUTER JOIN (
      SELECT "userId", COALESCE(SUM(delta), 0) AS ledger
      FROM credit_ledger GROUP BY "userId"
    ) g ON g."userId" = l."userId"
    WHERE COALESCE(l.lots, 0) <> COALESCE(g.ledger, 0)
    LIMIT 20
  `
  stats.invariantErrors = mismatches.length
  if (mismatches.length > 0) {
    console.error('[cron/credits] wallet invariant mismatch for users:', mismatches)
  }

  return NextResponse.json({ ok: true, ...stats })
}
