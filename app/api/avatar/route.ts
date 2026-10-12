import { NextRequest, NextResponse } from 'next/server'

// In-memory LRU avatar cache. Each entry is the image buffer + content type.
// Survives across requests in the same server process. Entries are evicted
// when the cache exceeds MAX_ENTRIES (oldest first).
const MAX_ENTRIES = 2000
const cache = new Map<string, { buffer: ArrayBuffer; contentType: string; at: number }>()

function evict() {
  if (cache.size <= MAX_ENTRIES) return
  // Delete oldest 20% when over limit
  const entries = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)
  const toDelete = Math.ceil(entries.length * 0.2)
  for (let i = 0; i < toDelete; i++) cache.delete(entries[i][0])
}

// GET /api/avatar?url=<encoded_url>
// Proxies and caches external avatar images so they survive signed URL expiration.
// Returns the image with long cache headers (browser caches for 7 days).
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  // Only allow image URLs from known CDN domains
  const ALLOWED_HOSTS = [
    'tiktokcdn.com',
    'googleusercontent.com',
    'firebasestorage.googleapis.com',
    'instagram.com',
    'cdninstagram.com',
    'fbcdn.net',
    'ggpht.com',
    'ytimg.com',
  ]
  try {
    const hostname = new URL(url).hostname
    if (!ALLOWED_HOSTS.some((h) => hostname.endsWith(h))) {
      return new NextResponse('Disallowed host', { status: 403 })
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  // Check cache
  const cached = cache.get(url)
  if (cached) {
    cached.at = Date.now() // refresh LRU position
    return new NextResponse(cached.buffer, {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  }

  // Fetch from origin
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { Referer: '' }, // some CDNs reject requests with referrers
    })
    if (!res.ok) {
      return new NextResponse(null, { status: res.status })
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 422 })
    }
    const buffer = await res.arrayBuffer()

    // Cache it
    cache.set(url, { buffer, contentType, at: Date.now() })
    evict()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
