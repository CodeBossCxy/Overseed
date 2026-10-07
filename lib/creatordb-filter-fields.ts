// Client-safe CreatorDB v3 advanced-search field catalog. Presets use the
// canonical keys; request construction translates them per platform.

export const CREATORDB_PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const
export type CreatorDbPlatform = (typeof CREATORDB_PLATFORMS)[number]
export type CreatorDbFieldType = 'string' | 'number' | 'boolean'
export type CreatorDbFilterOp = '=' | 'in' | '>' | '<'

export const CREATORDB_FIELD_MAP = {
  country: { type: 'string', sortable: true, instagram: 'country', tiktok: 'country', youtube: 'country' },
  mainLanguage: { type: 'string', sortable: true, instagram: 'mainLanguage', tiktok: 'mainLanguage', youtube: 'mainLanguage' },
  isAccountVerified: { type: 'boolean', sortable: false, instagram: 'isAccountVerified', tiktok: 'isAccountVerified', youtube: 'isAccountVerified' },
  hashtags: { type: 'string', sortable: false, instagram: 'hashtags', tiktok: 'hashtags', youtube: 'hashtags' },
  audienceLocation: { type: 'string', sortable: true, instagram: 'mainAudienceLocation', tiktok: 'mainAudienceLocation', youtube: 'mainAudienceLocation' },
  lastPublishTime: { type: 'number', sortable: true, instagram: 'lastPublishTime', tiktok: 'lastPublishTime', youtube: 'lastPublishTime' },
  niches: { type: 'string', sortable: false, instagram: 'niches', tiktok: 'niches', youtube: 'niches' },
  followers: { type: 'number', sortable: true, instagram: 'totalFollowers', tiktok: 'totalFollowers', youtube: 'totalSubscribers' },
  totalContents: { type: 'number', sortable: true, instagram: 'totalContents', tiktok: 'totalContents', youtube: 'totalContents' },
  followerGrowth30d: { type: 'number', sortable: true, instagram: 'followerGrowthIn30d', tiktok: 'followerGrowthIn30d', youtube: 'subscriberGrowthIn30d' },
  contentsIn30Days: { type: 'number', sortable: true, instagram: 'contentsIn30Days', tiktok: 'contentsIn30Days', youtube: 'contentsIn30Days' },
  platformScore: { type: 'number', sortable: true, instagram: 'platformScore', tiktok: 'platformScore', youtube: 'platformScore' },
  audienceGender: { type: 'string', sortable: false, instagram: 'mainAudienceGender', tiktok: 'mainAudienceGender', youtube: 'mainAudienceGender' },
  audienceAge: { type: 'string', sortable: true, instagram: 'mainAudienceAge', tiktok: 'mainAudienceAge', youtube: 'mainAudienceAge' },
  audienceFemaleRatio: { type: 'number', sortable: true, instagram: 'audienceFemaleRatio', tiktok: 'audienceFemaleRatio', youtube: 'audienceFemaleRatio' },
  audienceMaleRatio: { type: 'number', sortable: true, instagram: 'audienceMaleRatio', tiktok: 'audienceMaleRatio', youtube: 'audienceMaleRatio' },
  shortAvgViews: { type: 'number', sortable: true, instagram: 'avgRecentReelsViews', tiktok: 'avgRecentVideosViews', youtube: 'avgRecentShortsViews' },
  shortEngagementRate: { type: 'number', sortable: true, instagram: 'avgRecentReelsEngagementRate', tiktok: 'avgRecentVideosEngagementRate', youtube: 'avgRecentShortsEngagementRate' },
  shortMedianViews: { type: 'number', sortable: true, instagram: 'medianRecentReelsViews', tiktok: 'medianRecentVideosViews', youtube: 'medianRecentShortsViews' },
  shortMinViews: { type: 'number', sortable: true, instagram: 'minRecentReelsViews', tiktok: 'minRecentVideosViews', youtube: 'minRecentShortsViews' },
  shortMaxViews: { type: 'number', sortable: true, instagram: 'maxRecentReelsViews', tiktok: 'maxRecentVideosViews', youtube: 'maxRecentShortsViews' },
  shortAvgLikes: { type: 'number', sortable: true, instagram: 'avgRecentReelsLikes', tiktok: 'avgRecentVideosLikes', youtube: 'avgRecentShortsLikes' },
  shortMedianLikes: { type: 'number', sortable: true, instagram: 'medianRecentReelsLikes', tiktok: 'medianRecentVideosLikes', youtube: 'medianRecentShortsLikes' },
  shortMinLikes: { type: 'number', sortable: true, instagram: 'minRecentReelsLikes', tiktok: 'minRecentVideosLikes', youtube: 'minRecentShortsLikes' },
  shortMaxLikes: { type: 'number', sortable: true, instagram: 'maxRecentReelsLikes', tiktok: 'maxRecentVideosLikes', youtube: 'maxRecentShortsLikes' },
  shortAvgComments: { type: 'number', sortable: true, instagram: 'avgRecentReelsComments', tiktok: 'avgRecentVideosComments', youtube: 'avgRecentShortsComments' },
  shortMedianComments: { type: 'number', sortable: true, instagram: 'medianRecentReelsComments', tiktok: 'medianRecentVideosComments', youtube: 'medianRecentShortsComments' },
  shortMinComments: { type: 'number', sortable: true, instagram: 'minRecentReelsComments', tiktok: 'minRecentVideosComments', youtube: 'minRecentShortsComments' },
  shortMaxComments: { type: 'number', sortable: true, instagram: 'maxRecentReelsComments', tiktok: 'maxRecentVideosComments', youtube: 'maxRecentShortsComments' },
  shortViewsGrowth: { type: 'number', sortable: true, instagram: 'avgRecentReelsViewsGrowth', tiktok: 'avgRecentVideosViewsGrowth', youtube: 'avgRecentShortsViewsGrowth' },
  shortLikesGrowth: { type: 'number', sortable: true, instagram: 'avgRecentReelsLikesGrowth', tiktok: 'avgRecentVideosLikesGrowth', youtube: 'avgRecentShortsLikesGrowth' },
  shortCommentsGrowth: { type: 'number', sortable: true, instagram: 'avgRecentReelsCommentsGrowth', tiktok: 'avgRecentVideosCommentsGrowth', youtube: 'avgRecentShortsCommentsGrowth' },
  shortEngagementRateGrowth: { type: 'number', sortable: true, instagram: 'avgRecentReelsEngagementRateGrowth', tiktok: 'avgRecentVideosEngagementRateGrowth', youtube: 'avgRecentShortsEngagementRateGrowth' },
} as const satisfies Record<string, {
  type: CreatorDbFieldType
  sortable: boolean
} & Record<CreatorDbPlatform, string>>

export type CreatorDbCanonicalField = keyof typeof CREATORDB_FIELD_MAP

export const CREATORDB_FILTER_CATALOG: readonly {
  field: CreatorDbCanonicalField
  label: string
}[] = [
  ['country', 'Creator country'], ['mainLanguage', 'Primary language'],
  ['isAccountVerified', 'Verified account'],
  ['hashtags', 'Hashtags'], ['niches', 'Niches'], ['followers', 'Followers / subscribers'],
  ['totalContents', 'Total content count'], ['lastPublishTime', 'Last publish time'],
  ['followerGrowth30d', 'Follower growth (30d)'], ['contentsIn30Days', 'Content count (30d)'],
  ['platformScore', 'Platform score'], ['audienceLocation', 'Main audience location'],
  ['audienceAge', 'Main audience age'], ['audienceGender', 'Main audience gender'],
  ['audienceMaleRatio', 'Audience male ratio'], ['audienceFemaleRatio', 'Audience female ratio'],
  ['shortAvgViews', 'Average short views'], ['shortMedianViews', 'Median short views'],
  ['shortMinViews', 'Minimum short views'], ['shortMaxViews', 'Maximum short views'],
  ['shortAvgLikes', 'Average short likes'], ['shortMedianLikes', 'Median short likes'],
  ['shortMinLikes', 'Minimum short likes'], ['shortMaxLikes', 'Maximum short likes'],
  ['shortAvgComments', 'Average short comments'], ['shortMedianComments', 'Median short comments'],
  ['shortMinComments', 'Minimum short comments'], ['shortMaxComments', 'Maximum short comments'],
  ['shortEngagementRate', 'Short engagement rate'], ['shortViewsGrowth', 'Short views growth'],
  ['shortLikesGrowth', 'Short likes growth'], ['shortCommentsGrowth', 'Short comments growth'],
  ['shortEngagementRateGrowth', 'Short engagement growth'],
].map(([field, label]) => ({ field: field as CreatorDbCanonicalField, label: label as string }))

export const CREATORDB_AUDIENCE_GENDERS = ['male', 'female'] as const
export const CREATORDB_AUDIENCE_AGES = [
  '13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+',
] as const

const COUNTRY_A2_TO_A3: Record<string, string> = {
  US: 'USA', UK: 'GBR', GB: 'GBR', CA: 'CAN', AU: 'AUS', CN: 'CHN', JP: 'JPN',
  KR: 'KOR', SG: 'SGP', DE: 'DEU', FR: 'FRA', NL: 'NLD', SE: 'SWE', BR: 'BRA',
  MX: 'MEX', IN: 'IND', AE: 'ARE', NZ: 'NZL', IT: 'ITA', ES: 'ESP', TW: 'TWN',
  TH: 'THA', PH: 'PHL', ID: 'IDN', MY: 'MYS', VN: 'VNM', RU: 'RUS', TR: 'TUR',
  PL: 'POL', AR: 'ARG', CL: 'CHL', CO: 'COL', PE: 'PER', ZA: 'ZAF', EG: 'EGY',
  SA: 'SAU', IL: 'ISR', HK: 'HKG', IE: 'IRL', AT: 'AUT', CH: 'CHE', BE: 'BEL',
  DK: 'DNK', FI: 'FIN', NO: 'NOR', PT: 'PRT',
}

export const CREATORDB_COUNTRY_OPTIONS = Object.entries(COUNTRY_A2_TO_A3)
  .filter(([alpha2]) => alpha2 !== 'UK')
  .map(([alpha2, value]) => ({ alpha2, value }))

const LANGUAGE_A2_TO_A3: Record<string, string> = {
  en: 'eng', zh: 'zho', es: 'spa', pt: 'por', fr: 'fra', de: 'deu',
  it: 'ita', nl: 'nld', sv: 'swe', ja: 'jpn', ko: 'kor', ar: 'ara',
  hi: 'hin', id: 'ind', th: 'tha', vi: 'vie', tr: 'tur', ru: 'rus',
  pl: 'pol', ms: 'msa',
}

export const CREATORDB_LANGUAGE_OPTIONS = [
  ['eng', 'English'], ['zho', '中文'], ['spa', 'Español'], ['por', 'Português'],
  ['fra', 'Français'], ['deu', 'Deutsch'], ['ita', 'Italiano'], ['nld', 'Nederlands'],
  ['swe', 'Svenska'], ['jpn', '日本語'], ['kor', '한국어'], ['ara', 'العربية'],
  ['hin', 'हिन्दी'], ['ind', 'Bahasa Indonesia'], ['tha', 'ไทย'], ['vie', 'Tiếng Việt'],
  ['tur', 'Türkçe'], ['rus', 'Русский'], ['pol', 'Polski'], ['msa', 'Bahasa Melayu'],
] as const satisfies readonly (readonly [string, string])[]

export function creatorDbCountryCode(value: string): string {
  const upper = value.trim().toUpperCase()
  return COUNTRY_A2_TO_A3[upper] ?? upper
}

export function creatorDbLanguageCode(value: string): string {
  const trimmed = value.trim()
  return LANGUAGE_A2_TO_A3[trimmed.toLowerCase()] ?? trimmed.toLowerCase()
}

export function creatorDbFieldName(
  field: CreatorDbCanonicalField,
  platform: CreatorDbPlatform,
): string {
  return CREATORDB_FIELD_MAP[field][platform]
}
