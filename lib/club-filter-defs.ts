// Declarative catalog of influencers.club discovery filters, shared by the
// server request builder (lib/influencers-club.ts), the API route validation
// (app/api/discovery/club-search/route.ts) and the DiscoverPanel UI. Derived
// from the platform-specific request schemas in the club OpenAPI spec
// (InstagramDiscoveryFilters / YouTubeDiscoveryFilters / TikTokDiscoveryFilters).
//
// Client-safe: no server-only imports.

export type ClubPlatform = 'instagram' | 'youtube' | 'tiktok'

export type ClubFilterKind =
  | 'range' // {min?, max?} numeric — params `${id}_min` / `${id}_max`
  | 'keywords' // comma-separated list — param `${id}`
  | 'boolean' // only true is meaningful — param `${id}=1`
  | 'number' // single numeric value — param `${id}`
  | 'enum' // one of options — param `${id}`
  | 'text' // free-text string — param `${id}`
  | 'growth' // {growth_percentage, time_range_months} — params `${id}_pct` / `${id}_months`

export type ClubFilterSection = 'performance' | 'creator' | 'exclusions'

export interface ClubFilterDef {
  id: string
  kind: ClubFilterKind
  section: ClubFilterSection
  // API filter key per platform. A platform absent here does not support the
  // filter — it is skipped with a warning instead of being sent.
  keys: Partial<Record<ClubPlatform, string>>
  label: { en: string; zh: string }
  options?: string[] // enum kind only
  placeholder?: string
}

export const CLUB_FILTER_DEFS: ClubFilterDef[] = [
  // ---- Performance -------------------------------------------------------
  {
    id: 'avg_likes',
    kind: 'range',
    section: 'performance',
    keys: { instagram: 'average_likes', tiktok: 'average_likes' },
    label: { en: 'Avg likes', zh: '平均点赞' },
  },
  {
    id: 'avg_comments',
    kind: 'range',
    section: 'performance',
    keys: { instagram: 'average_comments', tiktok: 'average_comments' },
    label: { en: 'Avg comments', zh: '平均评论' },
  },
  {
    id: 'avg_views',
    kind: 'range',
    section: 'performance',
    keys: { tiktok: 'average_views', youtube: 'average_views_on_long_videos' },
    label: { en: 'Avg video views', zh: '平均视频播放量' },
  },
  {
    id: 'video_downloads',
    kind: 'range',
    section: 'performance',
    keys: { tiktok: 'average_video_downloads' },
    label: { en: 'Avg video downloads', zh: '平均视频下载量' },
  },
  {
    id: 'growth',
    kind: 'growth',
    section: 'performance',
    keys: {
      instagram: 'follower_growth',
      tiktok: 'follower_growth',
      youtube: 'subscriber_growth',
    },
    label: { en: 'Follower growth', zh: '粉丝增长' },
  },

  // ---- Creator profile & status ------------------------------------------
  {
    id: 'account_type',
    kind: 'enum',
    section: 'creator',
    keys: { instagram: 'type', tiktok: 'type', youtube: 'type' },
    label: { en: 'Account type', zh: '账号类型' },
    options: ['Creator', 'Business'],
  },
  {
    id: 'is_verified',
    kind: 'boolean',
    section: 'creator',
    keys: { instagram: 'is_verified', tiktok: 'is_verified', youtube: 'is_verified' },
    label: { en: 'Verified', zh: '已认证' },
  },
  {
    id: 'has_videos',
    kind: 'boolean',
    section: 'creator',
    keys: { instagram: 'has_videos' },
    label: { en: 'Has videos', zh: '有视频' },
  },
  {
    id: 'promotes_affiliate_links',
    kind: 'boolean',
    section: 'creator',
    keys: {
      instagram: 'promotes_affiliate_links',
      tiktok: 'promotes_affiliate_links',
      youtube: 'promotes_affiliate_links',
    },
    label: { en: 'Promotes affiliate links', zh: '推广联盟链接' },
  },
  {
    id: 'has_done_brand_deals',
    kind: 'boolean',
    section: 'creator',
    keys: {
      instagram: 'has_done_brand_deals',
      tiktok: 'has_done_brand_deals',
      youtube: 'has_done_brand_deals',
    },
    label: { en: 'Has done brand deals', zh: '有品牌合作经历' },
  },
  {
    id: 'has_link_in_bio',
    kind: 'boolean',
    section: 'creator',
    keys: {
      instagram: 'has_link_in_bio',
      tiktok: 'has_link_in_bio',
      youtube: 'has_link_in_bio',
    },
    label: { en: 'Has link in bio', zh: '简介含链接' },
  },
  {
    id: 'does_live_streaming',
    kind: 'boolean',
    section: 'creator',
    keys: {
      instagram: 'does_live_streaming',
      tiktok: 'does_live_streaming',
      youtube: 'does_live_streaming',
    },
    label: { en: 'Does live streaming', zh: '有直播' },
  },
  {
    id: 'has_merch',
    kind: 'boolean',
    section: 'creator',
    keys: { instagram: 'has_merch', tiktok: 'has_merch', youtube: 'has_merch' },
    label: { en: 'Sells merch', zh: '售卖周边' },
  },
  {
    id: 'tiktok_shop',
    kind: 'boolean',
    section: 'creator',
    keys: { tiktok: 'has_tik_tok_shop' },
    label: { en: 'Has TikTok Shop', zh: '有 TikTok 小店' },
  },
  {
    id: 'has_shorts',
    kind: 'boolean',
    section: 'creator',
    keys: { youtube: 'has_shorts' },
    label: { en: 'Has Shorts', zh: '有 Shorts' },
  },
  {
    id: 'has_community_posts',
    kind: 'boolean',
    section: 'creator',
    keys: { youtube: 'has_community_posts' },
    label: { en: 'Has community posts', zh: '有社区帖子' },
  },
  {
    id: 'streams_live',
    kind: 'boolean',
    section: 'creator',
    keys: { youtube: 'streams_live' },
    label: { en: 'Streams live on YouTube', zh: '在 YouTube 直播' },
  },
  {
    id: 'has_podcast',
    kind: 'boolean',
    section: 'creator',
    keys: { youtube: 'has_podcast' },
    label: { en: 'Has podcast', zh: '有播客' },
  },
  {
    id: 'has_courses',
    kind: 'boolean',
    section: 'creator',
    keys: { youtube: 'has_courses' },
    label: { en: 'Has courses', zh: '有课程' },
  },
  {
    id: 'has_membership',
    kind: 'boolean',
    section: 'creator',
    keys: { youtube: 'has_membership' },
    label: { en: 'Has channel membership', zh: '有频道会员' },
  },
  {
    id: 'has_live_videos',
    kind: 'boolean',
    section: 'creator',
    keys: { youtube: 'has_live_videos' },
    label: { en: 'Has live videos', zh: '有直播视频' },
  },
  {
    id: 'is_monetizing',
    kind: 'boolean',
    section: 'creator',
    keys: { youtube: 'is_monetizing' },
    label: { en: 'Is monetizing', zh: '已开启变现' },
  },
  {
    id: 'last_upload_short',
    kind: 'enum',
    section: 'creator',
    keys: { youtube: 'last_upload_short_video' },
    options: ['90', '365'],
    label: { en: 'Last Shorts upload (days)', zh: '最近 Shorts 上传 (天)' },
  },

  // ---- Exclusions --------------------------------------------------------
  {
    id: 'exclude_private',
    kind: 'boolean',
    section: 'exclusions',
    keys: { instagram: 'exclude_private_profile', tiktok: 'exclude_private_profile' },
    label: { en: 'Exclude private profiles', zh: '排除私密账号' },
  },
  {
    id: 'exclude_role_based_emails',
    kind: 'boolean',
    section: 'exclusions',
    keys: {
      instagram: 'exclude_role_based_emails',
      tiktok: 'exclude_role_based_emails',
      youtube: 'exclude_role_based_emails',
    },
    label: { en: 'Exclude role-based emails', zh: '排除公共邮箱账号' },
  },
]

// Full documented creator_has key list (CreatorHasRequest). UI/route values
// are the part after "has_"; note has_whatsApp's mixed case is the API's own.
export const CREATOR_HAS_KEYS = [
  'has_amazonaffiliates',
  'has_applemusic',
  'has_bandcamp',
  'has_behance',
  'has_buymeacoffee',
  'has_cameo',
  'has_canva',
  'has_clubhouse',
  'has_discord',
  'has_dribbble',
  'has_etsy',
  'has_facebook',
  'has_fiverr',
  'has_github',
  'has_gofundme',
  'has_goodreads',
  'has_instagram',
  'has_kakao',
  'has_kickstarter',
  'has_kofi',
  'has_linkedin',
  'has_linktree',
  'has_medium',
  'has_onlyfans',
  'has_patreon',
  'has_personal_website',
  'has_phone',
  'has_pinterest',
  'has_podcast',
  'has_redbubble',
  'has_shopify',
  'has_shopltk',
  'has_snapchat',
  'has_spotify',
  'has_spring',
  'has_streamlabs',
  'has_substack',
  'has_telegram',
  'has_tiktok',
  'has_tumblr',
  'has_twitch',
  'has_twitter',
  'has_udemy',
  'has_viber',
  'has_vimeo',
  'has_vk',
  'has_weebly',
  'has_whatsApp',
  'has_youtube',
  'has_wix',
  'has_anchor',
  'has_soundcloud',
  'has_community',
] as const

export const SORT_BY_OPTIONS = [
  'relevancy',
  'engagement_rate',
  'number_of_followers',
  'growth_rate',
] as const
export type ClubSortBy = (typeof SORT_BY_OPTIONS)[number]

export const AUDIENCE_CREDIBILITY_OPTIONS = [
  'bad',
  'low',
  'normal',
  'good',
  'high',
  'best',
] as const

// Audience demographics filters are Instagram-only (10k+ follower creators).
// Single-entry UI shape; the API accepts arrays, we send one-element arrays.
export interface ClubAudienceFilters {
  ageRange?: string // '13-17' | '18-24' | '25-34' | '35-44' | '45-64' | '65-'
  ageMinPct?: number
  gender?: string // 'male' | 'female' (matched_filters echoes lowercase)
  genderMinPct?: number
  locationName?: string
  locationType?: 'country' | 'state' | 'city'
  locationMinPct?: number
  languageAbbr?: string
  languageMinPct?: number
  interestName?: string
  interestMinPct?: number
  credibility?: string
}

// Typed values keyed by def id, shaped to match the API sub-schemas so the
// request builder can assign them directly.
export type ClubAdvancedValue =
  | { min?: number; max?: number } // range
  | { growth_percentage: number; time_range_months?: number } // growth
  | string[] // keywords
  | string // enum / text
  | number // number
  | true // boolean

export type ClubAdvancedFilters = Record<string, ClubAdvancedValue>

export function getFilterDef(id: string): ClubFilterDef | undefined {
  return CLUB_FILTER_DEFS.find((f) => f.id === id)
}
