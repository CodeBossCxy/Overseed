import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  walletGrant,
  walletDeduct,
  walletRefund,
  getWalletBalance,
  invalidateWalletConfigCache,
  addMonths,
} from '@/lib/wallet'

// ---------------------------------------------------------------------------
// Credit depletion financial correctness — integration tests (real DB)
//
// Verifies that discovery search billing is financially sound: FIFO lot
// ordering, correct balanceAfter on every ledger row, partial and full
// refunds, and cross-user isolation. Every test ends with the ledger
// invariant check: sum(ledger.delta) === sum(lot.remaining).
// ---------------------------------------------------------------------------

vi.mock('@/lib/notification-emails', () => ({
  sendStatusEmail: vi.fn().mockResolvedValue(undefined),
}))

const TEST_EMAIL_A = 'discovery-credit-test-a@example.invalid'
const TEST_EMAIL_B = 'discovery-credit-test-b@example.invalid'

let userIdA: string
let userIdB: string

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
  const a = await prisma.user.upsert({
    where: { email: TEST_EMAIL_A },
    update: {},
    create: { email: TEST_EMAIL_A, name: 'Credit Test A', migrationBonusEligible: false },
  })
  userIdA = a.id

  const b = await prisma.user.upsert({
    where: { email: TEST_EMAIL_B },
    update: {},
    create: { email: TEST_EMAIL_B, name: 'Credit Test B', migrationBonusEligible: false },
  })
  userIdB = b.id

  await ensurePriceConfig('discovery_search', 6)
})

beforeEach(async () => {
  await cleanUserWallet(userIdA)
  await cleanUserWallet(userIdB)
  invalidateWalletConfigCache()
})

afterAll(async () => {
  await cleanUserWallet(userIdA)
  await cleanUserWallet(userIdB)
  await prisma.user.delete({ where: { id: userIdA } })
  await prisma.user.delete({ where: { id: userIdB } })
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// 1. Per-search deduction with ledger trail
// ---------------------------------------------------------------------------

describe('per-search deduction with ledger trail', () => {
  it('decrements lot by 6, writes correct DEDUCTION row, invariant holds', async () => {
    const ts = Date.now()
    const grantRef = `dctest:grant:${ts}`
    await walletGrant(userIdA, {
      bucket: 'SUBSCRIPTION',
      source: 'SUBSCRIPTION',
      credits: 100,
      expiresAt: addMonths(new Date(), 1),
      reference: grantRef,
    })

    const deductRef = `dctest:deduct:${ts}`
    const result = await walletDeduct(userIdA, 'discovery_search', deductRef, { costOverride: 6 })
    expect(result.ok).toBe(true)

    // Lot remaining decremented
    const lot = await prisma.creditLot.findUnique({ where: { reference: grantRef } })
    expect(lot!.remaining).toBe(94)

    // Ledger row correct
    const rows = await prisma.creditLedgerEntry.findMany({
      where: { userId: userIdA, referenceId: deductRef, type: 'DEDUCTION' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].delta).toBe(-6)
    expect(rows[0].balanceAfter).toBe(94)
    expect(rows[0].featureKey).toBe('discovery_search')

    await assertInvariant(userIdA)
  })
})

// ---------------------------------------------------------------------------
// 2. Multiple searches deplete sequentially
// ---------------------------------------------------------------------------

describe('multiple searches deplete sequentially', () => {
  it('drains 30 credits over 5 searches; 6th search fails', async () => {
    const ts = Date.now()
    await walletGrant(userIdA, {
      bucket: 'SUBSCRIPTION',
      source: 'SUBSCRIPTION',
      credits: 30,
      expiresAt: addMonths(new Date(), 1),
      reference: `dctest:seq-grant:${ts}`,
    })

    const expectedBalances = [24, 18, 12, 6, 0]
    for (let i = 0; i < 5; i++) {
      const ref = `dctest:seq:${ts}:${i}`
      const result = await walletDeduct(userIdA, 'discovery_search', ref, { costOverride: 6 })
      expect(result.ok).toBe(true)

      const rows = await prisma.creditLedgerEntry.findMany({
        where: { userId: userIdA, referenceId: ref, type: 'DEDUCTION' },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].balanceAfter).toBe(expectedBalances[i])
    }

    // 6th deduction: insufficient balance
    const sixth = await walletDeduct(userIdA, 'discovery_search', `dctest:seq:${ts}:5`, { costOverride: 6 })
    expect(sixth.ok).toBe(false)
    if (!sixth.ok) expect(sixth.available).toBe(0)

    // No ledger row written for the failed deduction
    const failRows = await prisma.creditLedgerEntry.findMany({
      where: { userId: userIdA, referenceId: `dctest:seq:${ts}:5` },
    })
    expect(failRows).toHaveLength(0)

    await assertInvariant(userIdA)
  })
})

// ---------------------------------------------------------------------------
// 3. FIFO across lots: SUBSCRIPTION drained before PURCHASED
// ---------------------------------------------------------------------------

describe('FIFO across lots', () => {
  it('drains SUBSCRIPTION first, then PURCHASED; two DEDUCTION rows', async () => {
    const ts = Date.now()
    const subRef = `dctest:fifo-sub:${ts}`
    const purchRef = `dctest:fifo-purch:${ts}`

    await walletGrant(userIdA, {
      bucket: 'SUBSCRIPTION',
      source: 'SUBSCRIPTION',
      credits: 20,
      expiresAt: addMonths(new Date(), 1),
      reference: subRef,
    })
    await walletGrant(userIdA, {
      bucket: 'PURCHASED',
      source: 'PACK',
      credits: 20,
      expiresAt: addMonths(new Date(), 12),
      reference: purchRef,
    })

    const deductRef = `dctest:fifo-deduct:${ts}`
    const result = await walletDeduct(userIdA, 'discovery_search', deductRef, { costOverride: 25 })
    expect(result.ok).toBe(true)

    // SUBSCRIPTION fully drained
    const subLot = await prisma.creditLot.findUnique({ where: { reference: subRef } })
    expect(subLot!.remaining).toBe(0)

    // PURCHASED partially used
    const purchLot = await prisma.creditLot.findUnique({ where: { reference: purchRef } })
    expect(purchLot!.remaining).toBe(15)

    // Two ledger rows: one per lot
    const rows = await prisma.creditLedgerEntry.findMany({
      where: { userId: userIdA, referenceId: deductRef, type: 'DEDUCTION' },
      orderBy: { createdAt: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].delta).toBe(-20) // subscription drained
    expect(rows[0].bucket).toBe('SUBSCRIPTION')
    expect(rows[1].delta).toBe(-5)  // 5 from purchased
    expect(rows[1].bucket).toBe('PURCHASED')

    // balanceAfter monotonically decreasing
    expect(rows[0].balanceAfter).toBe(20) // 40 - 20
    expect(rows[1].balanceAfter).toBe(15) // 20 - 5

    await assertInvariant(userIdA)
  })
})

// ---------------------------------------------------------------------------
// 4. Partial page refund (short page → proportional keep)
// ---------------------------------------------------------------------------

describe('partial page refund', () => {
  it('refunds 3 of 6 credits; REFUND ledger row with delta +3; invariant holds', async () => {
    const ts = Date.now()
    const grantRef = `dctest:partial-grant:${ts}`
    await walletGrant(userIdA, {
      bucket: 'SUBSCRIPTION',
      source: 'SUBSCRIPTION',
      credits: 100,
      expiresAt: addMonths(new Date(), 1),
      reference: grantRef,
    })

    const deductRef = `dctest:partial-deduct:${ts}`
    await walletDeduct(userIdA, 'discovery_search', deductRef, { costOverride: 6 })

    // Simulate short page: keep 3, refund 3
    await walletRefund(userIdA, deductRef, { amount: 3 })

    // Lot restored by 3
    const lot = await prisma.creditLot.findUnique({ where: { reference: grantRef } })
    expect(lot!.remaining).toBe(97) // 100 - 6 + 3

    // Refund ledger row (walletRefund stores refund rows with referenceId = "refund:{originalRef}")
    const refundRows = await prisma.creditLedgerEntry.findMany({
      where: { userId: userIdA, referenceId: `refund:${deductRef}`, type: 'REFUND' },
    })
    expect(refundRows).toHaveLength(1)
    expect(refundRows[0].delta).toBe(3)
    expect(refundRows[0].balanceAfter).toBe(97)

    await assertInvariant(userIdA)
  })
})

// ---------------------------------------------------------------------------
// 5. Zero results → full refund
// ---------------------------------------------------------------------------

describe('zero results full refund', () => {
  it('restores balance to 50 after full refund of a 6-credit deduction', async () => {
    const ts = Date.now()
    const grantRef = `dctest:zr-grant:${ts}`
    await walletGrant(userIdA, {
      bucket: 'SUBSCRIPTION',
      source: 'SUBSCRIPTION',
      credits: 50,
      expiresAt: addMonths(new Date(), 1),
      reference: grantRef,
    })

    const deductRef = `dctest:zr-deduct:${ts}`
    await walletDeduct(userIdA, 'discovery_search', deductRef, { costOverride: 6 })

    // Verify deduction applied
    const balanceMid = await getWalletBalance(userIdA)
    expect(balanceMid.total).toBe(44)

    // Full refund (no amount → refund everything)
    await walletRefund(userIdA, deductRef)

    // Balance fully restored
    const balanceFinal = await getWalletBalance(userIdA)
    expect(balanceFinal.total).toBe(50)

    // Lot remaining back to original
    const lot = await prisma.creditLot.findUnique({ where: { reference: grantRef } })
    expect(lot!.remaining).toBe(50)

    await assertInvariant(userIdA)
  })
})

// ---------------------------------------------------------------------------
// 6. User isolation: deductions are wallet-scoped
// ---------------------------------------------------------------------------

describe('user isolation', () => {
  it('deducting from user A does not affect user B balance', async () => {
    const ts = Date.now()

    await walletGrant(userIdA, {
      bucket: 'SUBSCRIPTION',
      source: 'SUBSCRIPTION',
      credits: 50,
      expiresAt: addMonths(new Date(), 1),
      reference: `dctest:iso-a:${ts}`,
    })
    await walletGrant(userIdB, {
      bucket: 'SUBSCRIPTION',
      source: 'SUBSCRIPTION',
      credits: 50,
      expiresAt: addMonths(new Date(), 1),
      reference: `dctest:iso-b:${ts}`,
    })

    // Deduct only from user A
    const result = await walletDeduct(userIdA, 'discovery_search', `dctest:iso-deduct:${ts}`, { costOverride: 10 })
    expect(result.ok).toBe(true)

    const balanceA = await getWalletBalance(userIdA)
    expect(balanceA.total).toBe(40)

    // User B untouched
    const balanceB = await getWalletBalance(userIdB)
    expect(balanceB.total).toBe(50)

    await assertInvariant(userIdA)
    await assertInvariant(userIdB)
  })
})
