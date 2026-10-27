// Platform-specific filter capability registry for CreatorDB.
// Determines which canonical filters can be applied on each platform
// and whether they work at search time or need post-search evaluation.

import {
  CREATORDB_FIELD_MAP,
  type CreatorDbCanonicalField,
  type CreatorDbPlatform,
} from '@/lib/creatordb-filter-fields'

export type FilterStage = 'search' | 'post_search' | 'unsupported'

export interface FilterCapability {
  supported: boolean
  stage: FilterStage
  note?: string
}

// All fields in CREATORDB_FIELD_MAP are search-time filters on all three
// platforms (they all have per-platform API field names). This registry
// adds semantic nuance: some filters are technically supported but produce
// unreliable results on certain platforms.
const PLATFORM_NOTES: Partial<Record<CreatorDbPlatform, Partial<Record<CreatorDbCanonicalField, {
  stage: FilterStage
  note: string
}>>>> = {
  youtube: {
    // YouTube audience demographics are less reliable than Instagram/TikTok
    audienceGender: { stage: 'search', note: 'YouTube audience gender data may be less precise' },
    audienceAge: { stage: 'search', note: 'YouTube audience age data may be less precise' },
  },
}

/**
 * Check whether a canonical filter field is supported on a given platform.
 */
export function getFilterCapability(
  platform: CreatorDbPlatform,
  field: CreatorDbCanonicalField,
): FilterCapability {
  const fieldDef = CREATORDB_FIELD_MAP[field]
  if (!fieldDef) {
    return { supported: false, stage: 'unsupported', note: `Unknown field: ${field}` }
  }

  // Check if the platform has a mapped API field name
  const apiFieldName = fieldDef[platform]
  if (!apiFieldName) {
    return { supported: false, stage: 'unsupported', note: `${field} is not available on ${platform}` }
  }

  // Check for platform-specific notes
  const note = PLATFORM_NOTES[platform]?.[field]
  if (note) {
    return { supported: true, stage: note.stage, note: note.note }
  }

  return { supported: true, stage: 'search' }
}

export interface FilterForPlatformResult<T> {
  applicable: T[]
  skipped: { field: string; reason: string }[]
}

/**
 * Filter a list of search filters to only those supported on the given platform.
 * Returns both the applicable filters and a list of what was skipped with reasons.
 */
export function filterForPlatform<T extends { field: CreatorDbCanonicalField }>(
  platform: CreatorDbPlatform,
  filters: T[],
): FilterForPlatformResult<T> {
  const applicable: T[] = []
  const skipped: { field: string; reason: string }[] = []

  for (const filter of filters) {
    const cap = getFilterCapability(platform, filter.field)
    if (cap.supported && cap.stage === 'search') {
      applicable.push(filter)
    } else {
      skipped.push({
        field: filter.field,
        reason: cap.note || `${filter.field} is not supported on ${platform}`,
      })
    }
  }

  return { applicable, skipped }
}

/**
 * Get a summary of all filter capabilities for a platform.
 */
export function getPlatformCapabilities(
  platform: CreatorDbPlatform,
): Record<CreatorDbCanonicalField, FilterCapability> {
  const result = {} as Record<CreatorDbCanonicalField, FilterCapability>
  for (const field of Object.keys(CREATORDB_FIELD_MAP) as CreatorDbCanonicalField[]) {
    result[field] = getFilterCapability(platform, field)
  }
  return result
}
