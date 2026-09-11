import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  find: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clubSearchCache: {
      findUnique: db.find,
      upsert: db.upsert,
    },
  },
}))

import { youtubeBrowseCreators, YOUTUBE_BROWSE_CACHE_KEY } from '@/lib/youtube'

const originalKey = process.env.YOUTUBE_API_KEY

// Routes YouTube API calls: every search returns the given channel ids,
// the channels call returns full channel objects.
function stubYoutubeFetch(channels: any[]) {
  const fetchMock = vi.fn(async (input: any) => {
    const url = String(input)
    if (url.includes('/search')) {
      return new Response(
        JSON.stringify({ items: channels.map((c) => ({ id: { channelId: c.id } })) }),
        { status: 200 },
      )
    }
    if (url.includes('/channels')) {
      return new Response(JSON.stringify({ items: channels }), { status: 200 })
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const channel = (id: string, handle: string, subs: number) => ({
  id,
  snippet: {
    title: handle,
    customUrl: `@${handle}`,
    description: 'desc',
    thumbnails: { medium: { url: `https://yt.example/${handle}.jpg` } },
  },
  statistics: { subscriberCount: String(subs), hiddenSubscriberCount: false },
})

describe('YouTube default browse list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.YOUTUBE_API_KEY = 'test-key'
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.YOUTUBE_API_KEY
    else process.env.YOUTUBE_API_KEY = originalKey
    vi.unstubAllGlobals()
  })

  it('serves a fresh cache row without any YouTube API call', async () => {
    db.find.mockResolvedValue({
      data: { results: [{ id: 'yt:1', handle: 'cached' }] },
      fetchedAt: new Date(), // fresh
    })
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('network should not be called')
    }))

    const result = await youtubeBrowseCreators()

    expect(result.results[0].handle).toBe('cached')
    expect(db.find).toHaveBeenCalledWith({ where: { key: YOUTUBE_BROWSE_CACHE_KEY } })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('builds, ranks by subscribers desc, and persists when no cache row exists', async () => {
    db.find.mockResolvedValue(null)
    db.upsert.mockResolvedValue({})
    const fetchMock = stubYoutubeFetch([
      channel('c1', 'small', 1_000),
      channel('c2', 'huge', 90_000_000),
      channel('c3', 'mid', 500_000),
    ])

    const result = await youtubeBrowseCreators()

    expect(result.results.map((r: any) => r.handle)).toEqual(['huge', 'mid', 'small'])
    expect(result.results[0].platform).toBe('youtube')
    expect(result.results[0].follower_count).toBe(90_000_000)
    expect(result.results[0].profile_url).toBe('https://www.youtube.com/@huge')
    // 8 niche searches + 1 channels batch
    expect(fetchMock).toHaveBeenCalledTimes(9)
    expect(db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: YOUTUBE_BROWSE_CACHE_KEY } }),
    )
  })

  it('serves the stale list when a rebuild fails', async () => {
    db.find.mockResolvedValue({
      data: { results: [{ id: 'yt:1', handle: 'stale' }] },
      fetchedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // expired
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 403 }),
      ),
    )

    const result = await youtubeBrowseCreators()

    expect(result.results[0].handle).toBe('stale')
    expect(db.upsert).not.toHaveBeenCalled()
  })
})
