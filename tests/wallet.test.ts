import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  walletGrant,
  walletDeduct,
  walletRefund,
  walletHasDeduction,
  getWalletBalance,
  grantSubscriptionCycleCredits,
  invalidateWalletConfigCache,
  addMonths,
} from '@/lib/wallet'
import { gateFeature } from '@/lib/metering'

// ---------------------------------------------------------------------------
// Notification email must never fail tests — mock it before wallet imports
// resolve the dynamic import.
// ---------------------------------------------------------------------------
vi.mock('@/lib/notification-emails', () => ({
  sendStatusEmail: vi.fn().mockResolvedValue(undefined),
}))

const TEST_EMAIL = 'wallet-test@example.invalid'

let testUserId: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function cleanUserWallet(userId: string) {
  await prisma.creditLedgerEntry.deleteMany({ where: { userId } })
  await prisma.creditLot.deleteMany({ where: { userId } })
}

async function assertInvariant(userId: string) {
  const lots = await prisma.creditLot.findMany({ where: { userId } })
  const lotSum = lots.reduce((s, l) => s + l.remaining, 0)

  const ledger = await prisma.creditLedgerEntry.findMany({ where: { userId } })
  const ledgerSum = ledger.reduce((s, e) => s + e.delta, 0)

  expect(lotSum).toBe(ledgerSum)
}

// Ensure credit_price_config row for discovery_search exists
// Create-if-missing only: NEVER overwrite live pricing config on a shared
// dev database (tests use costOverride, so exact values don't matter).
async function ensurePriceConfig(featureKey: string, credits: number) {
  await prisma.creditPriceConfig.upsert({
    where: { featureKey },
    update: {},
    create: { featureKey, credits, updatedAt: new Date() },
  })
  invalidateWalletConfigCache()
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      name: 'Wallet Test User',
      migrationBonusEligible: false,
    },
  })
  testUserId = user.id

  // Seed required config rows
  await ensurePriceConfig('discovery_search', 6)
  await ensurePriceConfig('profile_view', 10)
  await ensurePriceConfig('outreach', 20)
  await ensurePriceConfig('analytics', 15)

  // plan_config PRO must exist (seeded as base 1200 bonus 600 pct 25 cycles 2)
  // — create-if-missing only, never overwrite live config.
  await prisma.planConfig.upsert({
    where: { tier: 'PRO' },
    update: {},
    create: {
      tier: 'PRO',
      priceMonthly: 9900,
      priceAnnual: 0,
      baseCredits: 1200,
      bonusCredits: 600,
      migrationBonusPct: 25,
      migrationBonusCycles: 2,
      updatedAt: new Date(),
    },
  })
  invalidateWalletConfigCache()
})

beforeEach(async () => {
  await cleanUserWallet(testUserId)
  invalidateWalletConfigCache()
})

afterAll(async () => {
  await cleanUserWallet(testUserId)
  await prisma.user.delete({ where: { id: testUserId } })
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// 1. Deduction order: SUBSCRIPTION first, then PURCHASED FIFO
// ---------------------------------------------------------------------------

describe('deduction order', () => {
  it('drains SUBSCRIPTION before PURCHASED, PURCHASED FIFO', async () => {
    const now = Date.now()
    const olderDate = new Date(now - 2000)
    const newerDate = new Date(now - 1000)

    // Grant in order: SUBSCRIPTION, older PURCHASED, newer PURCHASED
    const subRef = `test:sub:${now}`
    await walletGrant(testUserId, {
      bucket: 'SUBSCRIPTION',
      source: 'SUBSCRIPTION',
      credits: 100,
      expiresAt: addMonths(new Date(), 1),
      reference: subRef,
    })

    const olderRef = `test:older:${now}`
    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 100,
      expiresAt: addMonths(new Date(), 12),
      reference: olderRef,
    })
    await prisma.creditLot.update({ where: { reference: olderRef }, data: { createdAt: olderDate } })

    const newerRef = `test:newer:${now}`
    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 100,
      expiresAt: addMonths(new Date(), 12),
      reference: newerRef,
    })
    await prisma.creditLot.update({ where: { reference: newerRef }, data: { createdAt: newerDate } })

    const deductRef = `test:deduct:${now}`
    const result = await walletDeduct(testUserId, 'discovery_search', deductRef, { costOverride: 150 })
    expect(result.ok).toBe(true)

    // Subscription lot should be fully drained
    const subLot = await prisma.creditLot.findUnique({ where: { reference: subRef } })
    expect(subLot!.remaining).toBe(0)

    // Older purchased lot should be partially drained (50 taken)
    const olderLot = await prisma.creditLot.findUnique({ where: { reference: olderRef } })
    expect(olderLot!.remaining).toBe(50)

    // Newer purchased lot untouched
    const newerLot = await prisma.creditLot.findUnique({ where: { reference: newerRef } })
    expect(newerLot!.remaining).toBe(100)

    // 2 ledger DEDUCTION rows (one per lot touched)
    const ledgerRows = await prisma.creditLedgerEntry.findMany({
      where: { userId: testUserId, referenceId: deductRef, type: 'DEDUCTION' },
      orderBy: { createdAt: 'asc' },
    })
    expect(ledgerRows).toHaveLength(2)
    // Total before = 300 (100 sub + 100 + 100 purchased)
    expect(ledgerRows[0].delta).toBe(-100) // subscription lot drained
    expect(ledgerRows[0].balanceAfter).toBe(200)
    expect(ledgerRows[1].delta).toBe(-50) // older purchased partial
    expect(ledgerRows[1].balanceAfter).toBe(150)

    await assertInvariant(testUserId)
  })
})

// ---------------------------------------------------------------------------
// 2. Multi-lot span: 3 DEDUCTION rows sharing referenceId
// ---------------------------------------------------------------------------

describe('multi-lot span', () => {
  it('creates one DEDUCTION ledger row per lot, all sharing referenceId', async () => {
    const ts = Date.now()
    for (let i = 0; i < 3; i++) {
      await walletGrant(testUserId, {
        bucket: 'PURCHASED',
        source: 'PACK',
        credits: 50,
        expiresAt: addMonths(new Date(), 12),
        reference: `test:multi:${ts}:${i}`,
      })
    }
    const ref = `test:multideduct:${ts}`
    const result = await walletDeduct(testUserId, 'discovery_search', ref, { costOverride: 120 })
    expect(result.ok).toBe(true)

    const rows = await prisma.creditLedgerEntry.findMany({
      where: { userId: testUserId, referenceId: ref, type: 'DEDUCTION' },
    })
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.referenceId).toBe(ref)
    }

    await assertInvariant(testUserId)
  })
})

// ---------------------------------------------------------------------------
// 3. Insufficient balance: no writes
// ---------------------------------------------------------------------------

describe('insufficient balance', () => {
  it('returns ok=false and writes nothing when balance < cost', async () => {
    const ts = Date.now()
    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 10,
      expiresAt: addMonths(new Date(), 12),
      reference: `test:small:${ts}`,
    })

    const ref = `test:overdraft:${ts}`
    const result = await walletDeduct(testUserId, 'discovery_search', ref, { costOverride: 50 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.available).toBe(10)
    }

    const rows = await prisma.creditLedgerEntry.findMany({
      where: { userId: testUserId, referenceId: ref },
    })
    expect(rows).toHaveLength(0)

    await assertInvariant(testUserId)
  })
})

// ---------------------------------------------------------------------------
// 4. Expiry: expired lots excluded, zeroed, EXPIRY ledger row written
// ---------------------------------------------------------------------------

describe('expiry', () => {
  it('excludes expired lots from balance and writes EXPIRY ledger row', async () => {
    const ts = Date.now()
    // Grant the lot via walletGrant so a GRANT ledger row exists, then force-expire it
    const ref = `test:expiredlot:${ts}`
    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 100,
      expiresAt: addMonths(new Date(), 12),
      reference: ref,
    })
    // Force expiry: set expiresAt to past (remaining stays 100 so expireStaleLots triggers)
    await prisma.creditLot.update({
      where: { reference: ref },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    // Also create a live lot
    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 50,
      expiresAt: addMonths(new Date(), 12),
      reference: `test:livelot:${ts}`,
    })

    const balance = await getWalletBalance(testUserId)
    // Expired lot must not be counted
    expect(balance.purchased).toBe(50)
    expect(balance.total).toBe(50)

    // Expired lot should be zeroed
    const expiredLot = await prisma.creditLot.findUnique({ where: { reference: ref } })
    expect(expiredLot!.remaining).toBe(0)

    // EXPIRY ledger row written
    const expiryRows = await prisma.creditLedgerEntry.findMany({
      where: { userId: testUserId, type: 'EXPIRY' },
    })
    expect(expiryRows.length).toBeGreaterThan(0)
    const expiryRow = expiryRows.find((r) => r.lotId === expiredLot!.id)
    expect(expiryRow).toBeDefined()
    expect(expiryRow!.delta).toBe(-100)

    await assertInvariant(testUserId)
  })
})

// ---------------------------------------------------------------------------
// 5. Refund: restores lots; second refund is no-op
// ---------------------------------------------------------------------------

describe('refund', () => {
  it('restores deducted amounts to original lots and is idempotent', async () => {
    const ts = Date.now()
    const lot1Ref = `test:refund:lot1:${ts}`
    const lot2Ref = `test:refund:lot2:${ts}`

    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 60,
      expiresAt: addMonths(new Date(), 12),
      reference: lot1Ref,
    })
    // Set lot1 as older so deduction order is deterministic
    await prisma.creditLot.update({
      where: { reference: lot1Ref },
      data: { createdAt: new Date(ts - 2000) },
    })
    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 60,
      expiresAt: addMonths(new Date(), 12),
      reference: lot2Ref,
    })
    await prisma.creditLot.update({
      where: { reference: lot2Ref },
      data: { createdAt: new Date(ts - 1000) },
    })

    const deductRef = `test:refund:deduct:${ts}`
    await walletDeduct(testUserId, 'discovery_search', deductRef, { costOverride: 90 })

    // lot1 (older) drained first, then lot2 partially
    const lot1Before = await prisma.creditLot.findUnique({ where: { reference: lot1Ref } })
    const lot2Before = await prisma.creditLot.findUnique({ where: { reference: lot2Ref } })
    expect(lot1Before!.remaining).toBe(0)
    expect(lot2Before!.remaining).toBe(30)

    await walletRefund(testUserId, deductRef)

    // Lots restored
    const lot1After = await prisma.creditLot.findUnique({ where: { reference: lot1Ref } })
    const lot2After = await prisma.creditLot.findUnique({ where: { reference: lot2Ref } })
    expect(lot1After!.remaining).toBe(60)
    expect(lot2After!.remaining).toBe(60)

    const refundRowsBefore = await prisma.creditLedgerEntry.findMany({
      where: { userId: testUserId, type: 'REFUND' },
    })

    // Second refund: no-op (no extra ledger rows)
    await walletRefund(testUserId, deductRef)

    const refundRowsAfter = await prisma.creditLedgerEntry.findMany({
      where: { userId: testUserId, type: 'REFUND' },
    })
    expect(refundRowsAfter).toHaveLength(refundRowsBefore.length)

    await assertInvariant(testUserId)
  })
})

// ---------------------------------------------------------------------------
// 6. Refund after expiry: new PURCHASED lot created with reference refundlot:
// ---------------------------------------------------------------------------

describe('refund after expiry', () => {
  it('creates a fresh PURCHASED lot when original lot has since expired', async () => {
    const ts = Date.now()
    const lotRef = `test:refexpiry:lot:${ts}`

    // Grant a lot with a far-future expiry so we can deduct from it
    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 100,
      expiresAt: addMonths(new Date(), 12),
      reference: lotRef,
    })

    const deductRef = `test:refexpiry:deduct:${ts}`
    await walletDeduct(testUserId, 'discovery_search', deductRef, { costOverride: 40 })

    // Force-expire the lot
    const lot = await prisma.creditLot.findUnique({ where: { reference: lotRef } })
    await prisma.creditLot.update({
      where: { id: lot!.id },
      data: { expiresAt: new Date(Date.now() - 1000), remaining: 0 },
    })
    // Trigger balance refresh so the expiry is picked up; but since we manually
    // zeroed remaining=0, expireStaleLots won't write an EXPIRY row.

    await walletRefund(testUserId, deductRef)

    // A new PURCHASED lot should exist with reference refundlot:{deductRef}
    const newLot = await prisma.creditLot.findUnique({
      where: { reference: `refundlot:${deductRef}` },
    })
    expect(newLot).toBeDefined()
    expect(newLot!.credits).toBe(40)
    expect(newLot!.remaining).toBe(40)
    expect(newLot!.bucket).toBe('PURCHASED')
  })
})

// ---------------------------------------------------------------------------
// 7. walletGrant idempotency
// ---------------------------------------------------------------------------

describe('walletGrant idempotency', () => {
  it('second grant with same reference returns false and creates only one lot', async () => {
    const ts = Date.now()
    const ref = `test:idem:${ts}`

    const first = await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 50,
      expiresAt: addMonths(new Date(), 12),
      reference: ref,
    })
    expect(first).toBe(true)

    const second = await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 50,
      expiresAt: addMonths(new Date(), 12),
      reference: ref,
    })
    expect(second).toBe(false)

    const lots = await prisma.creditLot.findMany({ where: { userId: testUserId, reference: ref } })
    expect(lots).toHaveLength(1)

    await assertInvariant(testUserId)
  })
})

// ---------------------------------------------------------------------------
// 8. grantSubscriptionCycleCredits: migration bonus logic
// ---------------------------------------------------------------------------

describe('grantSubscriptionCycleCredits', () => {
  let bonusUserId: string

  beforeAll(async () => {
    const u = await prisma.user.upsert({
      where: { email: 'wallet-bonus-test@example.invalid' },
      update: { migrationBonusEligible: true },
      create: {
        email: 'wallet-bonus-test@example.invalid',
        name: 'Bonus Test User',
        migrationBonusEligible: true,
      },
    })
    bonusUserId = u.id
  })

  afterAll(async () => {
    await prisma.creditLedgerEntry.deleteMany({ where: { userId: bonusUserId } })
    await prisma.creditLot.deleteMany({ where: { userId: bonusUserId } })
    await prisma.user.delete({ where: { id: bonusUserId } })
  })

  beforeEach(async () => {
    await prisma.creditLedgerEntry.deleteMany({ where: { userId: bonusUserId } })
    await prisma.creditLot.deleteMany({ where: { userId: bonusUserId } })
    invalidateWalletConfigCache()
  })

  it('grants main lot + MIGRATION_BONUS lot on first call (migrationBonusEligible=true)', async () => {
    const ts = Date.now()
    const periodEnd = addMonths(new Date(), 1)
    const ref = `monthly:${bonusUserId}:${ts}`

    await grantSubscriptionCycleCredits(bonusUserId, 'PRO', periodEnd, ref)

    const lots = await prisma.creditLot.findMany({ where: { userId: bonusUserId } })
    expect(lots).toHaveLength(2)

    const main = lots.find((l) => l.source === 'SUBSCRIPTION')
    const bonus = lots.find((l) => l.source === 'MIGRATION_BONUS')
    expect(main).toBeDefined()
    expect(main!.credits).toBe(1800) // 1200 + 600
    expect(bonus).toBeDefined()
    // floor(1800 * 25 / 100) = floor(450) = 450
    expect(bonus!.credits).toBe(450)

    await assertInvariant(bonusUserId)
  })

  it('third call in new cycle does not grant a third bonus lot when 2 already exist', async () => {
    const ts = Date.now()
    const periodEnd = addMonths(new Date(), 1)

    // Cycle 1
    await grantSubscriptionCycleCredits(bonusUserId, 'PRO', periodEnd, `monthly:${bonusUserId}:${ts}:c1`)
    // Cycle 2
    await grantSubscriptionCycleCredits(bonusUserId, 'PRO', periodEnd, `monthly:${bonusUserId}:${ts}:c2`)
    // Cycle 3 — bonus cap hit
    await grantSubscriptionCycleCredits(bonusUserId, 'PRO', periodEnd, `monthly:${bonusUserId}:${ts}:c3`)

    const bonusLots = await prisma.creditLot.findMany({
      where: { userId: bonusUserId, source: 'MIGRATION_BONUS' },
    })
    expect(bonusLots).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 9. walletHasDeduction
// ---------------------------------------------------------------------------

describe('walletHasDeduction', () => {
  it('returns true after deduct, false after refund', async () => {
    const ts = Date.now()
    await walletGrant(testUserId, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 50,
      expiresAt: addMonths(new Date(), 12),
      reference: `test:hasd:lot:${ts}`,
    })

    const ref = `test:hasd:deduct:${ts}`
    await walletDeduct(testUserId, 'discovery_search', ref, { costOverride: 6 })

    expect(await walletHasDeduction(testUserId, ref)).toBe(true)

    await walletRefund(testUserId, ref)

    expect(await walletHasDeduction(testUserId, ref)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 10. Proportional charge formula (pure unit test)
// ---------------------------------------------------------------------------

describe('proportional charge formula', () => {
  // Inline from app/api/discovery/search/route.ts:
  // const partial = Math.max(1, Math.ceil((price * resultCount) / DISCOVERY_PAGE_SIZE))
  const PAGE_SIZE = 10
  const PRICE = 6

  function proportionalCharge(resultCount: number): number {
    return Math.max(1, Math.ceil((PRICE * resultCount) / PAGE_SIZE))
  }

  const cases: [number, number][] = [
    [0, 1],   // 0 results → max(1, ceil(0)) = 1
    [1, 1],   // ceil(0.6) = 1
    [2, 2],   // ceil(1.2) = 2
    [3, 2],   // ceil(1.8) = 2
    [4, 3],   // ceil(2.4) = 3
    [5, 3],   // ceil(3) = 3
    [6, 4],   // ceil(3.6) = 4
    [7, 5],   // ceil(4.2) = 5
    [8, 5],   // ceil(4.8) = 5
    [9, 6],   // ceil(5.4) = 6
    [10, 6],  // ceil(6) = 6 (full page)
  ]

  it.each(cases)('resultCount=%i → charge=%i', (n, expected) => {
    expect(proportionalCharge(n)).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// 11. gateFeature: tier gating
// ---------------------------------------------------------------------------

describe('gateFeature', () => {
  const makeUser = async (email: string, tier: 'FREE' | 'CAMPAIGN_PLUS' | 'OUTREACH_PLUS' | 'PRO') => {
    const u = await prisma.user.upsert({
      where: { email },
      update: { subscriptionTier: tier, proTrialEndsAt: null },
      create: { email, subscriptionTier: tier },
    })
    return u.id
  }

  const cleanup = async (...emails: string[]) => {
    for (const email of emails) {
      await prisma.user.deleteMany({ where: { email } })
    }
  }

  it('FREE unverified user gets VERIFICATION_REQUIRED for discovery_search', async () => {
    const uid = await makeUser('gate-free@example.invalid', 'FREE')
    try {
      const result = await gateFeature(uid, 'discovery_search')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.body.code).toBe('VERIFICATION_REQUIRED')
        expect(result.status).toBe(403)
      }
    } finally {
      await cleanup('gate-free@example.invalid')
    }
  })

  // Pricing v4.1 (2026-09-06): outreach + analytics open to ALL paid tiers.
  it('CAMPAIGN_PLUS passes gateFeature for outreach and analytics', async () => {
    const uid = await makeUser('gate-cp@example.invalid', 'CAMPAIGN_PLUS')
    try {
      expect((await gateFeature(uid, 'outreach')).ok).toBe(true)
      expect((await gateFeature(uid, 'analytics')).ok).toBe(true)
    } finally {
      await cleanup('gate-cp@example.invalid')
    }
  })

  it('FREE gets PLAN_REQUIRED for outreach and analytics', async () => {
    const uid = await makeUser('gate-free2@example.invalid', 'FREE')
    try {
      for (const feature of ['outreach', 'analytics']) {
        const result = await gateFeature(uid, feature)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.body.code).toBe('PLAN_REQUIRED')
        }
      }
    } finally {
      await cleanup('gate-free2@example.invalid')
    }
  })

  it('PRO user passes gateFeature for analytics', async () => {
    const uid = await makeUser('gate-pro@example.invalid', 'PRO')
    try {
      const result = await gateFeature(uid, 'analytics')
      expect(result.ok).toBe(true)
    } finally {
      await cleanup('gate-pro@example.invalid')
    }
  })
})
