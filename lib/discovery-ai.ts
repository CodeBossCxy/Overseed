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
  related_niches: string | null
  content_styles: string[] | null
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
    related_niches: str(raw?.related_niches).slice(0, 200) || null,
    content_styles: Array.isArray(raw?.content_styles)
      ? raw.content_styles.map((s: unknown) => str(s).toLowerCase()).filter(Boolean).slice(0, 5)
      : null,
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
  "niches": "The most SPECIFIC niche/category for the product, comma-separated, 1-2 terms max. Use the product category, NOT broad parent categories. E.g. for earrings → 'Jewelry, Earring' (NOT 'Fashion'). For a face mask → 'Skincare' (NOT 'Beauty'). For a gaming headset → 'Gaming'. For running shoes → 'Running'. Be specific — broad niches like Fashion, Lifestyle, Beauty return too many irrelevant results.",
  "related_niches": "Secondary niches for fallback if primary niches return too few results, comma-separated. E.g. for 'Jewelry, Earring' → 'Fashion Accessories, Handmade'. For 'Automotive' → 'Cars, Vehicles, Motor'. Keep 2-3 terms." | null,
  "content_styles": ["preferred content types inferred from context, e.g. 'review', 'tutorial', 'unboxing', 'lifestyle', 'demonstration'"] | null,
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
IMPORTANT — Fewer filters is better. Every filter narrows the result set; 2-4 well-chosen filters beats 8 specific ones:
- When the user describes a PRODUCT, use the most SPECIFIC product-level niche. Do NOT add broad parent categories — they dilute results with irrelevant creators. Examples:
  * Earrings → niches: "Jewelry, Earring" (NOT "Fashion" — too broad)
  * Protein powder → niches: "Fitness, Nutrition"
  * Corn silk face mask → niches: "Skincare"
  * Running shoes → niches: "Running"
  * Gaming headset → niches: "Gaming"
  * Lipstick → niches: "Makeup"
  * Dog food → niches: "Pets, Dog"
  * Camera lens → niches: "Photography"
  * Handbag → niches: "Bags, Fashion" (Fashion is OK here because it's the direct category)
  * Vitamin supplements → niches: "Health, Nutrition"
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
- keywords should be SHORT English terms (1-3 words) that creators use as hashtags. Keep to 2-4 terms max.`

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
  /** Where this filter originated */
  source?: 'campaign' | 'user' | 'ai' | 'system'
  /** Whether this filter can be relaxed during retry */
  constraint?: 'hard' | 'soft'
}

export function toCreatorDbFilters(
  parsed: ParsedDiscoveryQuery,
): { filters: CreatorDbFilterFromAI[]; platform: string } {
  const filters: CreatorDbFilterFromAI[] = []
  const platform = parsed.platform || 'instagram'

  // ── Tier 1: Core identity (AI-inferred, soft — can be broadened to related niches) ──
  if (parsed.niches) {
    filters.push({ field: 'niches', op: 'in', value: parsed.niches, source: 'ai', constraint: 'soft' })
  }
  if (parsed.country) {
    filters.push({ field: 'country', op: '=', value: parsed.country, source: 'ai', constraint: 'soft' })
  }

  // ── Tier 2: Sizing (AI-inferred, soft) ──
  if (parsed.min_followers != null) {
    filters.push({ field: 'followers', op: '>', value: parsed.min_followers, source: 'ai', constraint: 'soft' })
  }
  if (parsed.max_followers != null) {
    filters.push({ field: 'followers', op: '<', value: parsed.max_followers, source: 'ai', constraint: 'soft' })
  }

  // ── Tier 3: Quality & targeting (AI-inferred, soft) ──
  if (parsed.min_engagement != null) {
    filters.push({ field: 'shortEngagementRate', op: '>', value: parsed.min_engagement, source: 'ai', constraint: 'soft' })
  }
  if (parsed.language) {
    filters.push({ field: 'mainLanguage', op: '=', value: parsed.language, source: 'ai', constraint: 'soft' })
  }
  if (parsed.audience_location) {
    filters.push({ field: 'audienceLocation', op: '=', value: parsed.audience_location, source: 'ai', constraint: 'soft' })
  }
  if (parsed.last_post != null) {
    filters.push({ field: 'lastPublishTime', op: '>', value: parsed.last_post, source: 'ai', constraint: 'soft' })
  }
  if (parsed.audience_age) {
    filters.push({ field: 'audienceAge', op: 'in', value: [parsed.audience_age], source: 'ai', constraint: 'soft' })
  }
  if (parsed.min_avg_views != null) {
    filters.push({ field: 'shortAvgViews', op: '>', value: parsed.min_avg_views, source: 'ai', constraint: 'soft' })
  }

  // NOTE: We intentionally do NOT add `keywords` as a hashtags filter here.
  // CreatorDB hashtag matching requires exact hashtag usage in posts, which
  // is too restrictive for AI-generated search terms and frequently returns
  // 0 results. Niches alone provide sufficient category targeting.

  // Cap at 10 filters
  return { filters: filters.slice(0, 10), platform }
}

export interface BroadenResult {
  filters: CreatorDbFilterFromAI[]
  dropped: { field: CreatorDbCanonicalField; reason: string }[]
}

/**
 * Progressively broaden filters for retry when a search returns 0 results.
 * Only drops filters with constraint='soft'. Hard constraints (explicit user
 * or campaign filters) are never relaxed. Returns null when no more soft
 * filters can be dropped.
 */
export function broadenFilters(
  filters: CreatorDbFilterFromAI[],
): BroadenResult | null {
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
    // Only drop soft constraints — hard ones are never relaxed
    const droppable = filters.some((f) => f.field === field && f.constraint !== 'hard')
    if (droppable) {
      return {
        filters: filters.filter((f) => !(f.field === field && f.constraint !== 'hard')),
        dropped: [{ field, reason: 'Relaxed to broaden search results' }],
      }
    }
  }

  // Only hard constraints and core filters remain — can't broaden further
  return null
}

// ── AI-powered bio relevance scoring ──────────────────────────────────────────
// Scores each creator's bio against the search context in a single batched LLM
// call. Returns a map of handle → 0-100 score. Semantic understanding means
// "engine and machinery" scores high for an "automotive" search even without
// keyword overlap.

export interface BioScoreContext {
  query?: string
  niches?: string
  keywords?: string
  platform?: string
  country?: string
}

export interface BioScoreInput {
  handle: string
  bio: string
}

const BIO_SCORE_SYSTEM = `You score how relevant a creator's bio is to a brand's search intent.

You will receive:
- SEARCH CONTEXT: what the brand is looking for (query, niches, keywords)
- CREATORS: a list of creators with their handle and bio

For each creator, return a relevance score 0-100:
- 90-100: Bio directly mentions the exact topic/niche (e.g. "car reviewer" for automotive search)
- 70-89: Bio strongly implies relevance (e.g. "engine specialist" or "mechanic" for automotive)
- 40-69: Bio has moderate relevance (e.g. "outdoor adventures with my truck" for automotive)
- 10-39: Bio has weak/tangential relevance (e.g. "lifestyle blogger" for automotive search)
- 0-9: Bio is unrelated or empty

Key rules:
- Understand semantic meaning across languages. A Portuguese bio about "oficina mecânica" is highly relevant to an "automotive" search.
- Consider indirect signals: tools, activities, settings that imply the niche without naming it.
- An empty or generic bio (just emojis, "DM for collabs") gets score 0.
- Be consistent: similar bios should get similar scores.

Reply with ONLY a JSON object: {"scores":[{"h":"handle","s":score}, ...]}
Keep handles exactly as given. No other text.`

export async function scoreBioRelevance(
  context: BioScoreContext,
  creators: BioScoreInput[],
): Promise<Map<string, number>> {
  const scores = new Map<string, number>()
  if (creators.length === 0) return scores

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.CHAT_API
  const baseURL = process.env.DEEPSEEK_API_KEY
    ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
    : undefined
  const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini'

  if (!apiKey) {
    console.warn('[discovery-ai] No API key for bio scoring')
    return scores
  }

  // Build compact user message
  const contextParts = []
  if (context.query) contextParts.push(`Query: ${context.query}`)
  if (context.niches) contextParts.push(`Niches: ${context.niches}`)
  if (context.keywords) contextParts.push(`Keywords: ${context.keywords}`)
  if (context.platform) contextParts.push(`Platform: ${context.platform}`)
  if (context.country) contextParts.push(`Country: ${context.country}`)

  // Truncate bios to keep within token limits
  const creatorList = creators.map((c) => ({
    h: c.handle,
    b: c.bio.slice(0, 200),
  }))

  const userMsg = `SEARCH CONTEXT:\n${contextParts.join('\n')}\n\nCREATORS:\n${JSON.stringify(creatorList)}`

  try {
    const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: BIO_SCORE_SYSTEM },
        { role: 'user', content: userMsg },
      ],
      temperature: 0,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices?.[0]?.message?.content?.trim()
    if (!content) {
      console.warn('[discovery-ai] Bio scoring: empty LLM response')
      return scores
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      console.warn('[discovery-ai] Bio score JSON parse failed:', content.slice(0, 300))
      return scores
    }

    // Extract array from any wrapper: {"scores":[...]}, {"results":[...]}, or bare [...]
    let arr: any[]
    if (Array.isArray(parsed)) {
      arr = parsed
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Find the first array value in the object
      arr = Object.values(parsed).find((v): v is any[] => Array.isArray(v)) || []
    } else {
      arr = []
    }

    for (const item of arr) {
      if (item?.h && typeof item.s === 'number') {
        scores.set(item.h, Math.max(0, Math.min(100, Math.round(item.s))))
      }
    }

    if (arr.length > 0 && scores.size === 0) {
      console.warn('[discovery-ai] Bio scoring: parsed array but no valid {h,s} entries. Sample:', JSON.stringify(arr[0]))
    }

    console.log(
      `%c[AI Bio Scoring] ${scores.size}/${creators.length} creators scored\n` +
      `%c` + Array.from(scores.entries()).map(([h, s]) => `  ${h}: ${s}`).join('\n'),
      'color:#6366f1;font-weight:bold',
      'color:#94a3b8',
    )
  } catch (err: any) {
    console.warn('[discovery-ai] Bio scoring failed:', err?.message)
  }

  return scores
}
