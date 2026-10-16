// AI query parsing for creator discovery: turns a free-form request
// ("find US beauty YouTubers with 100k+ followers") into the structured
// filter set used by /api/discovery/club-search. The model reply is never
// trusted — everything passes through sanitizeParsedQuery against the same
// enums the search route enforces.

import OpenAI from 'openai'
import type { CreatorDbCanonicalField, CreatorDbFilterOp } from '@/lib/creatordb-filter-fields'

export interface ParsedDiscoveryQuery {
  keywords: string | null
  niches: string | null
  platform: 'youtube' | 'instagram' | 'tiktok' | null
  country: string | null
  min_followers: number | null
  max_followers: number | null
  min_engagement: number | null
  max_engagement: number | null
  gender: 'MALE' | 'FEMALE' | null
  language: string | null
  bio_keywords: string[]
  last_post: 90 | 180 | 365 | null
  audience_age: '13-17' | '18-24' | '25-34' | '35-44' | '45-64' | '65-' | null
  audience_location: string | null
  min_avg_views: number | null
}

const PLATFORMS = new Set(['youtube', 'instagram', 'tiktok'])
const AUDIENCE_AGES = new Set(['13-17', '18-24', '25-34', '35-44', '45-64', '65-'])

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  if (n < min || n > max) return null
  return Math.round(n * 100) / 100
}

export function sanitizeParsedQuery(raw: any): ParsedDiscoveryQuery {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  const platform = str(raw?.platform).toLowerCase()
  const country = str(raw?.country).toUpperCase()
  const gender = str(raw?.gender).toUpperCase()
  const language = str(raw?.language).toLowerCase()
  const audienceAge = str(raw?.audience_age)
  const lastPost = num(raw?.last_post, 1, 365)
  const audienceLocation = str(raw?.audience_location).toUpperCase()

  let minFollowers = num(raw?.min_followers, 0, 1_000_000_000)
  let maxFollowers = num(raw?.max_followers, 0, 1_000_000_000)
  if (minFollowers != null && maxFollowers != null && maxFollowers < minFollowers) {
    ;[minFollowers, maxFollowers] = [maxFollowers, minFollowers]
  }

  return {
    keywords: str(raw?.keywords).slice(0, 150) || null,
    niches: str(raw?.niches).slice(0, 200) || null,
    platform: PLATFORMS.has(platform) ? (platform as ParsedDiscoveryQuery['platform']) : null,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    min_followers: minFollowers,
    max_followers: maxFollowers,
    min_engagement: num(raw?.min_engagement, 0, 100),
    max_engagement: num(raw?.max_engagement, 0, 100),
    gender: gender === 'MALE' || gender === 'FEMALE' ? (gender as 'MALE' | 'FEMALE') : null,
    language: /^[a-z]{2,3}$/.test(language) ? language : null,
    bio_keywords: Array.isArray(raw?.bio_keywords)
      ? raw.bio_keywords
          .map((k: unknown) => str(k))
          .filter(Boolean)
          .slice(0, 10)
      : [],
    last_post: lastPost == null ? null : lastPost <= 90 ? 90 : lastPost <= 180 ? 180 : 365,
    audience_age: AUDIENCE_AGES.has(audienceAge)
      ? (audienceAge as ParsedDiscoveryQuery['audience_age'])
      : null,
    audience_location: /^[A-Z]{2}$/.test(audienceLocation) ? audienceLocation : null,
    min_avg_views: num(raw?.min_avg_views, 0, 1_000_000_000),
  }
}

export const PARSE_SYSTEM_PROMPT = `You help brands find the right creators to promote their products. The user may describe:
1. What kind of creator they want (e.g. "US beauty YouTubers with 100k+ followers")
2. Their product or campaign (e.g. "I want to promote a corn silk face mask") — in this case, YOU decide what creator niches, keywords, and audience would be the best fit
3. A mix of both

Reply with ONLY a JSON object, no prose, using exactly these keys (use null when not applicable):
{
  "keywords": "short English hashtag/topic terms for creator search, comma-separated, 1-4 words each. E.g. 'skincare, beauty tips'. Choose terms creators in this space actually use.",
  "niches": "English niche/category names, comma-separated. E.g. 'Beauty, Skincare'. Pick the 1-3 most relevant broad categories for this product/request.",
  "platform": "youtube" | "instagram" | "tiktok" | null,
  "country": "ISO 3166-1 alpha-2 code of the CREATOR's country, e.g. US" | null,
  "audience_location": "ISO 3166-1 alpha-2 of the target AUDIENCE's country" | null,
  "min_followers": number | null,
  "max_followers": number | null,
  "min_engagement": number (percent) | null,
  "max_engagement": number (percent) | null,
  "gender": "MALE" | "FEMALE" | null,
  "language": "ISO 639-1 code of the language the creator speaks" | null,
  "bio_keywords": ["English words that should appear in the creator's bio"] | null,
  "last_post": 90 | 180 | 365 | null,
  "audience_age": "13-17" | "18-24" | "25-34" | "35-44" | "45-64" | "65-" | null,
  "min_avg_views": number | null
}
IMPORTANT — Fewer filters is better. Every filter narrows the result set; 2-3 well-chosen filters beats 8 specific ones:
- When the user describes a PRODUCT, infer the best creator niches and keywords for promoting it. A skincare product → niches: "Skincare, Beauty", keywords: "skincare routine". A gaming headset → niches: "Gaming, Tech". Do NOT use product-specific terms as niches.
- "10万" = 100000, "1万" = 10000, "1M" = 1000000, "1k" = 1000
- "粉丝1-2万" → min_followers: 10000, max_followers: 20000
- "美妆" → niches: "Beauty, Makeup", keywords: "beauty, makeup"
- "餐厅探店" / "美食博主" → niches: "Food", keywords: "food review, restaurant"
- "High engagement" → min_engagement: 3
- "Recently active" → last_post: 90
- Only set audience_age when the AUDIENCE (viewers) age is specified, not the creator's age
- Only set audience_location when the target audience location is specified (not the creator's country)
- Always translate non-English terms to English for keywords and niches
- Only set filters the user explicitly mentions or that are clearly implied. Do NOT invent follower ranges, engagement thresholds, audience demographics, or language unless stated.
- Do NOT set language unless the user explicitly asks for a specific language — many bilingual creators would be excluded.
- keywords should be SHORT English terms (1-3 words) that creators use as hashtags. Keep to 2-4 terms max.
- Prefer broad niches (e.g. "Food" not "Food & Beverage, Cooking, Restaurant").`

// ── LLM call ───────────────────────────────────────────────────────────────────

export async function parseDiscoveryQuery(
  query: string,
  opts?: { model?: string },
): Promise<ParsedDiscoveryQuery> {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.CHAT_API
  const baseURL = process.env.DEEPSEEK_API_KEY
    ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
    : undefined
  const model = opts?.model
    || (process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini')

  if (!apiKey) {
    console.warn('[discovery-ai] No API key for AI search parsing')
    return sanitizeParsedQuery({})
  }

  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: PARSE_SYSTEM_PROMPT },
      { role: 'user', content: query },
    ],
    temperature: 0,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices?.[0]?.message?.content?.trim()
  if (!content) return sanitizeParsedQuery({})

  try {
    const raw = JSON.parse(content)
    return sanitizeParsedQuery(raw)
  } catch {
    console.warn('[discovery-ai] Failed to parse LLM response:', content)
    return sanitizeParsedQuery({})
  }
}

// ── Convert parsed query → CreatorDB canonical filters ─────────────────────────

export interface CreatorDbFilterFromAI {
  field: CreatorDbCanonicalField
  op: CreatorDbFilterOp
  value: string | number | boolean | string[]
}

export function toCreatorDbFilters(
  parsed: ParsedDiscoveryQuery,
): { filters: CreatorDbFilterFromAI[]; platform: string } {
  const filters: CreatorDbFilterFromAI[] = []
  const platform = parsed.platform || 'instagram'

  // ── Tier 1: Core identity (always keep) ──
  if (parsed.niches) {
    filters.push({ field: 'niches', op: 'in', value: parsed.niches })
  }
  if (parsed.country) {
    filters.push({ field: 'country', op: '=', value: parsed.country })
  }

  // ── Tier 2: Sizing (important but droppable in retry) ──
  if (parsed.min_followers != null) {
    filters.push({ field: 'followers', op: '>', value: parsed.min_followers })
  }
  if (parsed.max_followers != null) {
    filters.push({ field: 'followers', op: '<', value: parsed.max_followers })
  }

  // ── Tier 3: Quality & targeting (most likely to over-constrain) ──
  if (parsed.min_engagement != null) {
    filters.push({ field: 'shortEngagementRate', op: '>', value: parsed.min_engagement })
  }
  if (parsed.language) {
    filters.push({ field: 'mainLanguage', op: '=', value: parsed.language })
  }
  if (parsed.audience_location) {
    filters.push({ field: 'audienceLocation', op: '=', value: parsed.audience_location })
  }
  if (parsed.last_post != null) {
    filters.push({ field: 'lastPublishTime', op: '>', value: parsed.last_post })
  }
  if (parsed.audience_age) {
    filters.push({ field: 'audienceAge', op: 'in', value: [parsed.audience_age] })
  }
  if (parsed.min_avg_views != null) {
    filters.push({ field: 'shortAvgViews', op: '>', value: parsed.min_avg_views })
  }

  // NOTE: We intentionally do NOT add `keywords` as a hashtags filter here.
  // CreatorDB hashtag matching requires exact hashtag usage in posts, which
  // is too restrictive for AI-generated search terms and frequently returns
  // 0 results. Niches alone provide sufficient category targeting.

  // Cap at 10 filters
  return { filters: filters.slice(0, 10), platform }
}

/**
 * Progressively broaden filters for retry when a search returns 0 results.
 * Each round drops the most restrictive filter category. Returns null when
 * no more filters can be dropped (only niches or country remain).
 */
export function broadenFilters(
  filters: CreatorDbFilterFromAI[],
): CreatorDbFilterFromAI[] | null {
  // Drop in order of restrictiveness (most restrictive first)
  const DROP_ORDER: CreatorDbCanonicalField[] = [
    'hashtags',            // exact-match — almost always too narrow
    'shortEngagementRate', // quality floor
    'mainLanguage',        // language filter
    'audienceAge',         // audience targeting
    'audienceLocation',    // audience location
    'lastPublishTime',     // recency
    'shortAvgViews',       // views floor
    'followers',           // follower range (drops both min and max)
  ]

  for (const field of DROP_ORDER) {
    const has = filters.some((f) => f.field === field)
    if (has) {
      return filters.filter((f) => f.field !== field)
    }
  }

  // Only core filters remain (niches, country) — can't broaden further
  return null
}
