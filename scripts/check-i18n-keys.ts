/**
 * i18n key-parity guard: every locale in lib/i18n/translations.ts must have
 * EXACTLY the same nested key set as `en`. Run in CI / before commits:
 *
 *   npx tsx scripts/check-i18n-keys.ts
 *
 * Exits 1 and prints per-locale missing/extra key paths on mismatch, so a
 * key added to `en` but forgotten in `zh` (or a future locale) fails fast.
 */

import { translations } from '../lib/i18n/translations'

type Tree = Record<string, unknown>

function collectPaths(obj: Tree, prefix = '', out: string[] = []): string[] {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      collectPaths(value as Tree, path, out)
    } else {
      out.push(path)
    }
  }
  return out
}

const locales = Object.keys(translations) as (keyof typeof translations)[]
const reference = 'en' as const
const refPaths = new Set(collectPaths(translations[reference] as unknown as Tree))

let failed = false
for (const locale of locales) {
  if (locale === reference) continue
  const paths = new Set(collectPaths(translations[locale] as unknown as Tree))
  const missing = [...refPaths].filter((p) => !paths.has(p))
  const extra = [...paths].filter((p) => !refPaths.has(p))
  if (missing.length || extra.length) {
    failed = true
    console.error(`\n✗ locale "${locale}" is out of sync with "${reference}":`)
    for (const p of missing) console.error(`  missing: ${p}`)
    for (const p of extra) console.error(`  extra:   ${p}`)
  } else {
    console.log(`✓ locale "${locale}": ${paths.size} keys, in sync`)
  }
}

if (failed) process.exit(1)
console.log(`\nAll ${locales.length} locales share ${refPaths.size} keys.`)
