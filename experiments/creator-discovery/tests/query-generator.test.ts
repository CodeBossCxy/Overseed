import { describe, it, expect } from 'vitest'
import { generateQueries } from '../src/query-generator.js'

describe('generateQueries', () => {
  it('generates queries for beauty/instagram (basic case)', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'] })
    expect(queries.length).toBeGreaterThan(0)
    const queryStrings = queries.map((q) => q.query.toLowerCase())
    const hasBeauty = queryStrings.some((q) => q.includes('beauty'))
    const hasInstagram = queryStrings.some((q) => q.includes('instagram') || q.includes('instagram.com'))
    expect(hasBeauty).toBe(true)
    expect(hasInstagram).toBe(true)
  })

  it('includes sub-niches when includeSubNiches is true', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'], includeSubNiches: true })
    const queryStrings = queries.map((q) => q.query.toLowerCase())
    // beauty sub-niches include skincare, makeup, cosmetics
    const hasSubNiche = queryStrings.some((q) => q.includes('skincare') || q.includes('makeup') || q.includes('cosmetics'))
    expect(hasSubNiche).toBe(true)
  })

  it('does not include sub-niches when includeSubNiches is false', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'], includeSubNiches: false })
    const queryStrings = queries.map((q) => q.query.toLowerCase())
    const hasSubNiche = queryStrings.some((q) => q.includes('skincare') || q.includes('makeup'))
    expect(hasSubNiche).toBe(false)
  })

  it('deduplicates identical queries', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'] })
    const keys = queries.map((q) => q.query.toLowerCase().trim())
    const unique = new Set(keys)
    expect(unique.size).toBe(queries.length)
  })

  it('respects maxQueries limit', () => {
    const queries = generateQueries({ niches: ['beauty', 'fashion', 'fitness'], platforms: ['instagram', 'tiktok'], maxQueries: 7 })
    expect(queries.length).toBeLessThanOrEqual(7)
  })

  it('generates site: queries', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'] })
    const hasSite = queries.some((q) => q.query.startsWith('site:'))
    expect(hasSite).toBe(true)
  })

  it('generates contact-intent queries', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'] })
    const hasContact = queries.some((q) =>
      q.query.toLowerCase().includes('business inquiries') ||
      q.query.toLowerCase().includes('contact') ||
      q.query.toLowerCase().includes('collab')
    )
    expect(hasContact).toBe(true)
  })

  it('generates city-specific queries when cities provided', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'], cities: ['Austin', 'Denver'] })
    const hasCityQuery = queries.some((q) => q.query.includes('Austin') || q.query.includes('Denver'))
    expect(hasCityQuery).toBe(true)
  })

  it('returns queries sorted by weight (highest first)', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'] })
    for (let i = 1; i < queries.length; i++) {
      expect(queries[i].weight).toBeLessThanOrEqual(queries[i - 1].weight)
    }
  })

  it('each query has templateId, weight, niche, platform fields', () => {
    const queries = generateQueries({ niches: ['beauty'], platforms: ['instagram'] })
    expect(queries.length).toBeGreaterThan(0)
    for (const q of queries) {
      expect(typeof q.templateId).toBe('string')
      expect(q.templateId.length).toBeGreaterThan(0)
      expect(typeof q.weight).toBe('number')
      expect(typeof q.niche).toBe('string')
      // platform can be null for templates that don't use platform
      expect('platform' in q).toBe(true)
    }
  })
})
