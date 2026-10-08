import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Search log creation — mocked route-level tests
//
// Verifies that every search creates a DiscoverySearchTask with the correct
// userId, cached pages skip billing, and unseen pages on existing tasks are
// billed normally.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  chargeCredits: vi.fn(),
  discoverySearch: vi.fn(),
  discoverySearchCacheProbe: vi.fn(),
  taskCreate: vi.fn(),
  taskUpdate: vi.fn(),
  taskFindFirst: vi.fn(),
  taskPageFindUnique: vi.fn(),
  taskPageUpsert: vi.fn(),
  getServerSession: vi.fn(),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (callback: () => unknown) => void callback() }
})
vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    brandProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'brand-profile' }) },
    discoverySearchTask: {
      findFirst: mocks.taskFindFirst,
      create: mocks.taskCreate,
      update: mocks.taskUpdate,
    },
    discoveryTaskPage: {
      findUnique: mocks.taskPageFindUnique,
      upsert: mocks.taskPageUpsert,
    },
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

function resetMocks() {
  vi.clearAllMocks()
  mocks.discoverySearchCacheProbe.mockResolvedValue(null)
  mocks.taskFindFirst.mockResolvedValue(null)
  mocks.taskPageFindUnique.mockResolvedValue(null)
  mocks.taskUpdate.mockResolvedValue({})
  mocks.taskPageUpsert.mockResolvedValue({})
  mocks.chargeCredits.mockResolvedValue({
    ok: true,
    cost: 6,
    refund: vi.fn(),
    tier: 'PRO',
    balance: {},
  })
  mocks.discoverySearch.mockResolvedValue({
    results: Array.from({ length: 10 }, (_, i) => ({ id: `cdb:instagram:${i}` })),
    total: 10,
    warnings: [],
  })
  mocks.taskCreate.mockResolvedValue({ id: 'task-1' })
}

describe('discovery search log creation', () => {
  beforeEach(resetMocks)

  // ---- 1. Task created with correct userId per user ----------------------

  it('creates DiscoverySearchTask with the correct userId for each caller', async () => {
    // User A searches
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-alpha' } })
    await GET(new NextRequest('http://localhost/api/discovery/club-search?platform=instagram&q=travel'))

    expect(mocks.taskCreate).toHaveBeenCalledOnce()
    expect(mocks.taskCreate.mock.calls[0][0].data.userId).toBe('user-alpha')

    // Reset and search as User B
    resetMocks()
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-beta' } })
    await GET(new NextRequest('http://localhost/api/discovery/club-search?platform=instagram&q=fitness'))

    expect(mocks.taskCreate).toHaveBeenCalledOnce()
    expect(mocks.taskCreate.mock.calls[0][0].data.userId).toBe('user-beta')
  })

  // ---- 2. Cached page: no charge, no search, updatedAt bumped -----------

  it('returns cached snapshot without calling discoverySearch or chargeCredits', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-cached' } })

    const cachedSnapshot = {
      results: [{ id: 'cdb:instagram:cached' }],
      total: 1,
      warnings: [],
      task_id: 'task-existing',
      page: 0,
    }

    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-existing',
      platform: 'instagram',
      request: { platform: 'instagram', query: 'travel', limit: 10 },
    })
    mocks.taskPageFindUnique.mockResolvedValue({
      taskId: 'task-existing',
      page: 0,
      data: cachedSnapshot,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/discovery/club-search?platform=instagram&task_id=task-existing&page=0'),
    )

    expect(response.status).toBe(200)
    expect(mocks.chargeCredits).not.toHaveBeenCalled()
    expect(mocks.discoverySearch).not.toHaveBeenCalled()
    // updatedAt bumped via after()
    expect(mocks.taskUpdate).toHaveBeenCalledWith({
      where: { id: 'task-existing' },
      data: { updatedAt: expect.any(Date) },
    })

    const body = await response.json()
    expect(body.from_task).toBe(true)
    expect(body.task_id).toBe('task-existing')
  })

  // ---- 3. Unseen page on existing task: charges + searches --------------

  it('charges credits and calls discoverySearch for an unseen page on an existing task', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-paged' } })

    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-existing-2',
      platform: 'instagram',
      request: { platform: 'instagram', query: 'travel', limit: 10 },
    })
    mocks.taskPageFindUnique.mockResolvedValue(null) // page 1 not cached

    const response = await GET(
      new NextRequest('http://localhost/api/discovery/club-search?platform=instagram&task_id=task-existing-2&page=1'),
    )

    expect(response.status).toBe(200)
    expect(mocks.chargeCredits).toHaveBeenCalledOnce()
    expect(mocks.discoverySearch).toHaveBeenCalledOnce()
  })
})
