// AI query parsing for creator discovery: turns a free-form request
// ("find US beauty YouTubers with 100k+ followers") into the structured
// filter set used by /api/discovery/club-search. The model reply is never
// trusted — everything passes through sanitizeParsedQuery against the same
// enums the search route enforces.

export interface ParsedDiscoveryQuery {
  keywords: string | null
  platform: 'youtube' | 'instagram' | 'tiktok' | null
  country: string | null
  min_followers: number | null
  max_followers: number | null
  min_engagement: number | null
  max_engagement: number | null
  gender: 'MALE' | 'FEMALE' | null
  language: string | null
  bio_keywords: string[]
  last_post: 90 | 365 | null
  audience_age: '13-17' | '18-24' | '25-34' | '35-44' | '45-64' | '65-' | null
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

  let minFollowers = num(raw?.min_followers, 0, 1_000_000_000)
  let maxFollowers = num(raw?.max_followers, 0, 1_000_000_000)
  if (minFollowers != null && maxFollowers != null && maxFollowers < minFollowers) {
    ;[minFollowers, maxFollowers] = [maxFollowers, minFollowers]
  }

  return {
    keywords: str(raw?.keywords).slice(0, 150) || null,
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
    // The club API only supports 90/365-day recency buckets
    last_post: lastPost == null ? null : lastPost <= 90 ? 90 : 365,
    audience_age: AUDIENCE_AGES.has(audienceAge)
      ? (audienceAge as ParsedDiscoveryQuery['audience_age'])
      : null,
  }
}

export const PARSE_SYSTEM_PROMPT = `You extract creator-search filters from a brand's free-form request (English or Chinese). Reply with ONLY a JSON object, no prose, using exactly these keys (use null when the request doesn't mention it):
{
  "keywords": "short English niche/topic phrase for creator search, 2-6 words, no filter words like follower counts or countries",
  "platform": "youtube" | "instagram" | "tiktok" | null,
  "country": "ISO 3166-1 alpha-2 code, e.g. US" | null,
  "min_followers": number | null,
  "max_followers": number | null,
  "min_engagement": number (percent) | null,
  "max_engagement": number (percent) | null,
  "gender": "MALE" | "FEMALE" | null,
  "language": "ISO 639-1 code of the language the creator should speak" | null,
  "bio_keywords": ["words that must appear in the creator's bio"] | null,
  "last_post": 90 | 365 | null,
  "audience_age": "13-17" | "18-24" | "25-34" | "35-44" | "45-64" | "65-" | null
}
Notes: "10万" = 100000, "1M" = 1000000. "High engagement" → min_engagement 3. Recently active → last_post 90. Only set audience_age when the AUDIENCE (viewers) age is specified, not the creator's age. Never invent filters that were not asked for.`
