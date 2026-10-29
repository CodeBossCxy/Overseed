// Translates campaign data into a structured matching profile for creator
// discovery. Computed on-demand — not stored separately. Each filter carries
// provenance metadata (source + constraint type) so the retry/broadening
// logic knows which filters can be relaxed.

import type { CreatorDbCanonicalField, CreatorDbFilterOp } from '@/lib/creatordb-filter-fields'
import type { CreatorDbFilterValue } from '@/lib/creatordb-filter-presets'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FilterSource = 'campaign' | 'user' | 'ai' | 'system'
export type ConstraintType = 'hard' | 'soft'

export interface MatchFilter {
  field: CreatorDbCanonicalField
  op: CreatorDbFilterOp
  value: CreatorDbFilterValue
  source: FilterSource
  constraint: ConstraintType
}

export interface CampaignMatchProfile {
  filters: MatchFilter[]
  platform: string
  briefText: string
  metadata: {
    objective?: string
    contentStyles?: string[]
    categories: string[]
    brandPositioning?: string
    productUrl?: string
  }
}

// ── Creator tier → follower ranges ────────────────────────────────────────────

const TIER_RANGES: Record<string, { min: number; max: number }> = {
  NANO:    { min: 1000,    max: 10000 },
  MICRO:   { min: 10000,   max: 100000 },
  MIDTIER: { min: 100000,  max: 500000 },
  MACRO:   { min: 500000,  max: 1000000 },
  MEGA:    { min: 1000000, max: 100000000 },
}

// ── Build profile from campaign ───────────────────────────────────────────────

/**
 * Build a CampaignMatchProfile from campaign data. This is the single source
 * of truth for translating campaign fields into search parameters.
 *
 * The campaign object should include relations: platforms, categories,
 * followerRequirements.
 */
export function buildMatchProfile(campaign: {
  title: string
  description?: string | null
  categories: { category: { name: string } }[]
  platforms: { platform: { name: string } }[]
  followerRequirements?: { minFollowers: number; maxFollowers?: number | null }[]
  contentGuidelines?: string | null
  contentType?: string | null
  campaignObjective?: string | null
  targetCountries?: string[]
  targetLanguages?: string[]
  targetAudienceAge?: string[]
  targetAudienceGender?: string | null
  productUrl?: string | null
  brandPositioning?: string | null
  contentStyles?: string[]
  creatorTierPreference?: string | null
  creatorTypePreference?: string | null
  compensationTypes?: string[]
}): CampaignMatchProfile {
  const filters: MatchFilter[] = []

  // ── Platform ────────────────────────────────────────────────────────────────
  const campPlatform = (campaign.platforms[0]?.platform.name || '').toLowerCase()
  const platform = ['tiktok', 'instagram', 'youtube'].includes(campPlatform)
    ? campPlatform
    : 'instagram'

  // ── Target countries → creator country filter (hard) ────────────────────────
  if (campaign.targetCountries && campaign.targetCountries.length > 0) {
    if (campaign.targetCountries.length === 1) {
      filters.push({
        field: 'country',
        op: '=',
        value: campaign.targetCountries[0],
        source: 'campaign',
        constraint: 'hard',
      })
    } else {
      filters.push({
        field: 'audienceLocation',
        op: 'in',
        value: campaign.targetCountries,
        source: 'campaign',
        constraint: 'hard',
      })
    }
  }

  // ── Target languages → language filter (soft) ──────────────────────────────
  if (campaign.targetLanguages && campaign.targetLanguages.length === 1) {
    filters.push({
      field: 'mainLanguage',
      op: '=',
      value: campaign.targetLanguages[0],
      source: 'campaign',
      constraint: 'soft',
    })
  }

  // ── Follower requirements (hard) ───────────────────────────────────────────
  const req = campaign.followerRequirements?.[0]
  if (req) {
    if (req.minFollowers > 0) {
      filters.push({
        field: 'followers',
        op: '>',
        value: req.minFollowers,
        source: 'campaign',
        constraint: 'hard',
      })
    }
    if (req.maxFollowers) {
      filters.push({
        field: 'followers',
        op: '<',
        value: req.maxFollowers,
        source: 'campaign',
        constraint: 'hard',
      })
    }
  } else if (campaign.creatorTierPreference && TIER_RANGES[campaign.creatorTierPreference]) {
    // Use tier preference as fallback for follower range
    const range = TIER_RANGES[campaign.creatorTierPreference]
    filters.push(
      { field: 'followers', op: '>', value: range.min, source: 'campaign', constraint: 'soft' },
      { field: 'followers', op: '<', value: range.max, source: 'campaign', constraint: 'soft' },
    )
  }

  // ── Audience demographics (soft) ───────────────────────────────────────────
  if (campaign.targetAudienceAge && campaign.targetAudienceAge.length > 0) {
    // Map campaign age buckets to CreatorDB format:
    // '45-64' (single bucket) → '45-54', '55-64' (two buckets)
    // '65-' → '65+'
    const cdbAges = campaign.targetAudienceAge.flatMap((age) => {
      if (age === '45-64') return ['45-54', '55-64']
      if (age === '65-') return ['65+']
      return [age]
    })
    filters.push({
      field: 'audienceAge',
      op: 'in',
      value: cdbAges,
      source: 'campaign',
      constraint: 'soft',
    })
  }

  // audienceGender and lastPublishTime are intentionally omitted here.
  // They over-constrain AI matching results. Users can set them manually
  // via the filter UI if needed.

  // ── Build brief text for AI niche extraction + bio scoring ─────────────────
  const briefParts = [
    campaign.title,
    `Categories: ${campaign.categories.map(c => c.category.name).join(', ')}`,
    `Platform: ${platform}`,
    campaign.description ? `Description: ${campaign.description.slice(0, 500)}` : '',
    campaign.contentGuidelines ? `Content guidelines: ${campaign.contentGuidelines.slice(0, 200)}` : '',
    campaign.contentType ? `Content type: ${campaign.contentType}` : '',
    campaign.contentStyles?.length ? `Content styles: ${campaign.contentStyles.join(', ')}` : '',
    campaign.brandPositioning ? `Brand positioning: ${campaign.brandPositioning}` : '',
    campaign.productUrl ? `Product URL: ${campaign.productUrl}` : '',
    campaign.campaignObjective ? `Campaign objective: ${campaign.campaignObjective.replace(/_/g, ' ')}` : '',
    campaign.compensationTypes?.length ? `Compensation: ${campaign.compensationTypes.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  return {
    filters,
    platform,
    briefText: briefParts,
    metadata: {
      objective: campaign.campaignObjective || undefined,
      contentStyles: campaign.contentStyles?.length ? campaign.contentStyles : undefined,
      categories: campaign.categories.map(c => c.category.name),
      brandPositioning: campaign.brandPositioning || undefined,
      productUrl: campaign.productUrl || undefined,
    },
  }
}

/**
 * Convert MatchFilter[] to the plain cdb_filters format expected by the
 * club-search endpoint. Strips provenance metadata.
 */
export function matchFiltersToApiFilters(
  filters: MatchFilter[],
): { field: string; op: string; value: string | number | boolean | string[] }[] {
  return filters.map(({ field, op, value }) => ({ field, op, value: value as string | number | boolean | string[] }))
}
