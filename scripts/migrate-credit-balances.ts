/**
 * v3 → v4 credit balance migration.
 *
 * For each user with a positive legacy balance (credit_transactions), allocate
 * that balance across their PACK_PURCHASE rows from NEWEST to OLDEST (credits
 * remaining in the wallet belong to the most recent purchases). Expired
 * allocations are skipped. Any remainder from ADMIN_ADJUSTMENT/REFUND rows
 * that cannot be attributed to a purchase gets a single PURCHASED lot valid
 * 12 months from now.
 *
 * Usage:
 *   npx tsx scripts/migrate-credit-balances.ts            # dry-run (default)
 *   npx tsx scripts/migrate-credit-balances.ts --apply    # write to DB
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { walletGrant, addMonths, grantSubscriptionCycleCredits } from '../lib/wallet'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Pure allocation logic (exported for unit tests)
// ---------------------------------------------------------------------------

export interface LegacyPurchaseRow {
  id: string
  amount: number
  createdAt: Date
}

export interface PlannedLot {
  reference: string
  credits: number
  expiresAt: Date
  note: string
  skippedExpired?: boolean
}

/**
 * Given a user's PACK_PURCHASE rows (any order — sorted internally newest→oldest)
 * and their total legacy balance, produce the list of lots to grant.
 * `now` is injectable for testing.
 */
export function planMigrationLots(
  purchaseRows: LegacyPurchaseRow[],
  legacyBalance: number,
  userId: string,
  now: Date = new Date(),
  // Net credits from ADMIN_ADJUSTMENT/REFUND grants (≥0). Attributed FIRST
  // (fresh 12-month validity) so a recent admin grant is never written off
  // against an old expired pack purchase.
  adjustmentNet = 0,
): PlannedLot[] {
  if (legacyBalance <= 0) return []

  // Sort newest → oldest (remaining balance belongs to newest purchases)
  const sorted = [...purchaseRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )

  const lots: PlannedLot[] = []
  let unallocated = legacyBalance

  const adjustFirst = Math.min(unallocated, Math.max(0, adjustmentNet))
  if (adjustFirst > 0) {
    lots.push({
      reference: `migrate:adjust:${userId}`,
      credits: adjustFirst,
      expiresAt: addMonths(now, 12),
      note: `v3→v4 adjustment remainder`,
    })
    unallocated -= adjustFirst
  }

  for (const row of sorted) {
    if (unallocated <= 0) break
    const alloc = Math.min(row.amount, unallocated)
    if (alloc <= 0) continue
    const expiresAt = addMonths(row.createdAt, 12)
    if (expiresAt <= now) {
      // Purchase expired — skip but continue, balance is lost
      lots.push({
        reference: `migrate:${row.id}`,
        credits: alloc,
        expiresAt,
        note: `v3→v4 balance migration (expired, skipped)`,
        skippedExpired: true,
      })
      unallocated -= alloc
      continue
    }
    lots.push({
      reference: `migrate:${row.id}`,
      credits: alloc,
      expiresAt,
      note: `v3→v4 balance migration`,
    })
    unallocated -= alloc
  }

  // Any remaining balance not covered by adjustment credits or purchases
  if (unallocated > 0) {
    lots.push({
      reference: `migrate:tail:${userId}`,
      credits: unallocated,
      expiresAt: addMonths(now, 12),
      note: `v3→v4 unattributed remainder`,
    })
  }

  return lots
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const APPLY = process.argv.includes('--apply')

async function main() {
  const mode = APPLY ? 'APPLY' : 'DRY-RUN'
  console.log(`\nCredit balance migration — ${mode}\n`)

  const LEGACY_GRANT_TYPES = ['PACK_PURCHASE', 'PURCHASED_DEDUCTION', 'REFUND', 'ADMIN_ADJUSTMENT']

  // Aggregate legacy balance per user
  const userTotals = await prisma.creditTransaction.groupBy({
    by: ['userId'],
    where: { type: { in: LEGACY_GRANT_TYPES as any } },
    _sum: { amount: true },
    having: { amount: { _sum: { gt: 0 } } },
  })

  if (userTotals.length === 0) {
    console.log('No users with positive legacy balance found. Nothing to do.')
    return
  }

  const now = new Date()
  const colWidths = [24, 8, 8, 36, 22, 6]
  const header = ['userId', 'balance', 'credits', 'reference', 'expiresAt', 'skip?']
    .map((h, i) => h.padEnd(colWidths[i]))
    .join(' | ')
  console.log(header)
  console.log('-'.repeat(header.length))

  let totalUsersProcessed = 0
  let totalLotsGranted = 0

  for (const row of userTotals) {
    const userId = row.userId
    const legacyBalance = row._sum.amount ?? 0
    if (legacyBalance <= 0) continue

    const [purchaseRows, adjustmentAgg] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { userId, type: 'PACK_PURCHASE' },
        select: { id: true, amount: true, createdAt: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { userId, type: { in: ['ADMIN_ADJUSTMENT', 'REFUND'] as any } },
        _sum: { amount: true },
      }),
    ])

    const lots = planMigrationLots(
      purchaseRows,
      legacyBalance,
      userId,
      now,
      Math.max(0, adjustmentAgg._sum.amount ?? 0),
    )

    for (const lot of lots) {
      const row = [
        userId.slice(0, 22),
        String(legacyBalance),
        String(lot.credits),
        lot.reference.slice(0, 34),
        lot.expiresAt.toISOString().slice(0, 19),
        lot.skippedExpired ? 'SKIP' : '',
      ]
        .map((v, i) => v.padEnd(colWidths[i]))
        .join(' | ')
      console.log(row)

      if (APPLY && !lot.skippedExpired) {
        const granted = await walletGrant(userId, {
          bucket: 'PURCHASED',
          source: 'PACK',
          credits: lot.credits,
          expiresAt: lot.expiresAt,
          reference: lot.reference,
          note: lot.note,
        })
        if (granted) totalLotsGranted++
      }
    }

    totalUsersProcessed++
  }

  console.log(`\n${mode}: processed ${totalUsersProcessed} users`)
  if (APPLY) console.log(`Granted ${totalLotsGranted} new lots`)

  // -------------------------------------------------------------------------
  // Cutover: existing paid users would otherwise have ZERO subscription
  // credits until their next Stripe renewal (invoice.paid). Grant this
  // cycle's plan credits now, expiring at the end of the current calendar
  // month; invoice.paid takes over from the next renewal. Idempotent via
  // `cutover:{userId}`. Migration-eligible users also get their first 25%
  // bonus lot here.
  // -------------------------------------------------------------------------
  const paidUsers = await prisma.user.findMany({
    where: {
      subscriptionTier: { in: ['CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO'] as any },
      isActive: true,
    },
    select: { id: true, subscriptionTier: true },
  })
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  console.log(`\nCutover subscription grants: ${paidUsers.length} paid users (expire ${endOfMonth.toISOString().slice(0, 10)})`)
  let cutoverGrants = 0
  for (const u of paidUsers) {
    if (APPLY) {
      const granted = await grantSubscriptionCycleCredits(
        u.id,
        u.subscriptionTier as 'CAMPAIGN_PLUS' | 'OUTREACH_PLUS' | 'PRO',
        endOfMonth,
        `cutover:${u.id}`,
      )
      if (granted) cutoverGrants++
    } else {
      console.log(`  would grant cycle credits: ${u.id} (${u.subscriptionTier})`)
    }
  }
  if (APPLY) console.log(`Granted ${cutoverGrants} cutover subscription lots`)
  else console.log('Pass --apply to write to the database')
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] && process.argv[1].includes('migrate-credit-balances')) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
