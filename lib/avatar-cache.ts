// Shared in-memory image cache used by the avatar proxy and content routes.
// Each entry is the raw image bytes + content type. LRU eviction when the
// cache exceeds MAX_ENTRIES.

const MAX_ENTRIES = 2000

const cache = new Map<string, { buffer: ArrayBuffer; contentType: string; at: number }>()

function evict() {
  if (cache.size <= MAX_ENTRIES) return
  const entries = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)
  const toDelete = Math.ceil(entries.length * 0.2)
  for (let i = 0; i < toDelete; i++) cache.delete(entries[i][0])
}

export function getCachedImage(url: string) {
  const entry = cache.get(url)
  if (entry) entry.at = Date.now()
  return entry ?? null
}

export function setCachedImage(url: string, buffer: ArrayBuffer, contentType: string) {
  cache.set(url, { buffer, contentType, at: Date.now() })
  evict()
}

export function cacheSize() {
  return cache.size
}

/** Pre-warm the cache by downloading an image. No-op if already cached or fetch fails. */
export async function warmCache(url: string): Promise<boolean> {
  if (cache.has(url)) return true
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { Referer: '' },
    })
    if (!res.ok) return false
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return false
    const buffer = await res.arrayBuffer()
    setCachedImage(url, buffer, contentType)
    return true
  } catch {
    return false
  }
}
