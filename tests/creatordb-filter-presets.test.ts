import { describe, expect, it } from 'vitest'
import {
  CREATORDB_FILTER_CATALOG,
  CREATORDB_FIELD_MAP,
  creatorDbFieldName,
  type CreatorDbCanonicalField,
  type CreatorDbPlatform,
} from '@/lib/creatordb-filter-fields'
import { buildCustomSearchRequest, buildSearchRequest } from '@/lib/creatordb-search-request'

const platforms: CreatorDbPlatform[] = ['instagram', 'tiktok', 'youtube']
const fields = Object.keys(CREATORDB_FIELD_MAP) as CreatorDbCanonicalField[]

describe('CreatorDB canonical field mapping', () => {
  it('exposes 33 frontend filters without identity or email filters', () => {
    expect(CREATORDB_FILTER_CATALOG).toHaveLength(33)
    expect(new Set(CREATORDB_FILTER_CATALOG.map((item) => item.field)).size).toBe(33)
    expect(CREATORDB_FILTER_CATALOG.some((item) => item.field === ('hasEmail' as any))).toBe(false)
    expect(CREATORDB_FILTER_CATALOG.some((item) => item.field === ('displayName' as any))).toBe(false)
    expect(CREATORDB_FILTER_CATALOG.some((item) => item.field === ('uniqueId' as any))).toBe(false)
  })
  it.each(platforms)('maps every canonical field for %s', (platform) => {
    for (const field of fields) {
      expect(creatorDbFieldName(field, platform)).toBe(CREATORDB_FIELD_MAP[field][platform])
    }
  })

  it('uses subscribers and Shorts fields for YouTube', () => {
    expect(creatorDbFieldName('followers', 'youtube')).toBe('totalSubscribers')
    expect(creatorDbFieldName('shortEngagementRate', 'youtube')).toBe('avgRecentShortsEngagementRate')
    expect(creatorDbFieldName('shortMedianViews', 'youtube')).toBe('medianRecentShortsViews')
    expect(creatorDbFieldName('shortMinLikes', 'youtube')).toBe('minRecentShortsLikes')
    expect(creatorDbFieldName('shortViewsGrowth', 'youtube')).toBe('avgRecentShortsViewsGrowth')
  })
})

describe('CreatorDB preset request builder', () => {
  const completeOverrides = {
    A: { values: { niches: ['id_beauty_Beauty'] } },
    B: { values: { niches: ['id_beauty_Beauty'] } },
    C: { values: { audienceAge: '25-34', niches: ['id_beauty_Beauty'] } },
    D: { values: { platformScoreMin: 0.5, niches: ['id_beauty_Beauty'] } },
  } as const

  it.each(['A', 'B', 'C', 'D'] as const)('builds preset %s with 8 filters when user-selected values are supplied', (preset) => {
    const request = buildSearchRequest('instagram', preset, completeOverrides[preset], { pageSize: 100 })
    expect(request.filters).toHaveLength(8)
    expect(request.pageSize).toBe(100)
    expect(request.desc).toBe(true)
  })

  it('translates fields, applies overrides, and omits empty niches', () => {
    const request = buildSearchRequest('youtube', 'A', {
      country: 'US',
      audienceLocation: 'CAN',
      values: { followersMin: 25_000, niches: [] },
    })
    expect(request.filters).toContainEqual({ filterName: 'country', op: '=', value: 'USA' })
    expect(request.filters).toContainEqual({ filterName: 'mainAudienceLocation', op: '=', value: 'CAN' })
    expect(request.filters).toContainEqual({ filterName: 'totalSubscribers', op: '>', value: 25_000 })
    expect(request.filters.some((filter) => filter.filterName === 'niches')).toBe(false)
    expect(request.sortBy).toBe('avgRecentShortsEngagementRate')
  })

  it('rejects an 11th filter instead of silently dropping it', () => {
    expect(() => buildSearchRequest('instagram', 'A', {
      values: { niches: ['id_beauty_Beauty'] },
      extraFilters: [
        { field: 'platformScore', op: '>', value: 0.5 },
        { field: 'shortMedianViews', op: '>', value: 10_000 },
        { field: 'shortMinLikes', op: '>', value: 100 },
      ],
    })).toThrow('At most 2 extra filters')

    expect(() => buildSearchRequest('instagram', 'A', {
      values: { niches: ['id_beauty_Beauty'] },
      extraFilters: [
        { field: 'platformScore', op: '>', value: 0.5 },
        { field: 'shortMedianViews', op: '>', value: 10_000 },
      ],
    })).not.toThrow()
  })

  it('computes lastPublishTime from an injected clock in Unix milliseconds', () => {
    const now = 1_800_000_000_000
    const request = buildSearchRequest('tiktok', 'B', {}, {}, () => now)
    expect(request.filters).toContainEqual({
      filterName: 'lastPublishTime',
      op: '>',
      value: now - 30 * 24 * 60 * 60 * 1000,
    })
  })

  it('validates operator/type compatibility and pagination limits', () => {
    expect(() => buildSearchRequest('youtube', 'A', {
      extraFilters: [{ field: 'followers', op: 'in', value: ['10000'] }],
    })).toThrow('Operator in is invalid for followers')
    expect(() => buildSearchRequest('youtube', 'A', {}, { pageSize: 101 })).toThrow('pageSize')
  })
})

describe('CreatorDB custom filter builder', () => {
  it('translates selected filters for YouTube Shorts', () => {
    const request = buildCustomSearchRequest('youtube', [
      { field: 'followers', op: '>', value: 10_000 },
      { field: 'shortAvgViews', op: '>', value: 5_000 },
      { field: 'isAccountVerified', op: '=', value: true },
    ])
    expect(request.filters).toEqual([
      { filterName: 'totalSubscribers', op: '>', value: 10_000 },
      { filterName: 'avgRecentShortsViews', op: '>', value: 5_000 },
      { filterName: 'isAccountVerified', op: '=', value: true },
    ])
  })

  it('normalizes searchable country and language option codes', () => {
    const request = buildCustomSearchRequest('instagram', [
      { field: 'country', op: '=', value: 'US' },
      { field: 'mainLanguage', op: '=', value: 'en' },
    ])
    expect(request.filters).toContainEqual({ filterName: 'country', op: '=', value: 'USA' })
    expect(request.filters).toContainEqual({ filterName: 'mainLanguage', op: '=', value: 'eng' })
  })

  it('rejects more than 10 filters', () => {
    const filters = Array.from({ length: 11 }, (_, index) => ({
      field: 'followers' as const,
      op: '>' as const,
      value: index,
    }))
    expect(() => buildCustomSearchRequest('instagram', filters)).toThrow('limited to 10 filters')
  })
})
