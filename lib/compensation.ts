import type { CompensationType } from '@prisma/client'

// The types brands can multi-select. PAID_PLUS_GIFT is a legacy combined
// value — it maps to [PAID, GIFTED] and is never selectable on its own.
export const SELECTABLE_COMPENSATION_TYPES = ['PAID', 'GIFTED', 'AFFILIATE', 'NEGOTIABLE'] as const

export function normalizeCompensationTypes(
  input: unknown,
  legacy?: string | null
): CompensationType[] {
  const valid = SELECTABLE_COMPENSATION_TYPES as readonly string[]
  const arr = Array.isArray(input)
    ? [...new Set(input.filter((v): v is CompensationType => valid.includes(v)))]
    : []
  if (arr.length) return arr
  // Fall back to the legacy single value (old clients / old drafts)
  if (legacy === 'PAID_PLUS_GIFT') return ['PAID', 'GIFTED']
  if (legacy && valid.includes(legacy)) return [legacy as CompensationType]
  return []
}

// Derived single value kept on Campaign.compensationType for existing
// filters and badges.
export function deriveLegacyCompensationType(types: CompensationType[]): CompensationType {
  if (types.includes('PAID') && types.includes('GIFTED')) return 'PAID_PLUS_GIFT'
  return types[0] || 'NEGOTIABLE'
}

// Expand a campaign's compensation for display: prefer the new array,
// fall back to the legacy single value on old rows.
export function displayCompensationTypes(campaign: {
  compensationTypes?: CompensationType[] | null
  compensationType?: CompensationType | string | null
}): CompensationType[] {
  if (campaign.compensationTypes?.length) return campaign.compensationTypes
  return normalizeCompensationTypes(null, campaign.compensationType as string | null)
}
