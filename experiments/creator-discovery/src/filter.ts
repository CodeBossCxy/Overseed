/**
 * Noise filtering for creator discovery URLs.
 * Returns keep=false with a reason string for any URL that should be discarded.
 */

export interface FilterResult {
  keep: boolean
  reason?: string
}

const SOCIAL_HOMEPAGES = new Set(['instagram.com', 'tiktok.com', 'youtube.com'])

const SEARCH_ENGINES = new Set([
  'google.com',
  'bing.com',
  'yahoo.com',
  'duckduckgo.com',
  'baidu.com',
])

const SOCIAL_DOMAINS = new Set(['instagram.com', 'tiktok.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com'])

const APP_STORE_DOMAINS = new Set(['apps.apple.com', 'play.google.com'])

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function getPathname(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return ''
  }
}

function pathContains(pathname: string, ...segments: string[]): boolean {
  return segments.some((seg) => pathname.includes(seg))
}

/**
 * Determines whether a URL should be kept or discarded.
 * Returns `{ keep: false, reason }` for any filtered URL.
 */
export function filterUrl(
  normalizedUrl: string,
  urlType: string,
  title: string | null,
  description: string | null,
): FilterResult {
  const domain = getDomain(normalizedUrl)
  const pathname = getPathname(normalizedUrl)

  // ── Search engines ────────────────────────────────────────────────────────

  if (SEARCH_ENGINES.has(domain)) {
    return { keep: false, reason: `search engine domain: ${domain}` }
  }

  // ── App stores ────────────────────────────────────────────────────────────

  if (APP_STORE_DOMAINS.has(domain)) {
    return { keep: false, reason: `app store link: ${domain}` }
  }

  // ── Social platform homepages (no meaningful path) ────────────────────────

  if (SOCIAL_HOMEPAGES.has(domain) && (pathname === '/' || pathname === '')) {
    return { keep: false, reason: `social platform homepage: ${domain}` }
  }

  // ── Login / signup pages ──────────────────────────────────────────────────

  if (pathContains(pathname, '/login', '/signup', '/register', '/accounts/login')) {
    return { keep: false, reason: `login/signup page: ${pathname}` }
  }

  // ── Search / explore / hashtag pages ─────────────────────────────────────

  const isSearchExplore =
    pathContains(
      pathname,
      '/explore',
      '/discover',
      '/results',
      '/search',
      '/hashtag/',
    ) ||
    (domain === 'instagram.com' && pathname.startsWith('/explore')) ||
    (domain === 'tiktok.com' && pathname.startsWith('/discover')) ||
    (domain === 'youtube.com' && pathname.startsWith('/results'))

  if (isSearchExplore) {
    return { keep: false, reason: `search/explore/hashtag page: ${pathname}` }
  }

  // ── Privacy / terms / legal pages ────────────────────────────────────────

  if (pathContains(pathname, '/privacy', '/terms', '/legal', '/tos', '/cookie')) {
    return { keep: false, reason: `legal/policy page: ${pathname}` }
  }

  // ── Platform help / about pages (social domains only) ────────────────────

  if (SOCIAL_DOMAINS.has(domain) && pathContains(pathname, '/about', '/help', '/support')) {
    return { keep: false, reason: `platform help/about page: ${domain}${pathname}` }
  }

  // ── Ecommerce patterns on non-creator domains ─────────────────────────────

  const isCreatorLike = urlType === 'creator_website' || urlType === 'instagram_profile' ||
    urlType === 'tiktok_profile' || urlType === 'youtube_channel' || urlType === 'link_in_bio'

  if (
    !isCreatorLike &&
    pathContains(pathname, '/product/', '/buy/', '/shop/', '/cart/', '/checkout/')
  ) {
    return { keep: false, reason: `ecommerce path on non-creator domain: ${pathname}` }
  }

  return { keep: true }
}
