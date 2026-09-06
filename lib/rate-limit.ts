// Minimal fixed-window in-memory rate limiter for free metered features
// (translation, doc export — 0 credits by policy, limited to prevent abuse).
// Per-instance only, which is acceptable for abuse prevention; move to a
// shared store if the app ever runs many instances.

const windows = new Map<string, { resetAt: number; count: number }>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  const entry = windows.get(key)
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { resetAt: now + windowMs, count: 1 })
    return { ok: true, retryAfterSec: 0 }
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count += 1
  return { ok: true, retryAfterSec: 0 }
}
