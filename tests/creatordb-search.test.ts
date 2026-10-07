import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/creatordb-usage', () => ({ creatorDbFetch: vi.fn() }))
import { creatorDbFetch } from '@/lib/creatordb-usage'
import { CreatorDbApiError, creatordbSearch } from '@/lib/creatordb'

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })

describe('CreatorDB search request schema', () => {
  it.each(['instagram', 'tiktok', 'youtube'] as const)(
    'does not request billed enrichment fields for %s discovery results', async platform => {
      vi.stubEnv('CREATORDB_API_KEY', 'mock-key')
      vi.mocked(creatorDbFetch).mockImplementation(async (url, init) => {
        expect(url).toBe(`https://apiv3.creatordb.app/${platform}/search`)
        const body = JSON.parse(String(init.body))
        expect(body).not.toHaveProperty('fields')
        expect(body).toMatchObject({ pageSize: 10, offset: 0 })
        return Response.json({ success: true, creditsAvailable: 9999, data: {
          totalResults: 1,
          creatorList: [{
            uniqueId: 'example',
            displayName: 'Example Creator',
            avatarUrl: 'https://example.com/avatar.jpg',
            totalFollowers: 15000,
            totalSubscribers: 15000,
          }],
        } })
      })
      const result = await creatordbSearch({ platform, country: 'US', minFollowers: 10000, maxFollowers: 20000, limit: 10, page: 0 })
      expect(result.results[0]).toMatchObject({
        display_name: 'Example Creator',
        follower_count: 15000,
        avatar_url: 'https://example.com/avatar.jpg',
      })
      expect(result.results[0].bio).toBeNull()
      expect(result.results[0].niche_tags).toEqual([])
      expect(result.credits_left).toBe(9999)
      expect(creatorDbFetch).toHaveBeenCalledTimes(1)
    },
  )

  it('maps free-text search to documented hashtag filters instead of taxonomy-only niches', async () => {
    vi.stubEnv('CREATORDB_API_KEY', 'mock-key')
    vi.mocked(creatorDbFetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init.body))
      expect(body.filters).toContainEqual({
        filterName: 'hashtags',
        op: 'in',
        value: ['skincare', 'creator', 'beauty'],
      })
      expect(body.filters.some((filter: any) => filter.filterName === 'niches')).toBe(false)
      return Response.json({ success: true, creditsUsed: 1, creditsAvailable: 9999, data: { creatorList: [] } })
    })

    await creatordbSearch({
      platform: 'tiktok',
      query: 'Skincare creator',
      bioKeywords: ['Beauty'],
      limit: 10,
    })
  })

  it('assigns unique ids when CreatorDB omits channelId and uniqueId', async () => {
    vi.stubEnv('CREATORDB_API_KEY', 'mock-key')
    vi.mocked(creatorDbFetch).mockResolvedValue(Response.json({
      success: true,
      data: {
        totalResults: 2,
        creatorList: [
          { displayName: 'First incomplete creator', totalFollowers: 12000 },
          { displayName: 'Second incomplete creator', totalFollowers: 11000 },
        ],
      },
    }))

    const result = await creatordbSearch({ platform: 'tiktok', limit: 10, page: 0 })
    const ids = result.results.map((creator: any) => creator.id)

    expect(ids).toEqual(['cdb:tiktok:result-0', 'cdb:tiktok:result-1'])
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('cdb:tiktok:')
  })

  it('retries 5xx responses but never retries a 4xx response', async () => {
    vi.stubEnv('CREATORDB_API_KEY', 'mock-key')
    vi.useFakeTimers()
    vi.mocked(creatorDbFetch)
      .mockResolvedValueOnce(Response.json({ success: false }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { creatorList: [] } }))
    const retried = creatordbSearch({ platform: 'instagram', limit: 10 })
    await vi.advanceTimersByTimeAsync(250)
    await expect(retried).resolves.toMatchObject({ results: [] })
    expect(creatorDbFetch).toHaveBeenCalledTimes(2)

    vi.clearAllMocks()
    vi.useRealTimers()
    vi.mocked(creatorDbFetch).mockResolvedValue(Response.json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorDescription: 'Invalid filter',
      traceId: 'trace-400',
    }, { status: 400 }))
    await expect(creatordbSearch({ platform: 'instagram', limit: 10 })).rejects.toMatchObject({
      name: 'CreatorDbApiError',
      errorCode: 'VALIDATION_ERROR',
      traceId: 'trace-400',
      httpStatus: 400,
    } satisfies Partial<CreatorDbApiError>)
    expect(creatorDbFetch).toHaveBeenCalledTimes(1)
  })
})
