import { NextRequest, NextResponse } from 'next/server'
import { getCachedImage, setCachedImage } from '@/lib/avatar-cache'

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

// GET /api/avatar?url=<encoded_url>
// Proxies and caches external avatar/thumbnail images so they survive signed URL expiration.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    const hostname = new URL(url).hostname
    if (!ALLOWED_HOSTS.some((h) => hostname.endsWith(h))) {
      return new NextResponse('Disallowed host', { status: 403 })
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  // Check shared cache
  const cached = getCachedImage(url)
  if (cached) {
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
      headers: { Referer: '' },
    })
    if (!res.ok) {
      return new NextResponse(null, { status: res.status })
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 422 })
    }
    const buffer = await res.arrayBuffer()
    setCachedImage(url, buffer, contentType)

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
