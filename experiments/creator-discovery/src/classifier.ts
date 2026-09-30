/**
 * Deterministic URL type classification for creator discovery.
 * No AI — rule-based only.
 */

export type UrlType =
  | 'instagram_profile'
  | 'tiktok_profile'
  | 'youtube_channel'
  | 'creator_website'
  | 'link_in_bio'
  | 'agency_or_directory'
  | 'article'
  | 'unknown'

export interface ClassifiedUrl {
  urlType: UrlType
  platform: string | null
  extractedHandle: string | null
  confidence: number
}

// ── Social profile exclusion lists ───────────────────────────────────────────

const INSTAGRAM_NON_PROFILE = new Set([
  'explore',
  'accounts',
  'p',
  'reel',
  'reels',
  'stories',
  'directory',
  'about',
  'legal',
  'tags',
  'tv',
])

const TIKTOK_NON_PROFILE = new Set([
  'discover',
  'search',
  'tag',
  'trending',
  'live',
  'about',
  'foryou',
])

const YOUTUBE_NON_PROFILE = new Set([
  'results',
  'watch',
  'feed',
  'playlist',
  'shorts',
  'trending',
  'premium',
  'about',
  'gaming',
  'music',
])

// ── Link-in-bio domains ───────────────────────────────────────────────────────

const LINK_IN_BIO_DOMAINS = new Set([
  'linktr.ee',
  'linkin.bio',
  'bio.link',
  'lnk.bio',
  'beacons.ai',
  'hoo.be',
  'solo.to',
])

// ── Agency / directory domains ────────────────────────────────────────────────

const AGENCY_DOMAINS = new Set([
  'influencermarketinghub.com',
  'upfluence.com',
  'hypeauditor.com',
  'socialblade.com',
  'noxinfluencer.com',
  'modash.io',
  'grin.co',
  'creatoriq.com',
  'aspireiq.com',
  'influencity.com',
  'followerwonk.com',
  'buzzsumo.com',
])

// ── Creator / article keyword sets ───────────────────────────────────────────

const CREATOR_TERMS = ['creator', 'influencer', 'content creator', 'blogger', 'youtuber']
const ARTICLE_PATH_SEGMENTS = ['/blog/', '/article/', '/news/']
const ARTICLE_PATH_STARTS = ['/best-', '/top-']

function containsCreatorTerms(text: string): boolean {
  const lower = text.toLowerCase()
  return CREATOR_TERMS.some((t) => lower.includes(t))
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function getPathParts(url: string): string[] {
  try {
    return new URL(url).pathname.split('/').filter(Boolean)
  } catch {
    return []
  }
}

function getPathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

// ── Classification helpers ────────────────────────────────────────────────────

function classifyInstagram(parts: string[]): ClassifiedUrl | null {
  if (parts.length === 0) return null
  const handle = parts[0].toLowerCase()
  if (INSTAGRAM_NON_PROFILE.has(handle)) return null
  return {
    urlType: 'instagram_profile',
    platform: 'instagram',
    extractedHandle: handle,
    confidence: 1,
  }
}

function classifyTikTok(parts: string[]): ClassifiedUrl | null {
  if (parts.length === 0) return null
  const raw = parts[0].toLowerCase()
  const bare = raw.replace(/^@/, '')
  if (TIKTOK_NON_PROFILE.has(bare)) return null
  const handle = raw.startsWith('@') ? raw : `@${raw}`
  return {
    urlType: 'tiktok_profile',
    platform: 'tiktok',
    extractedHandle: handle,
    confidence: 1,
  }
}

function classifyYouTube(parts: string[]): ClassifiedUrl | null {
  if (parts.length === 0) return null
  const first = parts[0].toLowerCase()
  if (YOUTUBE_NON_PROFILE.has(first)) return null

  if (first.startsWith('@')) {
    return { urlType: 'youtube_channel', platform: 'youtube', extractedHandle: first, confidence: 1 }
  }
  if (first === 'channel' && parts[1]) {
    return { urlType: 'youtube_channel', platform: 'youtube', extractedHandle: parts[1], confidence: 1 }
  }
  if ((first === 'c' || first === 'user') && parts[1]) {
    return {
      urlType: 'youtube_channel',
      platform: 'youtube',
      extractedHandle: parts[1].toLowerCase(),
      confidence: 0.9,
    }
  }
  return null
}

/**
 * Classifies a normalized URL into a UrlType using deterministic rules.
 * Optionally accepts page title and description for creator_website detection.
 */
export function classifyUrl(
  normalizedUrl: string,
  title?: string | null,
  description?: string | null,
): ClassifiedUrl {
  const unknown: ClassifiedUrl = { urlType: 'unknown', platform: null, extractedHandle: null, confidence: 0 }

  const domain = getDomain(normalizedUrl)
  if (!domain) return unknown

  const parts = getPathParts(normalizedUrl)
  const pathname = getPathname(normalizedUrl)

  // ── Social profiles ───────────────────────────────────────────────────────

  if (domain === 'instagram.com') {
    const result = classifyInstagram(parts)
    if (result) return result
    return unknown
  }

  if (domain === 'tiktok.com') {
    const result = classifyTikTok(parts)
    if (result) return result
    return unknown
  }

  if (domain === 'youtube.com') {
    const result = classifyYouTube(parts)
    if (result) return result
    return unknown
  }

  // ── Link-in-bio ───────────────────────────────────────────────────────────

  if (LINK_IN_BIO_DOMAINS.has(domain)) {
    const handle = parts[0] ?? null
    return { urlType: 'link_in_bio', platform: null, extractedHandle: handle, confidence: 1 }
  }

  // ── Agency / directory ────────────────────────────────────────────────────

  if (AGENCY_DOMAINS.has(domain)) {
    return { urlType: 'agency_or_directory', platform: null, extractedHandle: null, confidence: 1 }
  }

  // ── Article ───────────────────────────────────────────────────────────────

  const isArticlePath =
    ARTICLE_PATH_SEGMENTS.some((seg) => pathname.includes(seg)) ||
    ARTICLE_PATH_STARTS.some((start) => pathname.includes(start))

  if (isArticlePath) {
    return { urlType: 'article', platform: null, extractedHandle: null, confidence: 0.9 }
  }

  // ── Creator website (heuristic) ───────────────────────────────────────────

  const combined = [title, description].filter(Boolean).join(' ')
  if (combined && containsCreatorTerms(combined)) {
    return { urlType: 'creator_website', platform: null, extractedHandle: null, confidence: 0.5 }
  }

  return unknown
}
