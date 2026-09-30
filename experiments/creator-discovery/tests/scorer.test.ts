import { describe, it, expect } from 'vitest'
import { scoreCandidate, type ScoringInput } from '../src/scorer.js'

function makeInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    url: 'https://instagram.com/beautyqueen',
    normalizedUrl: 'https://instagram.com/beautyqueen',
    domain: 'instagram.com',
    urlType: 'instagram_profile',
    platform: 'instagram',
    extractedHandle: 'beautyqueen',
    title: null,
    description: null,
    searchRank: 10,
    timesDiscovered: 1,
    ...overrides,
  }
}

describe('scoreCandidate', () => {
  it('Instagram profile scores higher than unknown URL', () => {
    const igScore = scoreCandidate(makeInput({ urlType: 'instagram_profile' })).score
    const unknownScore = scoreCandidate(makeInput({ urlType: 'unknown', platform: null, extractedHandle: null, domain: 'example.com', url: 'https://example.com', normalizedUrl: 'https://example.com' })).score
    expect(igScore).toBeGreaterThan(unknownScore)
  })

  it('multiple discoveries increase score', () => {
    const once = scoreCandidate(makeInput({ timesDiscovered: 1 })).score
    const thrice = scoreCandidate(makeInput({ timesDiscovered: 3 })).score
    expect(thrice).toBeGreaterThan(once)
  })

  it('high search rank (top 3) increases score', () => {
    const lowRank = scoreCandidate(makeInput({ searchRank: 10 })).score
    const highRank = scoreCandidate(makeInput({ searchRank: 2 })).score
    expect(highRank).toBeGreaterThan(lowRank)
  })

  it('creator terms in title increase score', () => {
    const without = scoreCandidate(makeInput({ title: 'Some random page' })).score
    const withTerms = scoreCandidate(makeInput({ title: 'Jane Doe — content creator' })).score
    expect(withTerms).toBeGreaterThan(without)
  })

  it('contact terms in title increase score', () => {
    const without = scoreCandidate(makeInput({ title: 'My page' })).score
    const withContact = scoreCandidate(makeInput({ title: 'Contact me for business inquiries' })).score
    expect(withContact).toBeGreaterThan(without)
  })

  it('agency_or_directory type decreases score relative to unknown', () => {
    const agencyScore = scoreCandidate(makeInput({
      urlType: 'agency_or_directory',
      platform: null,
      extractedHandle: null,
    })).score
    const unknownScore = scoreCandidate(makeInput({
      urlType: 'unknown',
      platform: null,
      extractedHandle: null,
    })).score
    expect(agencyScore).toBeLessThan(unknownScore)
  })

  it('score is clamped at minimum 0', () => {
    // Pile on negatives: agency + article + unknown type — score should not go below 0
    const result = scoreCandidate(makeInput({
      urlType: 'agency_or_directory',
      platform: null,
      extractedHandle: null,
      searchRank: 50,
      timesDiscovered: 1,
    }))
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('score is clamped at maximum 100', () => {
    const result = scoreCandidate(makeInput({
      urlType: 'instagram_profile',
      extractedHandle: 'beautyqueen',
      title: 'Jane — content creator and influencer',
      description: 'business inquiries: jane@email.com. Fashion and beauty blogger',
      searchRank: 1,
      timesDiscovered: 6,
    }))
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('returns factors array explaining the score', () => {
    const result = scoreCandidate(makeInput({
      urlType: 'instagram_profile',
      title: 'Jane — influencer',
      searchRank: 2,
      timesDiscovered: 2,
    }))
    expect(Array.isArray(result.factors)).toBe(true)
    expect(result.factors.length).toBeGreaterThan(0)
    const names = result.factors.map((f) => f.name)
    expect(names).toContain('social_profile_url')
    expect(names).toContain('high_search_rank_top3')
    expect(names).toContain('multiple_discoveries')
    for (const f of result.factors) {
      expect(typeof f.name).toBe('string')
      expect(typeof f.delta).toBe('number')
    }
  })

  it('link_in_bio scores above base but below social profile', () => {
    const libScore = scoreCandidate(makeInput({ urlType: 'link_in_bio', platform: null, extractedHandle: 'somehandle' })).score
    const igScore = scoreCandidate(makeInput({ urlType: 'instagram_profile' })).score
    expect(libScore).toBeGreaterThan(30) // above base
    expect(libScore).toBeLessThan(igScore)
  })
})
