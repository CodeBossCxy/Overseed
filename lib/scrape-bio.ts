// Scrape creator bios from public profile pages to extract contact emails.
// No API credits needed — uses the public HTML that any browser can see.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Use Googlebot UA — Instagram/TikTok serve full content to search crawlers
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Accept: 'text/html',
}

export interface ScrapedBio {
  bio: string | null
  emails: string[]
}

/**
 * Scrape a creator's public profile page and extract bio text + emails.
 * Supports Instagram, TikTok, and YouTube.
 */
export async function scrapeBio(
  platform: string,
  handle: string,
): Promise<ScrapedBio> {
  const h = handle.replace(/^@/, '').toLowerCase()
  try {
    switch (platform) {
      case 'instagram':
        return await scrapeInstagram(h)
      case 'tiktok':
        return await scrapeTikTok(h)
      case 'youtube':
        return await scrapeYouTube(h)
      default:
        return { bio: null, emails: [] }
    }
  } catch (err) {
    console.warn(`[scrape-bio] Failed for ${platform}/@${h}:`, (err as Error).message)
    return { bio: null, emails: [] }
  }
}

/**
 * Scrape bio from multiple creators with rate limiting.
 * Returns a map of handle → ScrapedBio.
 */
export async function scrapeBioBatch(
  creators: { platform: string; handle: string }[],
  delayMs = 1500,
): Promise<Map<string, ScrapedBio>> {
  const results = new Map<string, ScrapedBio>()
  for (const c of creators) {
    const key = `${c.platform}:${c.handle.replace(/^@/, '').toLowerCase()}`
    const result = await scrapeBio(c.platform, c.handle)
    results.set(key, result)
    // Rate limit: wait between requests to avoid getting blocked
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return results
}

// ── Instagram ───────────────────────────────────────────────────────────────────

async function scrapeInstagram(handle: string): Promise<ScrapedBio> {
  // Instagram embeds profile info in meta tags and JSON-LD
  const url = `https://www.instagram.com/${handle}/`
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return { bio: null, emails: [] }
  const html = await res.text()

  let bio: string | null = null

  // Method 1: Extract from og:description meta tag
  // Format: "X Followers, Y Following, Z Posts - See Instagram photos and videos from Name (@handle)"
  // Sometimes the bio is included after the dash
  const ogDesc = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*)"/)
  if (ogDesc?.[1]) {
    // The description often contains follower counts + bio
    const desc = decodeHtmlEntities(ogDesc[1])
    // Try to extract the bio portion (after the standard prefix)
    const bioMatch = desc.match(/Posts?\s*[-–—]\s*([\s\S]+)$/)
    if (bioMatch?.[1]) {
      // Remove the "See Instagram photos and videos from Name (@handle)" suffix
      bio = bioMatch[1]
        .replace(/See Instagram photos and videos from .+$/i, '')
        .replace(/在 Instagram 上查看.+$/i, '')
        .trim()
    }
    // If no bio extracted from pattern, use the full description
    if (!bio || bio.length < 3) bio = desc
  }

  // Method 2: Extract from description meta tag
  if (!bio) {
    const metaDesc = html.match(/<meta\s+(?:property|name)="description"\s+content="([^"]*)"/)
    if (metaDesc?.[1]) {
      bio = decodeHtmlEntities(metaDesc[1])
    }
  }

  // Method 3: Look for embedded JSON data (SharedData or additional_data)
  if (!bio) {
    const jsonMatch = html.match(/"biography"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (jsonMatch?.[1]) {
      bio = jsonMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
        .replace(/\\(.)/g, '$1')
    }
  }

  const emails = bio ? extractEmails(bio) : []

  // Also scan the full HTML for emails near the bio region (some emails in linktree-style links)
  if (emails.length === 0) {
    const htmlEmails = extractEmails(html)
    // Filter out Instagram's own emails and common false positives
    const filtered = htmlEmails.filter(
      (e) =>
        !e.endsWith('@instagram.com') &&
        !e.endsWith('@facebook.com') &&
        !e.endsWith('@meta.com') &&
        !e.includes('noreply') &&
        !e.includes('support@')
    )
    if (filtered.length > 0) emails.push(...filtered)
  }

  return { bio, emails: [...new Set(emails)] }
}

// ── TikTok ──────────────────────────────────────────────────────────────────────

async function scrapeTikTok(handle: string): Promise<ScrapedBio> {
  const url = `https://www.tiktok.com/@${handle}`
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return { bio: null, emails: [] }
  const html = await res.text()

  let bio: string | null = null

  // TikTok embeds profile data in a JSON script tag
  const jsonMatch = html.match(/"signature"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (jsonMatch?.[1]) {
    bio = jsonMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
      .replace(/\\(.)/g, '$1')
  }

  // Fallback: meta description
  if (!bio) {
    const metaDesc = html.match(/<meta\s+(?:property|name)="description"\s+content="([^"]*)"/)
    if (metaDesc?.[1]) {
      bio = decodeHtmlEntities(metaDesc[1])
    }
  }

  const emails = bio ? extractEmails(bio) : []
  return { bio, emails: [...new Set(emails)] }
}

// ── YouTube ─────────────────────────────────────────────────────────────────────

async function scrapeYouTube(handle: string): Promise<ScrapedBio> {
  const url = `https://www.youtube.com/@${handle}/about`
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return { bio: null, emails: [] }
  const html = await res.text()

  let bio: string | null = null

  // YouTube embeds channel description in the page JSON
  const descMatch = html.match(/"description"\s*:\s*\{\s*"simpleText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (descMatch?.[1]) {
    bio = descMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
      .replace(/\\(.)/g, '$1')
  }

  // Fallback: og:description
  if (!bio) {
    const ogDesc = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*)"/)
    if (ogDesc?.[1]) bio = decodeHtmlEntities(ogDesc[1])
  }

  const emails = bio ? extractEmails(bio) : []

  // YouTube sometimes shows business email separately — scan full page
  if (emails.length === 0) {
    const htmlEmails = extractEmails(html)
    const filtered = htmlEmails.filter(
      (e) =>
        !e.endsWith('@youtube.com') &&
        !e.endsWith('@google.com') &&
        !e.includes('noreply') &&
        !e.includes('support@')
    )
    if (filtered.length > 0) emails.push(...filtered)
  }

  return { bio, emails: [...new Set(emails)] }
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function extractEmails(text: string): string[] {
  return [...(text.match(EMAIL_RE) || [])].filter(
    (e) => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.svg')
  )
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
}
