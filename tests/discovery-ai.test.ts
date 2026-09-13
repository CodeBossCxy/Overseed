import { describe, expect, it } from 'vitest'
import { sanitizeParsedQuery } from '@/lib/discovery-ai'

describe('sanitizeParsedQuery', () => {
  it('accepts a well-formed model reply', () => {
    const parsed = sanitizeParsedQuery({
      keywords: 'beauty skincare',
      platform: 'youtube',
      country: 'us',
      min_followers: 100000,
      max_followers: null,
      min_engagement: 3,
      gender: 'female',
      language: 'en',
      bio_keywords: ['skincare', 'vegan'],
      last_post: 90,
      audience_age: '18-24',
    })
    expect(parsed).toMatchObject({
      keywords: 'beauty skincare',
      platform: 'youtube',
      country: 'US',
      min_followers: 100000,
      max_followers: null,
      min_engagement: 3,
      gender: 'FEMALE',
      language: 'en',
      bio_keywords: ['skincare', 'vegan'],
      last_post: 90,
      audience_age: '18-24',
    })
  })

  it('nulls out invalid enums and out-of-range numbers', () => {
    const parsed = sanitizeParsedQuery({
      keywords: '',
      platform: 'twitch',
      country: 'USA',
      min_followers: -5,
      min_engagement: 250,
      gender: 'other',
      language: 'english',
      bio_keywords: 'skincare', // not an array
      last_post: '1000',
      audience_age: '20-30',
    })
    expect(parsed).toEqual({
      keywords: null,
      platform: null,
      country: null,
      min_followers: null,
      max_followers: null,
      min_engagement: null,
      max_engagement: null,
      gender: null,
      language: null,
      bio_keywords: [],
      last_post: null,
      audience_age: null,
    })
  })

  it('swaps inverted follower bounds and buckets last_post', () => {
    const parsed = sanitizeParsedQuery({
      min_followers: 500000,
      max_followers: 10000,
      last_post: 30,
    })
    expect(parsed.min_followers).toBe(10000)
    expect(parsed.max_followers).toBe(500000)
    expect(parsed.last_post).toBe(90)
  })

  it('caps bio keywords at 10 and trims entries', () => {
    const parsed = sanitizeParsedQuery({
      bio_keywords: Array.from({ length: 15 }, (_, i) => `  tag${i}  `),
    })
    expect(parsed.bio_keywords).toHaveLength(10)
    expect(parsed.bio_keywords[0]).toBe('tag0')
  })
})
