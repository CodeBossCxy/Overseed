// Pure display helpers for the pricing page — no Prisma imports.

const FEATURE_ORDER = [
  'chat_standard',
  'chat_advanced',
  'image',
  'discovery_search',
  'profile_view',
  'outreach',
  'analytics',
] as const

/**
 * How many times can `credits` be spent per feature?
 * Skips free features (price <= 0) and features with 0 result.
 * Ordered by FEATURE_ORDER.
 */
export function computeEquivalents(
  credits: number,
  prices: Record<string, number>,
): { featureKey: string; count: number }[] {
  const result: { featureKey: string; count: number }[] = []
  for (const key of FEATURE_ORDER) {
    const price = prices[key]
    if (!price || price <= 0) continue
    const count = Math.floor(credits / price)
    if (count <= 0) continue
    result.push({ featureKey: key, count })
  }
  return result
}

/**
 * ¥/credit value formatted to 2–3 significant decimals (trailing zeros trimmed
 * to a minimum of 2 decimal places).
 * e.g. priceCents=990, credits=50 → "¥0.198"
 *      priceCents=990, credits=100 → "¥0.099" → "¥0.099"
 *      priceCents=2900, credits=200 → "¥0.145"
 */
export function perCreditYuan(priceCents: number, credits: number): string {
  if (!credits) return '¥0'
  const yuan = priceCents / 100 / credits
  // Format to 3 decimals, then trim trailing zeros but keep at least 2.
  let s = yuan.toFixed(3)
  // Remove trailing zeros beyond 2 decimal places.
  s = s.replace(/(\.\d\d)0+$/, '$1')
  return `¥${s}`
}

/**
 * "¥9.9 / 50 credits" — price without trailing .0.
 */
export function formatPackName(priceCents: number, totalCredits: number): string {
  const yuan = priceCents / 100
  // Exact price: show up to 2 decimals, trim trailing zeros (¥9.9, ¥9.95, ¥29).
  const priceStr = yuan % 1 === 0 ? String(yuan) : yuan.toFixed(2).replace(/0$/, '')
  return `¥${priceStr} / ${totalCredits} credits`
}
