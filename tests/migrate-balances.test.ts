import { describe, it, expect } from 'vitest'
import { planMigrationLots } from '@/scripts/migrate-credit-balances'
import { addMonths } from '@/lib/wallet'

const NOW = new Date('2026-09-05T00:00:00Z')
const USER = 'test-user-id'

function makeRow(id: string, amount: number, daysAgo: number) {
  return {
    id,
    amount,
    createdAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
  }
}

describe('planMigrationLots', () => {
  it('full balance: single purchase absorbs all credits', () => {
    const rows = [makeRow('row1', 200, 30)]
    const lots = planMigrationLots(rows, 200, USER, NOW)
    expect(lots).toHaveLength(1)
    expect(lots[0].reference).toBe('migrate:row1')
    expect(lots[0].credits).toBe(200)
    expect(lots[0].skippedExpired).toBeFalsy()
  })

  it('partial consumption: remaining balance from newest purchase', () => {
    // User bought 100 credits twice; spent 50, so 150 remain
    // Newest → oldest: row2 (recent), row1 (older)
    // Allocation: 100 from row2, 50 from row1
    const rows = [
      makeRow('row1', 100, 60), // older
      makeRow('row2', 100, 10), // newer
    ]
    const lots = planMigrationLots(rows, 150, USER, NOW)

    // Should have 2 lots, newest first
    const liveRows = lots.filter((l) => !l.skippedExpired)
    expect(liveRows).toHaveLength(2)
    expect(liveRows[0].reference).toBe('migrate:row2') // newest first
    expect(liveRows[0].credits).toBe(100)
    expect(liveRows[1].reference).toBe('migrate:row1')
    expect(liveRows[1].credits).toBe(50)
  })

  it('expired purchase row is skipped (credits from it are lost)', () => {
    // Purchase 400 days ago → expires 400-365 = 35 days before NOW → already expired
    const expiredRow = makeRow('expired1', 100, 400)
    const expiresAt = addMonths(expiredRow.createdAt, 12)
    expect(expiresAt < NOW).toBe(true) // sanity check

    const liveRow = makeRow('live1', 100, 10) // recent, not expired

    const lots = planMigrationLots([expiredRow, liveRow], 150, USER, NOW)

    const skipped = lots.filter((l) => l.skippedExpired)
    const granted = lots.filter((l) => !l.skippedExpired)

    // expired row marked as skip
    expect(skipped).toHaveLength(1)
    expect(skipped[0].reference).toBe('migrate:expired1')

    // live row gets the remaining 50 (150 balance - 100 from expired = 50 unallocated after expired skip)
    // Wait: the newer row is live1 (10 days ago), older is expired1 (400 days ago).
    // Sorted newest→oldest: live1 first, then expired1.
    // So: live1 takes min(100, 150)=100. Remaining=50.
    // expired1 takes min(100, 50)=50 → but expired → skipped.
    // Total remaining after loop: 0.
    // Adjustment lot: 0 (nothing to adjust since after the skip balance=0).
    // So granted has 1 row (live1=100), skipped has 1 row (expired1=50).
    expect(granted.length).toBeGreaterThanOrEqual(1)
    const liveLot = granted.find((l) => l.reference === 'migrate:live1')
    expect(liveLot).toBeDefined()
    expect(liveLot!.credits).toBe(100)
  })

  it('adjustment remainder: balance with no purchase rows gets a single lot', () => {
    const lots = planMigrationLots([], 75, USER, NOW, 75)
    expect(lots).toHaveLength(1)
    expect(lots[0].reference).toBe(`migrate:adjust:${USER}`)
    expect(lots[0].credits).toBe(75)
    expect(lots[0].expiresAt.getTime()).toBeGreaterThan(NOW.getTime())
  })

  it('unattributed remainder without adjustmentNet falls into a tail lot', () => {
    const lots = planMigrationLots([], 75, USER, NOW)
    expect(lots).toHaveLength(1)
    expect(lots[0].reference).toBe(`migrate:tail:${USER}`)
    expect(lots[0].credits).toBe(75)
  })

  it('adjustment credits are allocated FIRST, before purchase rows', () => {
    // 100 in purchase, 150 balance (extra 50 from admin adjustment)
    const rows = [makeRow('row1', 100, 10)]
    const lots = planMigrationLots(rows, 150, USER, NOW, 50)

    const liveRows = lots.filter((l) => !l.skippedExpired)
    expect(liveRows).toHaveLength(2)

    const adjust = liveRows.find((l) => l.reference === `migrate:adjust:${USER}`)
    expect(adjust!.credits).toBe(50)

    const purchase = liveRows.find((l) => l.reference === 'migrate:row1')
    expect(purchase!.credits).toBe(100)
  })

  it('recent admin grant survives even when the only purchase is expired', () => {
    // Expired pack (400 days old) + 50-credit admin grant; balance 50.
    const rows = [makeRow('expired1', 100, 400)]
    const lots = planMigrationLots(rows, 50, USER, NOW, 50)
    const live = lots.filter((l) => !l.skippedExpired)
    expect(live).toHaveLength(1)
    expect(live[0].reference).toBe(`migrate:adjust:${USER}`)
    expect(live[0].credits).toBe(50)
  })

  it('returns empty array when legacyBalance is zero or negative', () => {
    expect(planMigrationLots([], 0, USER, NOW)).toHaveLength(0)
    expect(planMigrationLots([], -10, USER, NOW)).toHaveLength(0)
  })
})
