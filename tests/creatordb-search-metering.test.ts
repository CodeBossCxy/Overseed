import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chargeCredits: vi.fn(),
  discoverySearch: vi.fn(),
  discoverySearchCacheProbe: vi.fn(),
  taskCreate: vi.fn(),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (callback: () => unknown) => void callback() }
})
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'brand-user' } }),
}))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    brandProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'brand-profile' }) },
    discoverySearchTask: {
      findFirst: vi.fn(),
      create: mocks.taskCreate,
      update: vi.fn(),
    },
    discoveryTaskPage: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock('@/lib/influencers-club', () => ({
  mergeEnrichedProfileFields: vi.fn(async (result) => result),
}))
vi.mock('@/lib/discovery-provider', () => ({
  discoverySearch: mocks.discoverySearch,
  discoverySearchCacheProbe: mocks.discoverySearchCacheProbe,
  getProvider: () => 'creatordb',
  providerName: () => 'CreatorDB',
}))
vi.mock('@/lib/discovery', () => ({ safeLocalCreatorDiscovery: vi.fn() }))
vi.mock('@/lib/youtube', () => ({ youtubeConfigured: () => false, youtubeSearchCreators: vi.fn() }))
vi.mock('@/lib/plan', () => ({ consumeQuota: vi.fn() }))
vi.mock('@/lib/subscription', () => ({ getEffectiveTier: vi.fn() }))
vi.mock('@/lib/credits', () => ({ deductCredits: vi.fn() }))
vi.mock('@/lib/config', () => ({ CREDIT_SYSTEM_ENABLED: true }))
vi.mock('@/lib/metering', () => ({ chargeCredits: mocks.chargeCredits }))
vi.mock('@/lib/wallet', () => ({ walletRefund: vi.fn(), getCreditPrice: vi.fn() }))

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/discovery/club-search/route'

describe('CreatorDB discovery metering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.discoverySearchCacheProbe.mockResolvedValue(null)
    mocks.chargeCredits.mockResolvedValue({
      ok: true,
      cost: 6,
      refund: vi.fn(),
      tier: 'PRO',
      balance: {},
    })
    mocks.discoverySearch.mockResolvedValue({
      results: Array.from({ length: 10 }, (_, index) => ({ id: `cdb:instagram:${index}` })),
      total: 10,
      warnings: [],
    })
    mocks.taskCreate.mockResolvedValue({ id: 'task-1' })
  })

  it('charges the Overseed wallet before calling the active CreatorDB provider', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/discovery/club-search?platform=instagram&q=travel'),
    )

    expect(response.status).toBe(200)
    expect(mocks.chargeCredits).toHaveBeenCalledWith(
      'brand-user',
      'discovery_search',
      expect.stringMatching(/^discovery:brand-user:/),
    )
    expect(mocks.discoverySearch).toHaveBeenCalledOnce()
    expect(mocks.chargeCredits.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.discoverySearch.mock.invocationCallOrder[0],
    )
  })
})
