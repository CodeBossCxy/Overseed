import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  searchFind: vi.fn(),
  searchUpsert: vi.fn(),
  enrichFind: vi.fn(),
  enrichUpsert: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clubSearchCache: {
      findUnique: db.searchFind,
      upsert: db.searchUpsert,
    },
    creatorEnrichmentCache: {
      findUnique: db.enrichFind,
      upsert: db.enrichUpsert,
    },
  },
}))

import { clubAnalytics, clubEnrich, clubSearch, clubShowcase } from '@/lib/influencers-club'

const originalKey = process.env.INFLUENCERS_CLUB_API_KEY

describe('Influencers Club persistent request cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.INFLUENCERS_CLUB_API_KEY
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('network should not be called')
    }))
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.INFLUENCERS_CLUB_API_KEY
    else process.env.INFLUENCERS_CLUB_API_KEY = originalKey
    vi.unstubAllGlobals()
  })

  it('returns an identical discovery search from PostgreSQL without a Club call', async () => {
    db.searchFind.mockResolvedValue({
      data: {
        results: [{ id: 'club:instagram:1', handle: 'cached_creator' }],
        warnings: [],
        cache_hits: 0,
        live_calls: 1,
      },
      fetchedAt: new Date('2020-01-01'),
    })

    const result = await clubSearch({
      platform: 'instagram',
      query: 'skincare',
      country: 'US',
      minFollowers: 10_000,
      maxFollowers: 100_000,
      limit: 10,
      page: 0,
    })

    expect(result.cached).toBe(true)
    expect(result.cache_hits).toBe(1)
    expect(result.live_calls).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns an old profile cache row without a Club call', async () => {
    const detail = { handle: 'cached_profile', followers: 1234 }
    db.enrichFind.mockResolvedValue({
      data: { detail, email: null },
      fetchedAt: new Date('2020-01-01'),
    })

    await expect(clubEnrich('instagram', 'cached_profile')).resolves.toEqual(detail)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns an old analytics cache row without a Club call', async () => {
    const detail = { handle: 'cached_analytics', audience: { countries: [] } }
    db.enrichFind.mockResolvedValue({
      data: { detail, email: null },
      fetchedAt: new Date('2020-01-01'),
    })

    await expect(clubAnalytics('instagram', 'cached_analytics')).resolves.toEqual(detail)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('serves the browse showcase from its cache row without a Club call', async () => {
    db.searchFind.mockResolvedValue({
      data: {
        results: [{ id: 'club:instagram:1', handle: 'top_creator', avatar_url: '/api/s3-image/x.jpg' }],
        warnings: [],
      },
      fetchedAt: new Date('2020-01-01'),
    })

    const result = await clubShowcase()

    expect(result.cached).toBe(true)
    expect(result.results[0].handle).toBe('top_creator')
    expect(db.searchFind).toHaveBeenCalledWith({ where: { key: 'showcase:instagram:v1' } })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('builds the showcase with the tri-platform creator_has filter and persists it', async () => {
    process.env.INFLUENCERS_CLUB_API_KEY = 'test-key'
    db.searchFind.mockResolvedValue(null)
    db.searchUpsert.mockResolvedValue({})
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accounts: [
            {
              user_id: '1',
              profile: { username: 'top_creator', full_name: 'Top', followers: 5_000_000 },
            },
          ],
          total: 1,
          credits_left: 10,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await clubShowcase()

    expect(result.results[0].handle).toBe('top_creator')
    const discoveryCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/public/v1/discovery/'),
    )
    expect(discoveryCall).toBeTruthy()
    const body = JSON.parse(discoveryCall![1].body)
    expect(body.platform).toBe('instagram')
    expect(body.paging).toEqual({ limit: 10, page: 0 })
    expect(body.filters.creator_has).toEqual({ has_tiktok: true, has_youtube: true })
    // Persisted under the dedicated showcase key (plus clubSearch's own row)
    expect(db.searchUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'showcase:instagram:v1' } }),
    )
  })

  it('stores a successful zero-result discovery request', async () => {
    process.env.INFLUENCERS_CLUB_API_KEY = 'test-key'
    db.searchFind.mockResolvedValue(null)
    db.searchUpsert.mockResolvedValue({})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accounts: [], total: 0, credits_left: 10 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const result = await clubSearch({
      platform: 'tiktok',
      query: 'no matching creator',
      limit: 10,
      page: 0,
    })

    expect(result.results).toEqual([])
    expect(result.cached).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(db.searchUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          request: expect.objectContaining({
            platform: 'tiktok',
            query: 'no matching creator',
          }),
          data: expect.objectContaining({ results: [] }),
        }),
      }),
    )
  })
})
