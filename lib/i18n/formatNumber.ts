import type { Locale } from './translations'

/**
 * Format a number with locale-appropriate grouping.
 * - English: "1,234,567"
 * - Chinese: "1,234,567" (zh-CN grouping)
 */
export function formatNumber(value: number | null | undefined, locale: Locale): string {
  if (value == null || isNaN(value)) return ''
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(value)
}

/**
 * Format a large count compactly (e.g. follower counts).
 * - English: "1.2M", "3.4K"
 * - Chinese: "120万", "3400" (uses 万/亿 units)
 */
export function formatCompactNumber(value: number | null | undefined, locale: Locale): string {
  if (value == null || isNaN(value)) return ''

  if (locale === 'zh') {
    if (value >= 100000000) return `${trimZero((value / 100000000).toFixed(1))}亿`
    if (value >= 10000) return `${trimZero((value / 10000).toFixed(1))}万`
    return new Intl.NumberFormat('zh-CN').format(value)
  }

  if (value >= 1000000) return `${trimZero((value / 1000000).toFixed(1))}M`
  if (value >= 1000) return `${trimZero((value / 1000).toFixed(1))}K`
  return new Intl.NumberFormat('en-US').format(value)
}

/** "1.0" -> "1", "1.2" -> "1.2" */
function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s
}
