import {
  CREATORDB_AUDIENCE_AGES,
  CREATORDB_AUDIENCE_GENDERS,
  CREATORDB_FIELD_MAP,
  CREATORDB_PLATFORMS,
  creatorDbCountryCode,
  creatorDbFieldName,
  creatorDbLanguageCode,
  type CreatorDbCanonicalField,
  type CreatorDbFilterOp,
  type CreatorDbPlatform,
} from '@/lib/creatordb-filter-fields'
import {
  CREATORDB_CORE_FILTERS,
  CREATORDB_PRESETS,
  type CreatorDbFilterValue,
  type CreatorDbPresetId,
} from '@/lib/creatordb-filter-presets'

export interface CreatorDbExtraFilter {
  field: CreatorDbCanonicalField
  op: CreatorDbFilterOp
  value: CreatorDbFilterValue
}

export type CreatorDbCanonicalFilter = CreatorDbExtraFilter

export interface CreatorDbPresetOverrides {
  country?: string | null
  audienceLocation?: string | null
  lastPublishDays?: number | null
  values?: Record<string, CreatorDbFilterValue | null | undefined>
  extraFilters?: CreatorDbExtraFilter[]
}

export interface CreatorDbPagination {
  pageSize?: number
  offset?: number
}

export interface CreatorDbApiFilter {
  filterName: string
  op: CreatorDbFilterOp
  value: CreatorDbFilterValue
}

export interface CreatorDbSearchRequest {
  filters: CreatorDbApiFilter[]
  sortBy: string
  desc: boolean
  pageSize: number
  offset: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function isEmpty(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0)
}

function validateValue(
  field: CreatorDbCanonicalField,
  op: CreatorDbFilterOp,
  value: CreatorDbFilterValue,
) {
  if (!Object.prototype.hasOwnProperty.call(CREATORDB_FIELD_MAP, field)) {
    throw new Error(`Unknown CreatorDB canonical field: ${field}`)
  }
  const def = CREATORDB_FIELD_MAP[field]
  const allowed = def.type === 'string' ? ['=', 'in'] : def.type === 'number' ? ['>', '=', '<'] : ['=']
  if (!allowed.includes(op)) throw new Error(`Operator ${op} is invalid for ${field} (${def.type})`)
  if (op === 'in') {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100 || value.some((v) => typeof v !== 'string' || !v.trim())) {
      throw new Error(`${field} with operator in requires 1-100 non-empty strings`)
    }
  } else if (def.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`${field} requires a finite number`)
  } else if (def.type === 'string' && (typeof value !== 'string' || !value.trim())) {
    throw new Error(`${field} requires a non-empty string`)
  } else if (def.type === 'boolean' && typeof value !== 'boolean') {
    throw new Error(`${field} requires a boolean`)
  }
  if ((field === 'country' || field === 'audienceLocation') && (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value))) {
    throw new Error(`${field} must be an ISO 3166-1 alpha-3 code such as USA`)
  }
  if (field === 'audienceGender' && !CREATORDB_AUDIENCE_GENDERS.includes(value as any)) {
    throw new Error(`audienceGender must be ${CREATORDB_AUDIENCE_GENDERS.join(' or ')}`)
  }
  if (field === 'audienceAge' && !CREATORDB_AUDIENCE_AGES.includes(value as any)) {
    throw new Error(`audienceAge must be one of ${CREATORDB_AUDIENCE_AGES.join(', ')}`)
  }
}

export function buildCustomSearchRequest(
  platform: CreatorDbPlatform,
  selectedFilters: CreatorDbCanonicalFilter[],
  pagination: CreatorDbPagination = {},
  sortField: CreatorDbCanonicalField = 'followers',
  desc = true,
): CreatorDbSearchRequest {
  if (!CREATORDB_PLATFORMS.includes(platform)) throw new Error(`Unsupported CreatorDB platform: ${platform}`)
  if (selectedFilters.length > 10) {
    throw new Error(`CreatorDB searches are limited to 10 filters (received ${selectedFilters.length})`)
  }
  if (!CREATORDB_FIELD_MAP[sortField]?.sortable) throw new Error(`${sortField} cannot be used for sorting`)

  const filters = selectedFilters.map(({ field, op, value }) => {
    const normalized = (field === 'country' || field === 'audienceLocation') && typeof value === 'string'
      ? creatorDbCountryCode(value)
      : field === 'mainLanguage' && typeof value === 'string'
        ? creatorDbLanguageCode(value)
      : op === 'in' && Array.isArray(value)
        ? [...new Set(value.map((item) => item.trim()).filter(Boolean))]
        : value
    validateValue(field, op, normalized)
    return { filterName: creatorDbFieldName(field, platform), op, value: normalized }
  })

  const pageSize = pagination.pageSize ?? 100
  const offset = pagination.offset ?? 0
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('pageSize must be an integer between 1 and 100')
  if (!Number.isInteger(offset) || offset < 0) throw new Error('offset must be a non-negative integer')
  return { filters, sortBy: creatorDbFieldName(sortField, platform), desc, pageSize, offset }
}

export function buildSearchRequest(
  platform: CreatorDbPlatform,
  presetId: CreatorDbPresetId,
  overrides: CreatorDbPresetOverrides = {},
  pagination: CreatorDbPagination = {},
  now: () => number = Date.now,
): CreatorDbSearchRequest {
  if (!CREATORDB_PLATFORMS.includes(platform)) throw new Error(`Unsupported CreatorDB platform: ${platform}`)
  const preset = CREATORDB_PRESETS[presetId]
  if (!preset) throw new Error(`Unknown CreatorDB preset: ${presetId}`)
  if ((overrides.extraFilters?.length ?? 0) > 2) throw new Error('At most 2 extra filters are allowed')

  const values = overrides.values ?? {}
  const lastPublishDays = overrides.lastPublishDays ?? 30
  if (!Number.isFinite(lastPublishDays) || lastPublishDays <= 0) {
    throw new Error('lastPublishDays must be a positive number')
  }

  const configured = [
    ...CREATORDB_CORE_FILTERS.map((filter) => ({
      ...filter,
      value: filter.id === 'lastPublishTime'
        ? now() - lastPublishDays * DAY_MS
        : filter.id === 'country'
          ? (overrides.country === undefined ? filter.defaultValue : overrides.country)
          : (overrides.audienceLocation === undefined ? filter.defaultValue : overrides.audienceLocation),
    })),
    ...preset.filters.map((filter) => ({
      ...filter,
      value: Object.prototype.hasOwnProperty.call(values, filter.id)
        ? values[filter.id]
        : filter.defaultValue,
    })),
    ...(overrides.extraFilters ?? []).map((filter, index) => ({
      id: `extra${index + 1}`,
      editable: true,
      label: `Extra filter ${index + 1}`,
      ...filter,
    })),
  ]

  const filters: CreatorDbApiFilter[] = []
  for (const filter of configured) {
    if (isEmpty(filter.value)) continue
    const value = filter.field === 'niches' && Array.isArray(filter.value)
      ? [...new Set(filter.value.map((v) => v.trim()).filter(Boolean))]
      : (filter.field === 'country' || filter.field === 'audienceLocation') && typeof filter.value === 'string'
        ? creatorDbCountryCode(filter.value)
        : filter.value as CreatorDbFilterValue
    if (isEmpty(value)) continue
    validateValue(filter.field, filter.op, value)
    filters.push({ filterName: creatorDbFieldName(filter.field, platform), op: filter.op, value })
  }

  if (filters.length > 10) {
    throw new Error(`CreatorDB searches are limited to 10 filters (received ${filters.length})`)
  }

  const pageSize = pagination.pageSize ?? 100
  const offset = pagination.offset ?? 0
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error('pageSize must be an integer between 1 and 100')
  }
  if (!Number.isInteger(offset) || offset < 0) throw new Error('offset must be a non-negative integer')

  return {
    filters,
    sortBy: creatorDbFieldName(preset.sortField, platform),
    desc: preset.desc,
    pageSize,
    offset,
  }
}
