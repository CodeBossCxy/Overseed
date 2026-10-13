// Background image rehosting for discovery search cache.
// Replaces expiring CDN URLs (Instagram, TikTok) with stable S3-hosted
// copies so cached search results keep working for their full TTL.

import { rehostImage } from '@/lib/upload'

/** Default cache TTL in days; override via DISCOVERY_CACHE_TTL_DAYS env. */
export function getCacheTtlMs(): number {
  const days = parseInt(process.env.DISCOVERY_CACHE_TTL_DAYS || '30', 10)
  return (Number.isFinite(days) && days > 0 ? days : 30) * 24 * 60 * 60 * 1000
}

export function getCacheExpiresAt(): Date {
  return new Date(Date.now() + getCacheTtlMs())
}

/**
 * Walk a search result object and replace expiring image URLs with
 * S3-rehosted stable URLs. Mutates the object in place and returns it.
 * Processes avatar_url on each result and coverImageUrl on recent_posts.
 * Runs all fetches in parallel with concurrency capped at 10.
 */
export async function rehostSearchImages<T extends Record<string, any>>(data: T): Promise<T> {
  const results: any[] = Array.isArray(data.results) ? data.results : []
  if (results.length === 0) return data

  // Collect all image URLs that need rehosting
  const jobs: { obj: any; key: string }[] = []
  for (const r of results) {
    if (r.avatar_url) jobs.push({ obj: r, key: 'avatar_url' })
    if (r.avatarUrl) jobs.push({ obj: r, key: 'avatarUrl' })
    if (Array.isArray(r.recent_posts)) {
      for (const post of r.recent_posts) {
        if (post.coverImageUrl) jobs.push({ obj: post, key: 'coverImageUrl' })
      }
    }
  }

  if (jobs.length === 0) return data

  // Process in batches of 10 to limit concurrency
  const BATCH_SIZE = 10
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(async ({ obj, key }) => {
        const rehosted = await rehostImage(obj[key])
        if (rehosted) obj[key] = rehosted
      }),
    )
    // Log failures but don't break — original URL stays in place
    for (const r of settled) {
      if (r.status === 'rejected') {
        console.warn('[rehost] image rehost failed:', r.reason)
      }
    }
  }

  return data
}
