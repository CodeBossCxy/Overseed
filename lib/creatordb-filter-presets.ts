import type {
  CreatorDbCanonicalField,
  CreatorDbFilterOp,
} from '@/lib/creatordb-filter-fields'

export type CreatorDbPresetId = 'A' | 'B' | 'C' | 'D'
export type CreatorDbFilterValue = string | number | boolean | string[]

export interface CreatorDbPresetFilter {
  id: string
  field: CreatorDbCanonicalField
  op: CreatorDbFilterOp
  defaultValue?: CreatorDbFilterValue
  editable: boolean
  label: string
}

export interface CreatorDbPreset {
  id: CreatorDbPresetId
  name: string
  useCase: string
  filters: readonly CreatorDbPresetFilter[]
  sortField: CreatorDbCanonicalField
  desc: boolean
}

export const CREATORDB_CORE_FILTERS = [
  { id: 'country', field: 'country', op: '=', defaultValue: 'USA', editable: true, label: 'Creator country' },
  { id: 'audienceLocation', field: 'audienceLocation', op: '=', defaultValue: 'USA', editable: true, label: 'Audience country' },
  // lastPublishTime is computed from lastPublishDays by the request builder.
  { id: 'lastPublishTime', field: 'lastPublishTime', op: '>', editable: true, label: 'Published within days' },
] as const satisfies readonly CreatorDbPresetFilter[]

const niches = {
  id: 'niches', field: 'niches', op: 'in', editable: true, label: 'Niches',
} as const satisfies CreatorDbPresetFilter

export const CREATORDB_PRESETS: Record<CreatorDbPresetId, CreatorDbPreset> = {
  A: {
    id: 'A', name: 'Brand-ready micro-creators', useCase: 'Seeding / gifting',
    filters: [
      { id: 'followersMin', field: 'followers', op: '>', defaultValue: 10_000, editable: true, label: 'Minimum followers' },
      { id: 'followersMax', field: 'followers', op: '<', defaultValue: 100_000, editable: true, label: 'Maximum followers' },
      { id: 'shortEngagementRateMin', field: 'shortEngagementRate', op: '>', defaultValue: 0.05, editable: true, label: 'Minimum short engagement rate' },
      { id: 'contentsIn30DaysMin', field: 'contentsIn30Days', op: '>', defaultValue: 8, editable: true, label: 'Minimum posts in 30 days' },
      niches,
    ],
    sortField: 'shortEngagementRate', desc: true,
  },
  B: {
    id: 'B', name: 'Rising stars', useCase: 'Catch growth early',
    filters: [
      { id: 'followersMin', field: 'followers', op: '>', defaultValue: 5_000, editable: true, label: 'Minimum followers' },
      { id: 'followersMax', field: 'followers', op: '<', defaultValue: 200_000, editable: true, label: 'Maximum followers' },
      { id: 'followerGrowth30dMin', field: 'followerGrowth30d', op: '>', defaultValue: 0.05, editable: true, label: 'Minimum 30-day follower growth' },
      { id: 'shortViewsGrowthMin', field: 'shortViewsGrowth', op: '>', defaultValue: 0.2, editable: true, label: 'Minimum short views growth' },
      niches,
    ],
    sortField: 'followerGrowth30d', desc: true,
  },
  C: {
    id: 'C', name: 'Precise audience match', useCase: 'Audience targeting',
    filters: [
      { id: 'audienceGender', field: 'audienceGender', op: '=', defaultValue: 'female', editable: true, label: 'Primary audience gender' },
      { id: 'audienceAge', field: 'audienceAge', op: '=', editable: true, label: 'Primary audience age' },
      { id: 'audienceFemaleRatioMin', field: 'audienceFemaleRatio', op: '>', defaultValue: 0.7, editable: true, label: 'Minimum female audience ratio' },
      { id: 'followersMin', field: 'followers', op: '>', defaultValue: 20_000, editable: true, label: 'Minimum followers' },
      niches,
    ],
    sortField: 'audienceFemaleRatio', desc: true,
  },
  D: {
    id: 'D', name: 'Proven, consistent reach', useCase: 'Filter one-hit viral accounts',
    filters: [
      { id: 'followersMin', field: 'followers', op: '>', defaultValue: 50_000, editable: true, label: 'Minimum followers' },
      { id: 'shortMedianViewsMin', field: 'shortMedianViews', op: '>', defaultValue: 20_000, editable: true, label: 'Minimum median short views' },
      { id: 'shortMinLikesMin', field: 'shortMinLikes', op: '>', defaultValue: 500, editable: true, label: 'Minimum likes on recent shorts' },
      { id: 'platformScoreMin', field: 'platformScore', op: '>', editable: true, label: 'Minimum platform score' },
      niches,
    ],
    sortField: 'shortMedianViews', desc: true,
  },
}

