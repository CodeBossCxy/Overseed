/**
 * URL normalization utilities for creator discovery.
 */

export interface NormalizedUrl {
  original: string
  normalized: string
  domain: string
}

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'ref',
  'source',
  'igshid',
  'share_source',
  'si',
])

const TRACKING_PREFIXES = ['utm_', '_nc_']

const SOCIAL_PROFILE_DOMAINS = new Set(['instagram.com', 'tiktok.com', 'youtube.com'])

function isTrackingParam(key: string): boolean {
  if (TRACKING_PARAMS.has(key)) return true
  return TRACKING_PREFIXES.some((prefix) => key.startsWith(prefix))
}

function stripQueryParams(url: URL, removeAll: boolean): void {
  if (removeAll) {
    url.search = ''
    return
  }
  const toDelete: string[] = []
  for (const key of url.searchParams.keys()) {
    if (isTrackingParam(key)) toDelete.push(key)
  }
  for (const key of toDelete) url.searchParams.delete(key)
  // Normalize: if no params remain, clear the search string entirely
  if ([...url.searchParams.keys()].length === 0) url.search = ''
}

function normalizeInstagram(url: URL): void {
  // Keep only instagram.com/{handle}, strip sub-paths like /reels/, /tagged/, etc.
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length === 0) return
  const handle = parts[0].toLowerCase()
  // Strip known non-profile path segments
  const nonProfile = new Set([
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
  if (nonProfile.has(handle)) return // leave path as-is, classifier will reject it
  url.pathname = `/${handle}`
}

function normalizeTikTok(url: URL): void {
  // Keep only tiktok.com/@{handle}
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length === 0) return
  let handle = parts[0].toLowerCase()
  const nonProfile = new Set(['discover', 'search', 'tag', 'trending', 'live', 'about', 'foryou'])
  if (nonProfile.has(handle.replace('@', ''))) return
  if (!handle.startsWith('@')) handle = `@${handle}`
  url.pathname = `/${handle}`
}

function normalizeYouTube(url: URL): void {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length === 0) return
  const nonProfile = new Set([
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
  const first = parts[0].toLowerCase()
  if (nonProfile.has(first)) return

  if (first.startsWith('@')) {
    // /@handle — canonical form
    url.pathname = `/${first}`
  } else if (first === 'channel' && parts[1]) {
    url.pathname = `/channel/${parts[1]}`
  } else if (first === 'c' && parts[1]) {
    url.pathname = `/c/${parts[1].toLowerCase()}`
  } else if (first === 'user' && parts[1]) {
    url.pathname = `/user/${parts[1].toLowerCase()}`
  }
}

/**
 * Normalizes a raw URL string for deduplication and classification.
 * Handles malformed URLs gracefully — returns the original string if unparseable.
 */
export function normalizeUrl(rawUrl: string): NormalizedUrl {
  let urlStr = rawUrl.trim()

  // Prepend scheme if missing so URL constructor can parse it
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = `https://${urlStr}`
  }

  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { original: rawUrl, normalized: rawUrl, domain: '' }
  }

  // Lowercase hostname and strip www
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const domain = parsed.hostname

  // Remove fragment
  parsed.hash = ''

  // Remove tracking / social query params
  const removeAll = SOCIAL_PROFILE_DOMAINS.has(domain)
  stripQueryParams(parsed, removeAll)

  // Platform-specific path normalization
  if (domain === 'instagram.com') normalizeInstagram(parsed)
  else if (domain === 'tiktok.com') normalizeTikTok(parsed)
  else if (domain === 'youtube.com') normalizeYouTube(parsed)

  // Remove trailing slash (except root)
  let normalized = parsed.toString()
  if (normalized.endsWith('/') && normalized !== `${parsed.protocol}//${parsed.host}/`) {
    normalized = normalized.slice(0, -1)
  }

  return { original: rawUrl, normalized, domain }
}
