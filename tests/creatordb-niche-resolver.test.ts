import { describe, it, expect } from 'vitest'
import { resolveNiches, _loadMap } from '@/lib/creatordb-niches'

describe('CreatorDB niche resolver', () => {
  // Sanity: mapping files loaded
  it('loads mapping files for all three platforms', () => {
    expect(Object.keys(_loadMap('youtube')).length).toBeGreaterThan(100)
    expect(Object.keys(_loadMap('instagram')).length).toBeGreaterThan(100)
    expect(Object.keys(_loadMap('tiktok')).length).toBeGreaterThan(100)
  })

  // ── Exact match ──────────────────────────────────────────────────────

  it('exact match: "Food" resolves to all YouTube category IDs for food', () => {
    const result = resolveNiches('youtube', 'Food')
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].term).toBe('Food')
    expect(result.matched[0].ids.length).toBeGreaterThan(1) // multiple categories
    expect(result.matched[0].ids).toContain('id_food_PeopleBlogs')
    expect(result.fuzzyMatched).toHaveLength(0)
    expect(result.unmatched).toHaveLength(0)
    expect(result.ids.length).toBeGreaterThan(0)
  })

  it('exact match: Instagram "fashion" (lowercase)', () => {
    const result = resolveNiches('instagram', 'fashion')
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].ids).toContain('id_fashion_All')
    expect(result.ids).toContain('id_fashion_All')
  })

  // ── Case/spacing variants ────────────────────────────────────────────

  it('normalizes case and spacing: "  FOOD " matches food', () => {
    const result = resolveNiches('youtube', '  FOOD ')
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].ids).toContain('id_food_PeopleBlogs')
    expect(result.fuzzyMatched).toHaveLength(0)
    expect(result.unmatched).toHaveLength(0)
  })

  // ── Fuzzy match (typo above 80%) ─────────────────────────────────────

  it('fuzzy match: "fashon" (typo) resolves with similarity >= 80', () => {
    const result = resolveNiches('youtube', 'fashon')
    // Should either exact-match or fuzzy-match to "fashion"
    const total = result.matched.length + result.fuzzyMatched.length
    expect(total).toBe(1)
    if (result.fuzzyMatched.length > 0) {
      expect(result.fuzzyMatched[0].matchedName.toLowerCase()).toBe('fashion')
      expect(result.fuzzyMatched[0].score).toBeGreaterThanOrEqual(80)
    }
    expect(result.unmatched).toHaveLength(0)
    expect(result.ids.length).toBeGreaterThan(0)
  })

  // ── Below threshold ──────────────────────────────────────────────────

  it('unmatched: "xyz" falls below 80% — returns suggestions', () => {
    const result = resolveNiches('youtube', 'xyz')
    expect(result.matched).toHaveLength(0)
    expect(result.fuzzyMatched).toHaveLength(0)
    expect(result.unmatched).toHaveLength(1)
    expect(result.unmatched[0].term).toBe('xyz')
    expect(result.unmatched[0].suggestions.length).toBeGreaterThan(0)
    expect(result.unmatched[0].suggestions.length).toBeLessThanOrEqual(3)
    expect(result.ids).toHaveLength(0)
  })

  // ── Multiple terms ───────────────────────────────────────────────────

  it('multiple terms: "food, asmr" resolves both', () => {
    const result = resolveNiches('youtube', 'food, asmr')
    expect(result.matched).toHaveLength(2)
    const foodIds = result.matched.find((m) => m.term === 'food')!.ids
    const asmrIds = result.matched.find((m) => m.term === 'asmr')!.ids
    expect(foodIds).toContain('id_food_PeopleBlogs')
    expect(asmrIds).toContain('id_asmr_Entertainment')
    // All IDs are merged and deduplicated
    expect(result.ids.length).toBe(new Set(result.ids).size)
    expect(result.ids.length).toBe(foodIds.length + asmrIds.length) // no overlap expected
  })

  it('splitting on semicolon and "and"', () => {
    const result = resolveNiches('youtube', 'food; beauty and asmr')
    expect(result.matched).toHaveLength(3)
  })

  // ── YouTube name shared by multiple categories ───────────────────────

  it('YouTube: "Food" returns IDs across multiple categories', () => {
    const result = resolveNiches('youtube', 'Food')
    const ids = result.matched[0].ids
    // Food exists under PeopleBlogs, Entertainment, TravelEvents, HowtoStyle, etc.
    const categories = ids.map((id) => id.replace(/^id_food_/, ''))
    expect(categories).toContain('PeopleBlogs')
    expect(categories).toContain('Entertainment')
    expect(categories.length).toBeGreaterThan(3)
  })

  // ── Edge: mixed match types ──────────────────────────────────────────

  it('mixed: exact + typo + garbage', () => {
    const result = resolveNiches('youtube', 'food, fashon, xyzabc123')
    expect(result.matched).toHaveLength(1) // food
    expect(result.matched[0].term).toBe('food')
    // fashon should fuzzy-match
    const fuzzyOrMatched = result.fuzzyMatched.length + result.matched.filter(m => m.term === 'fashon').length
    expect(fuzzyOrMatched).toBe(1)
    // xyzabc123 should be unmatched
    expect(result.unmatched).toHaveLength(1)
    expect(result.unmatched[0].term).toBe('xyzabc123')
    // ids from food + fashion but not garbage
    expect(result.ids.length).toBeGreaterThan(0)
  })

  // ── Empty / whitespace ───────────────────────────────────────────────

  it('empty string returns empty result', () => {
    const result = resolveNiches('youtube', '')
    expect(result.matched).toHaveLength(0)
    expect(result.fuzzyMatched).toHaveLength(0)
    expect(result.unmatched).toHaveLength(0)
    expect(result.ids).toHaveLength(0)
  })

  it('whitespace-only returns empty result', () => {
    const result = resolveNiches('youtube', '  , ,  ')
    expect(result.matched).toHaveLength(0)
    expect(result.ids).toHaveLength(0)
  })

  // ── Non-English translation ────────────────────────────────────────────

  it('Chinese: "美食" translates to food and resolves', () => {
    const result = resolveNiches('youtube', '美食')
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].term).toBe('food')
    expect(result.matched[0].translatedFrom).toBe('美食')
    expect(result.matched[0].ids).toContain('id_food_PeopleBlogs')
  })

  it('Chinese: "护肤, 美妆" translates both terms', () => {
    const result = resolveNiches('instagram', '护肤, 美妆')
    expect(result.matched.length + result.fuzzyMatched.length).toBe(2)
    const terms = [...result.matched, ...result.fuzzyMatched].map((m) => m.term)
    expect(terms).toContain('skincare')
    expect(terms).toContain('beauty')
    expect(result.ids.length).toBeGreaterThan(0)
  })

  it('Chinese comma separator: "美食，时尚" splits correctly', () => {
    const result = resolveNiches('youtube', '美食，时尚')
    expect(result.matched.length + result.fuzzyMatched.length).toBe(2)
  })

  it('Mixed Chinese and English: "美食, fitness" resolves both', () => {
    const result = resolveNiches('youtube', '美食, fitness')
    expect(result.matched).toHaveLength(2)
    const terms = result.matched.map((m) => m.term)
    expect(terms).toContain('food')
    expect(terms).toContain('fitness')
    // Only the Chinese term should have translatedFrom
    const foodMatch = result.matched.find((m) => m.term === 'food')
    expect(foodMatch?.translatedFrom).toBe('美食')
    const fitnessMatch = result.matched.find((m) => m.term === 'fitness')
    expect(fitnessMatch?.translatedFrom).toBeUndefined()
  })

  it('Spanish: "comida" translates to food', () => {
    const result = resolveNiches('youtube', 'comida')
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].term).toBe('food')
    expect(result.matched[0].translatedFrom).toBe('comida')
  })

  it('Japanese: "料理" translates to cooking', () => {
    const result = resolveNiches('youtube', '料理')
    const total = result.matched.length + result.fuzzyMatched.length
    expect(total).toBe(1)
  })

  it('Korean: "뷰티" translates to beauty', () => {
    const result = resolveNiches('instagram', '뷰티')
    const total = result.matched.length + result.fuzzyMatched.length
    expect(total).toBe(1)
  })

  it('unknown Chinese term falls through to unmatched', () => {
    const result = resolveNiches('youtube', '电磁脉冲武器')
    expect(result.matched).toHaveLength(0)
    expect(result.fuzzyMatched).toHaveLength(0)
    expect(result.unmatched).toHaveLength(1)
  })

  // ── ID deduplication ─────────────────────────────────────────────────

  it('duplicate terms produce deduplicated IDs', () => {
    const result = resolveNiches('youtube', 'food, food')
    // Both terms match, but IDs should be deduplicated
    expect(result.ids.length).toBe(new Set(result.ids).size)
  })
})
