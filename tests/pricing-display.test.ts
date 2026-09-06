import { describe, it, expect } from 'vitest'
import { computeEquivalents } from '@/lib/pricing-display'

const PRICES: Record<string, number> = {
  chat_standard: 2,
  chat_advanced: 5,
  image: 8,
  discovery_search: 6,
  profile_view: 10,
  outreach: 20,
  analytics: 15,
}

describe('computeEquivalents', () => {
  it('returns floor of credits / price for each feature', () => {
    const result = computeEquivalents(100, PRICES)
    const map = Object.fromEntries(result.map((r) => [r.featureKey, r.count]))
    expect(map['chat_standard']).toBe(50)  // floor(100/2)
    expect(map['chat_advanced']).toBe(20)  // floor(100/5)
    expect(map['image']).toBe(12)           // floor(100/8)
    expect(map['discovery_search']).toBe(16) // floor(100/6)
    expect(map['profile_view']).toBe(10)   // floor(100/10)
    expect(map['outreach']).toBe(5)         // floor(100/20)
    expect(map['analytics']).toBe(6)        // floor(100/15)
  })

  it('skips features with price=0 or missing', () => {
    const result = computeEquivalents(100, { chat_standard: 0, chat_advanced: 5 })
    expect(result.find((r) => r.featureKey === 'chat_standard')).toBeUndefined()
    expect(result.find((r) => r.featureKey === 'chat_advanced')).toBeDefined()
  })

  it('skips features where floor result is 0', () => {
    // 3 credits / price=10 → floor=0, must be excluded
    const result = computeEquivalents(3, { profile_view: 10, chat_standard: 2 })
    expect(result.find((r) => r.featureKey === 'profile_view')).toBeUndefined()
    expect(result.find((r) => r.featureKey === 'chat_standard')!.count).toBe(1)
  })

  it('returns empty array when credits is 0', () => {
    expect(computeEquivalents(0, PRICES)).toHaveLength(0)
  })

  it('respects FEATURE_ORDER ordering', () => {
    const result = computeEquivalents(1000, PRICES)
    const keys = result.map((r) => r.featureKey)
    const expected = ['chat_standard', 'chat_advanced', 'image', 'discovery_search', 'profile_view', 'outreach', 'analytics']
    expect(keys).toEqual(expected)
  })
})
