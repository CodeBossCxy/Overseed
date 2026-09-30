/**
 * Discovery confidence scoring for creator candidates.
 * Additive scoring with a base of 30; clamped to 0-100.
 */

export interface ScoringInput {
  url: string
  normalizedUrl: string
  domain: string
  urlType: string
  platform: string | null
  extractedHandle: string | null
  title: string | null
  description: string | null
  searchRank: number
  timesDiscovered: number
}

export interface ScoringResult {
  score: number
  factors: { name: string; delta: number }[]
}

// ── Keyword sets ──────────────────────────────────────────────────────────────

const CREATOR_TERMS = ['creator', 'influencer', 'content creator', 'blogger', 'youtuber']
const CONTACT_TERMS = ['business inquiries', 'contact', 'media kit', 'collab']
const NICHE_TERMS = [
  'fashion',
  'beauty',
  'fitness',
  'travel',
  'food',
  'lifestyle',
  'tech',
  'gaming',
  'photography',
  'music',
  'art',
  'dance',
  'wellness',
  'parenting',
  'finance',
  'education',
  'cooking',
  'outdoors',
  'automotive',
  'sports',
]

const GENERIC_HANDLE_TERMS = ['official', 'news', 'daily', 'best', 'top']
const CORPORATE_HANDLE_PATTERN = /\b(inc|corp|llc|official)\b/i
const ALL_CAPS_PATTERN = /^[A-Z0-9_]{4,}$/

function containsAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase()
  return terms.some((t) => lower.includes(t))
}

function isGenericHandle(handle: string): boolean {
  const bare = handle.replace(/^@/, '').toLowerCase()
  return GENERIC_HANDLE_TERMS.some((term) => bare.includes(term))
}

function isCorporateHandle(handle: string): boolean {
  const bare = handle.replace(/^@/, '')
  return CORPORATE_HANDLE_PATTERN.test(bare) || ALL_CAPS_PATTERN.test(bare)
}

/**
 * Scores a creator discovery candidate on a 0-100 scale.
 * Returns the final score plus an itemized list of scoring factors.
 */
export function scoreCandidate(input: ScoringInput): ScoringResult {
  const factors: { name: string; delta: number }[] = []
  let score = 30

  const combined = [input.title, input.description].filter(Boolean).join(' ')

  // ── Social profile URL (+25) ──────────────────────────────────────────────

  if (
    input.urlType === 'instagram_profile' ||
    input.urlType === 'tiktok_profile' ||
    input.urlType === 'youtube_channel'
  ) {
    factors.push({ name: 'social_profile_url', delta: 25 })
    score += 25
  }

  // ── Link-in-bio (+20) ─────────────────────────────────────────────────────

  if (input.urlType === 'link_in_bio') {
    factors.push({ name: 'link_in_bio', delta: 20 })
    score += 20
  }

  // ── Creator website (+15) ─────────────────────────────────────────────────

  if (input.urlType === 'creator_website') {
    factors.push({ name: 'creator_website', delta: 15 })
    score += 15
  }

  // ── Handle looks personal (+10) ───────────────────────────────────────────

  if (input.extractedHandle && !isGenericHandle(input.extractedHandle)) {
    factors.push({ name: 'personal_handle', delta: 10 })
    score += 10
  }

  // ── Title/desc has creator terms (+10) ────────────────────────────────────

  if (combined && containsAny(combined, CREATOR_TERMS)) {
    factors.push({ name: 'creator_terms_in_text', delta: 10 })
    score += 10
  }

  // ── Title/desc has contact terms (+8) ─────────────────────────────────────

  if (combined && containsAny(combined, CONTACT_TERMS)) {
    factors.push({ name: 'contact_terms_in_text', delta: 8 })
    score += 8
  }

  // ── Title/desc has niche keywords (+5) ────────────────────────────────────

  if (combined && containsAny(combined, NICHE_TERMS)) {
    factors.push({ name: 'niche_keywords_in_text', delta: 5 })
    score += 5
  }

  // ── Multiple discoveries (+3 per extra, max +15) ──────────────────────────

  if (input.timesDiscovered > 1) {
    const delta = Math.min((input.timesDiscovered - 1) * 3, 15)
    factors.push({ name: 'multiple_discoveries', delta })
    score += delta
  }

  // ── High search rank (+5 rank<=3, +3 rank<=5) ─────────────────────────────

  if (input.searchRank <= 3) {
    factors.push({ name: 'high_search_rank_top3', delta: 5 })
    score += 5
  } else if (input.searchRank <= 5) {
    factors.push({ name: 'high_search_rank_top5', delta: 3 })
    score += 3
  }

  // ── Agency / directory (-15) ──────────────────────────────────────────────

  if (input.urlType === 'agency_or_directory') {
    factors.push({ name: 'agency_or_directory', delta: -15 })
    score -= 15
  }

  // ── Article (-10) ─────────────────────────────────────────────────────────

  if (input.urlType === 'article') {
    factors.push({ name: 'article_url', delta: -10 })
    score -= 10
  }

  // ── Generic / corporate handle (-10) ──────────────────────────────────────

  if (input.extractedHandle && isCorporateHandle(input.extractedHandle)) {
    factors.push({ name: 'generic_corporate_handle', delta: -10 })
    score -= 10
  }

  // ── Unknown type (-5) ─────────────────────────────────────────────────────

  if (input.urlType === 'unknown') {
    factors.push({ name: 'unknown_type', delta: -5 })
    score -= 5
  }

  // ── Clamp ─────────────────────────────────────────────────────────────────

  return { score: Math.max(0, Math.min(100, score)), factors }
}
