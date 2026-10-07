import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/creatordb-usage', () => ({ creatorDbFetch: vi.fn() }))
import { creatorDbFetch } from '@/lib/creatordb-usage'
import { creatordbAnalytics, creatordbEnrich, creatordbEnrichForOutreach } from '@/lib/creatordb'

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })

const expected = {
  instagram: {
    profile: ['displayName', 'category', 'avatarUrl', 'bio', 'isBusinessAccount', 'isPrivateAccount', 'isVerified', 'hasSponsors', 'country', 'mainLanguage', 'totalContents', 'totalFollowers', 'totalFollowing', 'subscriberGrowth', 'hashtags', 'niches', 'otherLinks', 'lastPublishTime', 'lastDbUpdateTime'],
    performance: ['contentCountByDays', 'ranking', 'imagesPerformanceRecent', 'reelsPerformanceRecent'],
  },
  tiktok: {
    profile: ['displayName', 'category', 'avatarUrl', 'bio', 'isBusinessAccount', 'isPrivateAccount', 'isVerified', 'hasSponsors', 'country', 'mainLanguage', 'totalContents', 'totalFollowers', 'totalFollowing', 'subscriberGrowth', 'hashtags', 'niches', 'otherLinks', 'lastPublishTime', 'lastDbUpdateTime'],
    performance: ['contentCountByDays', 'ranking', 'videosPerformanceRecent'],
  },
  youtube: {
    profile: ['displayName', 'categoryBreakdown', 'avatarUrl', 'bio', 'isVerified', 'hasSponsors', 'country', 'mainLanguage', 'totalContents', 'totalSubscribers', 'subscriberGrowth', 'hashtags', 'niches', 'otherLinks', 'lastPublishTime', 'lastDbUpdateTime'],
    performance: ['contentCountByDays', 'ranking', 'videosPerformanceRecent', 'shortsPerformanceRecent'],
  },
} as const

describe('CreatorDB enrichment request payloads', () => {
  it.each(['instagram', 'tiktok', 'youtube'] as const)(
    'uses documented request fields for %s', async platform => {
      vi.stubEnv('CREATORDB_API_KEY', 'mock-key')
      vi.mocked(creatorDbFetch).mockImplementation(async (url, init) => {
        const endpoint = new URL(url).pathname.split('/').pop()
        const body = JSON.parse(String(init.body))
        expect(body.uniqueId).toBe('example')
        if (endpoint === 'profile') expect(body.fields).toEqual(expected[platform].profile)
        if (endpoint === 'performance') expect(body.fields).toEqual(expected[platform].performance)
        if (endpoint === 'contact') expect(body.fields).toEqual(['emails'])
        return Response.json({ success: true, creditsUsed: 1, data: endpoint === 'contact' ? { emails: [] } : {} })
      })

      await creatordbEnrich(platform, '@example', { logUserId: 'tester' })
      expect(creatorDbFetch).toHaveBeenCalledTimes(3)
    },
  )

  it('keeps contact email server-only while exposing it to the outreach adapter', async () => {
    vi.stubEnv('CREATORDB_API_KEY', 'mock-key')
    vi.mocked(creatorDbFetch).mockImplementation(async (url) => {
      const endpoint = new URL(url).pathname.split('/').pop()
      return Response.json({
        success: true,
        creditsUsed: 1,
        data: endpoint === 'contact' ? { emails: ['creator@example.com'] } : {},
      })
    })

    const publicDetail = await creatordbEnrich('instagram', '@example')
    expect(publicDetail).not.toHaveProperty('_email')

    const outreach = await creatordbEnrichForOutreach('instagram', '@example')
    expect(outreach.email).toBe('creator@example.com')
    expect(outreach.detail).not.toHaveProperty('_email')
  })

  it.each(['instagram', 'tiktok', 'youtube'] as const)(
    'uses documented audience fields for %s', async platform => {
      vi.stubEnv('CREATORDB_API_KEY', 'mock-key')
      vi.mocked(creatorDbFetch).mockImplementation(async (_url, init) => {
        expect(JSON.parse(String(init.body))).toEqual({
          uniqueId: 'example',
          fields: ['audienceLocations', 'audienceGender', 'audienceAvgAge', 'audienceAgeBreakdown'],
        })
        return Response.json({ success: true, creditsUsed: 1, data: {} })
      })

      await creatordbAnalytics(platform, '@example', { logUserId: 'tester' })
      expect(creatorDbFetch).toHaveBeenCalledTimes(1)
    },
  )
})
