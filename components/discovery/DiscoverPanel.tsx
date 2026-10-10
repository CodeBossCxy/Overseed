'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  CLUB_FILTER_DEFS,
  CREATOR_HAS_KEYS,
  SORT_BY_OPTIONS,
  AUDIENCE_CREDIBILITY_OPTIONS,
} from '@/lib/club-filter-defs'
import {
  CREATORDB_FIELD_MAP,
  CREATORDB_LANGUAGE_OPTIONS,
  type CreatorDbCanonicalField,
  type CreatorDbFilterOp,
} from '@/lib/creatordb-filter-fields'

interface DiscoveredCreator {
  id: string
  platform: string
  handle: string | null
  display_name: string | null
  bio: string | null
  country: string | null
  language?: string | null
  follower_count: number | null
  engagement_rate: string | number | null
  niche_tags: string[]
  profile_url: string | null
  avatar_url: string | null
  score: number | null
}

interface SearchResult {
  results: DiscoveredCreator[]
  platform_coverage: Record<string, string>
  warnings: string[]
  cache_hits: number
  live_calls: number
  // TEMP: present only on influencers.club responses
  credits_left?: string | null
  credits_used?: number | null
  trace_id?: string | null
  has_next_page?: boolean
  next_offset?: number | null
}

/* TEMP: influencers.club data source — remove this block together with
   lib/influencers-club.ts and app/api/discovery/club-search/. */
type DiscoverySource = 'kol' | 'club'
// Club bills 0.01 credits per returned creator — keep pages small.
const CLUB_PAGE_SIZE = 10
/* END TEMP */

interface DiscoverySearchRequest {
  endpoint: 'club-search' | 'search'
  params: string
  pageSize: number
}

// ---- Niche autocomplete — hardcoded suggestions (no API call) ----
const NICHE_LIST: { name: string; channelCount: number }[] = [
  { name: 'Fashion', channelCount: 18000 },
  { name: 'Beauty', channelCount: 15000 },
  { name: 'Fitness', channelCount: 12000 },
  { name: 'Travel', channelCount: 11000 },
  { name: 'Food', channelCount: 10000 },
  { name: 'Comedy', channelCount: 9000 },
  { name: 'Music', channelCount: 9000 },
  { name: 'Gaming', channelCount: 8500 },
  { name: 'Lifestyle', channelCount: 8000 },
  { name: 'Tech', channelCount: 7500 },
  { name: 'Education', channelCount: 7000 },
  { name: 'Photography', channelCount: 6500 },
  { name: 'Dance', channelCount: 6000 },
  { name: 'DIY', channelCount: 5500 },
  { name: 'Art', channelCount: 5000 },
  { name: 'Sports', channelCount: 5000 },
  { name: 'Health', channelCount: 4800 },
  { name: 'Cooking', channelCount: 4500 },
  { name: 'Vlog', channelCount: 4500 },
  { name: 'Motivation', channelCount: 4200 },
  { name: 'Pets', channelCount: 4000 },
  { name: 'Parenting', channelCount: 3800 },
  { name: 'Finance', channelCount: 3500 },
  { name: 'Business', channelCount: 3500 },
  { name: 'Entertainment', channelCount: 3500 },
  { name: 'Science', channelCount: 3200 },
  { name: 'Automotive', channelCount: 3000 },
  { name: 'Outdoors', channelCount: 3000 },
  { name: 'Yoga', channelCount: 2800 },
  { name: 'Skincare', channelCount: 2800 },
  { name: 'Makeup', channelCount: 2700 },
  { name: 'Home Decor', channelCount: 2500 },
  { name: 'Gardening', channelCount: 2500 },
  { name: 'Shorts', channelCount: 3000 },
  { name: 'Trending', channelCount: 3000 },
  { name: 'Anime', channelCount: 2200 },
  { name: 'Movies', channelCount: 2200 },
  { name: 'Book', channelCount: 2000 },
  { name: 'Luxury', channelCount: 2000 },
  { name: 'Streetwear', channelCount: 1800 },
  { name: 'Wellness', channelCount: 1800 },
  { name: 'Cryptocurrency', channelCount: 1500 },
  { name: 'Real Estate', channelCount: 1500 },
  { name: 'Architecture', channelCount: 1200 },
  { name: 'Sustainability', channelCount: 1000 },
  { name: 'Mental Health', channelCount: 1000 },
  { name: 'Camping', channelCount: 900 },
  { name: 'Nail Art', channelCount: 800 },
  { name: 'Tattoo', channelCount: 700 },
]

function NicheAutocomplete({
  value, onChange, labelCls, inputCls, zh,
}: {
  platform: string; value: string; onChange: (v: string) => void
  labelCls: string; inputCls: string; zh: boolean
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    const lastSegment = query.split(',').pop()?.trim().toLowerCase() || ''
    if (!lastSegment) return NICHE_LIST.slice(0, 15)
    const prefix = NICHE_LIST.filter((n) => n.name.toLowerCase().startsWith(lastSegment))
    const substring = NICHE_LIST.filter((n) => !n.name.toLowerCase().startsWith(lastSegment) && n.name.toLowerCase().includes(lastSegment))
    return [...prefix, ...substring].slice(0, 15)
  }, [query])

  const handleFocus = () => { setOpen(true) }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    setOpen(true)
  }

  const selectNiche = (name: string) => {
    const current = query.split(',').map((s) => s.trim()).filter(Boolean)
    if (!current.some((c) => c.toLowerCase() === name.toLowerCase())) {
      current.push(name)
    }
    const joined = current.join(', ')
    setQuery(joined)
    onChange(joined)
    setOpen(false)
  }

  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)

  return (
    <div ref={containerRef} className="relative">
      <label className={labelCls}>
        <span className="inline-flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          {zh ? '领域' : 'Niches'}
        </span>
      </label>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        placeholder={zh ? '如 Fashion, Beauty' : 'e.g. Fashion, Beauty'}
        className={`w-full ${inputCls}`}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white/100 rounded-lg shadow-lg border border-gray-200 max-h-52 overflow-y-auto" style={{ backdropFilter: 'none', background: '#ffffff' }}>
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">{zh ? '无匹配领域' : 'No matching niches'}</div>
          )}
          {filtered.map((niche, i) => (
            <button
              key={`${niche.name}-${i}`}
              type="button"
              onClick={() => selectNiche(niche.name)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center justify-between"
            >
              <span className="truncate">{niche.name}</span>
              <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{formatCount(niche.channelCount)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const PLATFORMS = ['youtube', 'instagram', 'tiktok'] as const
const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'X / Twitter',
  twitch: 'Twitch',
  onlyfans: 'OnlyFans',
}
const PAGE_SIZE = 50

// Country filter options — ISO codes sent to the discovery APIs, labels from
// the shared t.signupBusiness.countries map.
export const COUNTRY_FILTER_OPTIONS: { code: string; key: string }[] = [
  { code: 'US', key: 'us' },
  { code: 'UK', key: 'uk' },
  { code: 'CA', key: 'ca' },
  { code: 'AU', key: 'au' },
  { code: 'CN', key: 'cn' },
  { code: 'JP', key: 'jp' },
  { code: 'KR', key: 'kr' },
  { code: 'SG', key: 'sg' },
  { code: 'DE', key: 'de' },
  { code: 'FR', key: 'fr' },
  { code: 'NL', key: 'nl' },
  { code: 'SE', key: 'se' },
  { code: 'BR', key: 'br' },
  { code: 'MX', key: 'mx' },
  { code: 'IN', key: 'in' },
  { code: 'AE', key: 'ae' },
  { code: 'NZ', key: 'nz' },
  { code: 'IT', key: 'it' },
  { code: 'ES', key: 'es' },
]

// Language filter options — club classifier abbreviations with native-name
// labels (self-describing, so no i18n entries needed).
export const LANGUAGE_FILTER_OPTIONS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'sv', label: 'Svenska' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
]

// Audience age buckets supported by the club audience filter (IG only)
export const AUDIENCE_AGE_OPTIONS = ['13-17', '18-24', '25-34', '35-44', '45-64', '65-'] as const

const FOLLOWER_TIER_OPTIONS = [
  { value: '', min: '', max: '', label: { en: 'All tiers', zh: '全部层级' } },
  { value: 'nano', min: '1000', max: '10000', label: { en: 'Nano (1K-10K)', zh: 'Nano（1千-1万）' } },
  { value: 'micro', min: '10000', max: '100000', label: { en: 'Micro (10K-100K)', zh: 'Micro（1万-10万）' } },
  { value: 'mid', min: '100000', max: '500000', label: { en: 'Mid-tier (100K-500K)', zh: '中腰部（10万-50万）' } },
  { value: 'macro', min: '500000', max: '1000000', label: { en: 'Macro (500K-1M)', zh: 'Macro（50万-100万）' } },
  { value: 'mega', min: '1000000', max: '', label: { en: 'Mega (1M+)', zh: 'Mega（100万+）' } },
] as const

// Search results + filters survive navigating away and back (per tab).
const SEARCH_STATE_KEY = 'discover:search:v1'

interface SavedSearchState {
  query: string
  platforms: string[]
  country: string
  minFollowers: string
  maxFollowers: string
  minEngagement: string
  maxEngagement: string
  gender: string
  language: string
  bioKeywords: string
  lastPost: string
  audienceAge: string
  // Generic advanced filter values keyed by query-param name; older saved
  // states may not have these — default to empty.
  adv?: Record<string, string>
  creatorHas?: string[]
  aud?: Record<string, string>
  sortBy?: string
  sortOrder?: string
  creatorDbFilters?: CreatorDbFilterInput[]
  result: SearchResult
  request: DiscoverySearchRequest
  page: number
  hasMore: boolean
  // Server-side search task id: pages already fetched within it are served
  // from snapshots for free; only unseen pages are billed.
  taskId?: string | null
}

interface CreatorDbFilterInput {
  field: CreatorDbCanonicalField
  op: CreatorDbFilterOp
  value: string
}

function restoreCreatorDbFilters(value: unknown): CreatorDbFilterInput[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((filter: any) => {
    if (!filter || !Object.prototype.hasOwnProperty.call(CREATORDB_FIELD_MAP, filter.field)) return []
    if (!['=', 'in', '>', '<'].includes(filter.op)) return []
    return [{
      field: filter.field as CreatorDbCanonicalField,
      op: filter.op as CreatorDbFilterOp,
      value: Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value ?? ''),
    }]
  })
}

const CREATORDB_FILTER_GROUPS = [
  {
    id: 'creator',
    label: { en: 'Creator info', zh: '创作者信息' },
    description: { en: 'Basic information about the creator.', zh: '创作者的基本资料。' },
    fields: ['country', 'mainLanguage', 'isAccountVerified', 'niches', 'hashtags'],
  },
  {
    id: 'audience',
    label: { en: 'Audience', zh: '受众' },
    description: { en: 'Location and demographic makeup of the audience.', zh: '受众的地区和人口结构。' },
    fields: ['audienceLocation', 'audienceAge', 'audienceGender', 'audienceMaleRatio', 'audienceFemaleRatio'],
  },
  {
    id: 'performance',
    label: { en: 'Account performance', zh: '账号表现' },
    description: { en: 'Audience size, activity, growth, and platform score.', zh: '受众规模、活跃度、增长和平台评分。' },
    fields: ['followers', 'totalContents', 'followerGrowth30d', 'contentsIn30Days', 'platformScore', 'lastPublishTime'],
  },
  {
    id: 'shorts',
    label: { en: 'Short-form content', zh: '短视频表现' },
    description: { en: 'Views, likes, comments, engagement, and growth for recent short videos.', zh: '近期短视频的播放、点赞、评论、互动和增长。' },
    fields: [
      'shortAvgViews', 'shortMedianViews', 'shortMinViews', 'shortMaxViews',
      'shortAvgLikes', 'shortMedianLikes', 'shortMinLikes', 'shortMaxLikes',
      'shortAvgComments', 'shortMedianComments', 'shortMinComments', 'shortMaxComments',
      'shortEngagementRate', 'shortViewsGrowth', 'shortLikesGrowth',
      'shortCommentsGrowth', 'shortEngagementRateGrowth',
    ],
  },
] as const satisfies readonly {
  id: string
  label: { en: string; zh: string }
  description: { en: string; zh: string }
  fields: readonly CreatorDbCanonicalField[]
}[]

function readSavedSearch(): SavedSearchState | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    return saved?.result?.results && saved?.request ? saved : null
  } catch {
    return null
  }
}

// Coverage statuses that are normal operation, not warnings worth a banner.
const COVERAGE_OK = new Set(['ok', 'cache', 'live'])

// Avatar with referrerPolicy (Google's image CDN rejects some localhost/hotlink
// referrers) and a fallback to the creator's initial if the URL has rotted.
function CreatorAvatar({ url, name, textSize = '' }: { url: string | null; name: string; textSize?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  if (!url || failed) {
    return (
      <div className={`w-full h-full flex items-center justify-center text-gray-400 font-bold ${textSize}`}>
        {(name || '?').charAt(0)}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  )
}

function formatFollowers(count: number | null, locale: string): string {
  if (count == null) return '—'
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(count)
}

// Creator discovery UI shared by the standalone database page and the
// per-campaign "Find your influencer" tab. With no query it browses the
// local creator index; a keyword search goes through the cache-first
// discovery endpoint (which may trigger live provider lookups).
function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V1a11 11 0 0 0-11 11h3z" />
    </svg>
  )
}

export default function DiscoverPanel() {
  const { t, locale } = useLanguage()
  const d = t.brand.discover

  const [query, setQuery] = useState('')
  // TEMP: influencers.club source picker state — remove with the TEMP blocks below
  // KOL/YouTube API search is paused for now — all keyword searches go
  // through the club API regardless of platform. Flip back to state when
  // re-enabling the KOL path.
  const [source] = useState<DiscoverySource>('club')
  // YouTube default: the browse list comes from the YouTube Data API ranked
  // by subscribers; the Instagram pill shows the cached club showcase.
  const [platforms, setPlatforms] = useState<string[]>(['youtube'])
  const [country, setCountry] = useState('')
  const [minFollowers, setMinFollowers] = useState('')
  const [maxFollowers, setMaxFollowers] = useState('')
  const [followerTierMode, setFollowerTierMode] = useState('')
  const [sort, setSort] = useState<'followers' | 'recent'>('followers')

  // Pricing v4 credit prices for the cost hints (search bar estimate, profile
  // view, full analytics). null = credit system off / not loaded.
  const [creditPrices, setCreditPrices] = useState<{
    search: number | null
    profile: number | null
    analytics: number | null
  } | null>(null)
  useEffect(() => {
    fetch('/api/pricing/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.creditSystemEnabled && data.prices) {
          const num = (v: unknown) => (typeof v === 'number' ? v : null)
          setCreditPrices({
            search: num(data.prices.discovery_search),
            profile: num(data.prices.profile_view),
            analytics: num(data.prices.analytics),
          })
        }
      })
      .catch(() => {})
  }, [])
  const searchPrice = creditPrices?.search ?? null

  // Advanced filters (keyword search via the club API only — the local
  // browse index doesn't support them)
  const [minEngagement, setMinEngagement] = useState('')
  const [maxEngagement, setMaxEngagement] = useState('')
  const [gender, setGender] = useState('')
  const [language, setLanguage] = useState('')
  const [bioKeywords, setBioKeywords] = useState('')
  const [lastPost, setLastPost] = useState('')
  const [audienceAge, setAudienceAge] = useState('')
  // Generic advanced filters keyed by query-param name (`${id}`, `${id}_min`,
  // `${id}_max`, `${id}_pct`, `${id}_months`); booleans stored as '1'.
  const [adv, setAdv] = useState<Record<string, string>>({})
  const setAdvField = (key: string, value: string) =>
    setAdv((prev) => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  // creator_has multi-select — bare tokens without the has_ prefix
  const [creatorHas, setCreatorHas] = useState<string[]>([])
  // Extended audience filters (IG only) keyed by query-param name
  const [aud, setAud] = useState<Record<string, string>>({})
  const setAudField = (key: string, value: string) =>
    setAud((prev) => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  const [sortBy, setSortBy] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [creatorDbFilters, setCreatorDbFilters] = useState<CreatorDbFilterInput[]>([])
  // Track whether current filters were set by AI parsing (vs manually by user)
  // so we know to clear them when the search box text changes.
  const aiFiltersActiveRef = useRef(false)
  const activeCreatorDbFilters = creatorDbFilters.filter((filter) => filter.value.trim() !== '')
  // Count effective filters including basic filters that will be injected
  // into cdb_filters (followers, country, engagement) when creatorDbFilters
  // are active. This mirrors the injection logic in clubSearchWith.
  const effectiveFilterCount = (() => {
    if (activeCreatorDbFilters.length === 0) return 0
    let count = activeCreatorDbFilters.length
    const hasField = (f: string) => activeCreatorDbFilters.some((x) => x.field === f)
    if (minFollowers && !hasField('followers')) count++
    if (maxFollowers && !activeCreatorDbFilters.some((x) => x.field === 'followers' && x.op === '<')) count++
    if (country.trim() && !hasField('country')) count++
    if (minEngagement && !hasField('shortEngagementRate')) count++
    return count
  })()
  const creatorDbFilterLimitExceeded = effectiveFilterCount > 20
  const creatorDbFilterExtraCost = effectiveFilterCount > 10 && effectiveFilterCount <= 20
  const [openFilterSections, setOpenFilterSections] = useState<Record<string, boolean>>({ audience: true, creator: true, performance: true })
  const toggleFilterSection = (key: string) => setOpenFilterSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const [browseList, setBrowseList] = useState<DiscoveredCreator[] | null>(null)
  // Offset into the raw (un-narrowed) creator index for pagination — may
  // exceed the number of displayed cards when platforms are filtered
  // client-side.
  const [rawOffset, setRawOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [activeSearch, setActiveSearch] = useState<DiscoverySearchRequest | null>(null)
  const [searchPage, setSearchPage] = useState(0)
  const [searchHasMore, setSearchHasMore] = useState(false)
  // Active search task (server-side). Pagination sends it so already-fetched
  // pages are re-served free of charge.
  const [searchTaskId, setSearchTaskId] = useState<string | null>(null)
  // Search-history dropdown (previous tasks; opening one is free)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTasks, setHistoryTasks] = useState<
    | { id: string; platform: string; label: string; request: any; updated_at: string; page_count: number }[]
    | null
  >(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  // Pricing v3: quota/credit exhaustion codes → show a plans/credits CTA
  const QUOTA_CODES = ['DISCOVERY_QUOTA_EXCEEDED', 'OUTREACH_QUOTA_EXCEEDED', 'INSUFFICIENT_CREDITS']
  const [searchBlocked, setSearchBlocked] = useState(false)
  const [detailBlocked, setDetailBlocked] = useState(false)
  const [contactBlocked, setContactBlocked] = useState(false)
  const PlansCta = () => (
    <a href="/pricing/brand" className="font-semibold underline whitespace-nowrap">
      {t.aiAssistant.buyCreditsCta}
    </a>
  )

  // One platform per search (club API constraint), so the pills act as
  // radio buttons.
  const togglePlatform = (p: string) => {
    setPlatforms([p])
    if (!['instagram', 'tiktok', 'youtube'].includes(p)) setCreatorDbFilters([])
    setSearchResult(null)
    setActiveSearch(null)
    setSearchPage(0)
    setSearchHasMore(false)
  }

  /* TEMP: influencers.club creator detail popup (contact info stripped
     server-side; brands contact creators inside Overseed only) */
  const [detailFor, setDetailFor] = useState<DiscoveredCreator | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Full analytics (audience demographics) — separate paid fetch
  const [analytics, setAnalytics] = useState<any | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsBlocked, setAnalyticsBlocked] = useState(false)

  const loadAnalytics = async () => {
    if (!detailFor?.handle || analyticsLoading) return
    setAnalyticsError(null)
    setAnalyticsBlocked(false)
    setAnalyticsLoading(true)
    try {
      const qs = new URLSearchParams({
        platform: detailFor.platform,
        handle: detailFor.handle,
      })
      const res = await fetch(`/api/discovery/club-analytics?${qs}`)
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setAnalyticsBlocked(QUOTA_CODES.includes(data?.code))
        throw new Error(data?.message || 'Failed to load analytics')
      }
      setAnalytics(data)
    } catch (err: any) {
      setAnalyticsError(err.message || 'Failed to load analytics')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const openDetail = async (creator: DiscoveredCreator) => {
    if (!creator.handle) return
    setDetailFor(creator)
    setDetail(null)
    setDetailError(null)
    setDetailBlocked(false)
    setAnalytics(null)
    setAnalyticsError(null)
    setAnalyticsBlocked(false)
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams({
        platform: creator.platform,
        handle: creator.handle,
      })
      const res = await fetch(`/api/discovery/club-enrich?${qs}`)
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setDetailBlocked(QUOTA_CODES.includes(data?.code))
        throw new Error(data?.message || 'Failed to load creator details')
      }
      setDetail(data)
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load creator details')
    } finally {
      setDetailLoading(false)
    }
  }

  // Contact-the-creator compose modal
  const [contactOpen, setContactOpen] = useState(false)
  const [contactMsg, setContactMsg] = useState('')
  const [contactFiles, setContactFiles] = useState<File[]>([])
  const [contactSending, setContactSending] = useState(false)
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  const openContact = () => {
    setContactMsg('')
    setContactFiles([])
    setContactSent(false)
    setContactError(null)
    setContactOpen(true)
  }

  const addContactFiles = (list: FileList | null) => {
    if (!list) return
    setContactError(null)
    const next = [...contactFiles]
    for (const f of Array.from(list)) {
      if (next.length >= 3) break
      if (f.size > 4 * 1024 * 1024) {
        setContactError(`"${f.name}" exceeds the 4MB limit`)
        continue
      }
      // Attachments are sent to the server in a single request, so the combined
      // size must also stay under the platform's ~4.5MB request-body limit.
      const total = next.reduce((sum, file) => sum + file.size, 0) + f.size
      if (total > 4 * 1024 * 1024) {
        setContactError('Attachments exceed 4MB combined — remove a file or use smaller ones')
        continue
      }
      next.push(f)
    }
    setContactFiles(next)
  }

  const sendContact = async () => {
    if (!detailFor?.handle || contactMsg.trim().length < 10) return
    setContactSending(true)
    setContactError(null)
    setContactBlocked(false)
    try {
      const fd = new FormData()
      fd.set('platform', detailFor.platform)
      fd.set('handle', detailFor.handle)
      fd.set('message', contactMsg.trim())
      contactFiles.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/discovery/club-contact', { method: 'POST', body: fd })
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setContactBlocked(QUOTA_CODES.includes(data?.code))
        throw new Error(data?.message || 'Failed to send message')
      }
      setContactSent(true)
    } catch (err: any) {
      setContactError(err.message || 'Failed to send message')
    } finally {
      setContactSending(false)
    }
  }

  const closeDetail = () => {
    setDetailFor(null)
    setDetail(null)
    setDetailError(null)
    setContactOpen(false)
  }

  // Hashtags can repeat with case/# variants — dedupe for display
  const dedupeTags = (tags: any[]) =>
    Array.from(
      new Map(
        (tags || []).map((t) => {
          const s = String(t).replace(/^#+/, '')
          return [s.toLowerCase(), s] as [string, string]
        })
      ).values()
    )

  // Growth arrives as a number or an object of period -> percent
  const formatGrowth = (g: any): string | null => {
    if (g == null) return null
    if (typeof g === 'number') return `${g > 0 ? '+' : ''}${g.toFixed(1)}%`
    if (typeof g === 'object') {
      const parts = Object.entries(g)
        .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'number' && v > 0 ? '+' : ''}${v}${typeof v === 'number' ? '%' : ''}`)
      return parts.length ? parts.join(' · ') : null
    }
    return null
  }
  /* END TEMP */

  const browseParams = useCallback(() => {
    const qs = new URLSearchParams({ sort, limit: String(PAGE_SIZE) })
    // The browse endpoint filters by a single platform; with a subset
    // selected we fetch unfiltered and narrow client-side below.
    if (platforms.length === 1) qs.set('platform', platforms[0])
    if (country.trim()) qs.set('country', country.trim().toUpperCase())
    if (minFollowers) qs.set('min_followers', minFollowers)
    if (maxFollowers) qs.set('max_followers', maxFollowers)
    return qs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, platforms, country, minFollowers, maxFollowers])

  const narrowPlatforms = useCallback(
    (creators: DiscoveredCreator[]) =>
      platforms.length === 0 || platforms.length === PLATFORMS.length
        ? creators
        : creators.filter((c) => platforms.includes(c.platform)),
    [platforms]
  )

  const fetchBrowse = useCallback(
    async (offset: number, append: boolean) => {
      append ? setIsLoadingMore(true) : setIsLoading(true)
      setError(null)
      setUnavailable(false)
      try {
        const qs = browseParams()
        qs.set('offset', String(offset))
        const res = await fetch(`/api/discovery/creators?${qs}`)
        if (res.status === 503) {
          setUnavailable(true)
          if (!append) setBrowseList(null)
          return
        }
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.message || d.searchFailed)
        const raw = data.results || []
        const page = narrowPlatforms(raw)
        setBrowseList((prev) => (append && prev ? [...prev, ...page] : page))
        setRawOffset(offset + raw.length)
        setHasMore(raw.length === PAGE_SIZE)
      } catch (err: any) {
        setError(err.message || d.searchFailed)
        if (!append) setBrowseList(null)
      } finally {
        append ? setIsLoadingMore(false) : setIsLoading(false)
      }
    },
    [browseParams, narrowPlatforms, d.searchFailed]
  )

  // Restore a previous search (results + filters) when returning to the page.
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    const saved = readSavedSearch()
    if (saved) {
      setQuery(saved.query)
      setPlatforms(saved.platforms?.length ? saved.platforms : ['youtube'])
      setCountry(saved.country || '')
      setMinFollowers(saved.minFollowers || '')
      setMaxFollowers(saved.maxFollowers || '')
      setMinEngagement(saved.minEngagement || '')
      setMaxEngagement(saved.maxEngagement || '')
      setGender(saved.gender || '')
      setLanguage(saved.language || '')
      setBioKeywords(saved.bioKeywords || '')
      setLastPost(saved.lastPost || '')
      setAudienceAge(saved.audienceAge || '')
      setAdv(saved.adv || {})
      setCreatorHas(saved.creatorHas || [])
      setAud(saved.aud || {})
      setSortBy(saved.sortBy || '')
      setSortOrder(saved.sortOrder || 'desc')
      setCreatorDbFilters(restoreCreatorDbFilters(saved.creatorDbFilters))
      setSearchResult(saved.result)
      setActiveSearch(saved.request)
      setSearchPage(saved.page)
      setSearchHasMore(saved.hasMore)
      setSearchTaskId(saved.taskId ?? null)
    }
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load search history on mount so the tasks table is visible immediately
  useEffect(() => {
    fetch('/api/discovery/tasks')
      .then((r) => r.json())
      .then((data) => setHistoryTasks(Array.isArray(data?.tasks) ? data.tasks : []))
      .catch(() => setHistoryTasks([]))
  }, [])

  // Initial load and re-browse when the sort changes (other filters apply
  // on submit to avoid refetching per keystroke). Skipped while a saved
  // search is being restored so browse doesn't race the restored results.
  useEffect(() => {
    if (!restored) return
    if (!searchResult) fetchBrowse(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, restored])

  // Filter values captured explicitly so AI-driven searches can persist the
  // right snapshot before React state has flushed.
  interface FilterVals {
    query: string
    // What the search box should show/persist when it differs from the query
    // actually sent (AI search keeps the user's original sentence visible).
    inputText?: string
    platform: string
    country: string
    minFollowers: string
    maxFollowers: string
    minEngagement: string
    maxEngagement: string
    gender: string
    language: string
    bioKeywords: string
    lastPost: string
    audienceAge: string
    adv: Record<string, string>
    creatorHas: string[]
    aud: Record<string, string>
    sortBy: string
    sortOrder: string
    creatorDbFilters: CreatorDbFilterInput[]
  }

  const currentFilterVals = (): FilterVals => ({
    query,
    platform: platforms[0],
    country,
    minFollowers,
    maxFollowers,
    minEngagement,
    maxEngagement,
    gender,
    language,
    bioKeywords,
    lastPost,
    audienceAge,
    adv,
    creatorHas,
    aud,
    sortBy,
    sortOrder,
    creatorDbFilters,
  })

  const runSearchPage = async (
    request: DiscoverySearchRequest,
    page: number,
    preserveCurrentOnEmpty = false,
    persistVals?: FilterVals,
    taskId?: string | null
  ) => {
    setIsLoading(true)
    setError(null)
    setSearchBlocked(false)
    setUnavailable(false)
    try {
      const qs = new URLSearchParams(request.params)
      if (request.endpoint === 'club-search') qs.set('page', String(page))
      // Within an existing task, already-fetched pages are served from the
      // server snapshot for free; only unseen pages are billed.
      if (request.endpoint === 'club-search' && taskId) qs.set('task_id', taskId)
      // The offset is ignored by Club, but lets Overseed's local fallback
      // return the corresponding page if the provider is unavailable.
      const nextOffset = page === searchPage + 1 && typeof searchResult?.next_offset === 'number'
        ? searchResult.next_offset
        : page * request.pageSize
      qs.set('offset', String(nextOffset))

      const res = await fetch(`/api/discovery/${request.endpoint}?${qs}`)
      window.dispatchEvent(new Event('credits:refresh'))
      if (res.status === 503) {
        setUnavailable(true)
        if (!preserveCurrentOnEmpty) setSearchResult(null)
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSearchBlocked(QUOTA_CODES.includes(data?.code))
        throw new Error(data?.message || d.searchFailed)
      }
      const results = Array.isArray(data?.results) ? data.results : []
      // A full page is the only signal the provider gives us that another
      // page may exist. If that probe is empty, keep the current page visible
      // and simply disable the Next page button.
      if (preserveCurrentOnEmpty && results.length === 0) {
        setSearchHasMore(false)
        return
      }
      setSearchResult(data)
      setActiveSearch(request)
      setSearchPage(page)
      setSearchHasMore(typeof data?.has_next_page === 'boolean' ? data.has_next_page : results.length === request.pageSize)
      const newTaskId: string | null = data?.task_id ?? taskId ?? null
      setSearchTaskId(newTaskId)

      // ── Populate filter UI from AI-parsed query ──
      // When the server used AI to convert a free-form query into structured
      // filters, reflect those filters in the UI so the user can adjust them.
      if (data?.ai_parsed && page === 0) {
        const ai = data.ai_parsed
        // Switch platform tab if AI detected a different one
        if (ai.platform && ['instagram', 'tiktok', 'youtube'].includes(ai.platform)) {
          setPlatforms([ai.platform])
        }
        // Country
        if (ai.country) setCountry(ai.country)
        // Followers
        if (ai.min_followers != null) setMinFollowers(String(ai.min_followers))
        if (ai.max_followers != null) setMaxFollowers(String(ai.max_followers))
        // Build CreatorDB filter inputs from the AI output
        const aiFilters: CreatorDbFilterInput[] = []
        if (ai.niches) {
          aiFilters.push({ field: 'niches' as CreatorDbCanonicalField, op: 'in' as CreatorDbFilterOp, value: ai.niches })
        }
        if (ai.keywords) {
          aiFilters.push({ field: 'hashtags' as CreatorDbCanonicalField, op: 'in' as CreatorDbFilterOp, value: ai.keywords })
        }
        if (ai.audience_location) {
          aiFilters.push({ field: 'audienceLocation' as CreatorDbCanonicalField, op: '=' as CreatorDbFilterOp, value: ai.audience_location })
        }
        if (ai.language) {
          aiFilters.push({ field: 'mainLanguage' as CreatorDbCanonicalField, op: '=' as CreatorDbFilterOp, value: ai.language })
        }
        if (ai.audience_age) {
          aiFilters.push({ field: 'audienceAge' as CreatorDbCanonicalField, op: 'in' as CreatorDbFilterOp, value: ai.audience_age })
        }
        if (ai.min_engagement != null) {
          aiFilters.push({ field: 'shortEngagementRate' as CreatorDbCanonicalField, op: '>' as CreatorDbFilterOp, value: String(ai.min_engagement) })
        }
        if (ai.min_avg_views != null) {
          aiFilters.push({ field: 'shortAvgViews' as CreatorDbCanonicalField, op: '>' as CreatorDbFilterOp, value: String(ai.min_avg_views) })
        }
        if (ai.last_post != null) {
          aiFilters.push({ field: 'lastPublishTime' as CreatorDbCanonicalField, op: '>' as CreatorDbFilterOp, value: String(ai.last_post) })
        }
        if (aiFilters.length > 0) {
          setCreatorDbFilters(aiFilters)
          aiFiltersActiveRef.current = true
        }
      }
      // Persist so the results survive leaving and returning to the page
      try {
        const v = persistVals ?? currentFilterVals()
        const saved: SavedSearchState = {
          query: v.inputText ?? v.query,
          platforms: [v.platform],
          country: v.country,
          minFollowers: v.minFollowers,
          maxFollowers: v.maxFollowers,
          minEngagement: v.minEngagement,
          maxEngagement: v.maxEngagement,
          gender: v.gender,
          language: v.language,
          bioKeywords: v.bioKeywords,
          lastPost: v.lastPost,
          audienceAge: v.audienceAge,
          adv: v.adv,
          creatorHas: v.creatorHas,
          aud: v.aud,
          sortBy: v.sortBy,
          sortOrder: v.sortOrder,
          creatorDbFilters: v.creatorDbFilters,
          result: data,
          request,
          page,
          hasMore: typeof data?.has_next_page === 'boolean' ? data.has_next_page : results.length === request.pageSize,
          taskId: newTaskId,
        }
        sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(saved))
      } catch {
        // Persistence is cosmetic; quota/serialization issues are ignorable
      }
    } catch (err: any) {
      setError(err.message || d.searchFailed)
      if (!preserveCurrentOnEmpty) {
        setSearchResult(null)
        setActiveSearch(null)
        setSearchPage(0)
        setSearchHasMore(false)
        setSearchTaskId(null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (creatorDbFilterLimitExceeded) return
    if (!query.trim() && activeCreatorDbFilters.length === 0) {
      setSearchResult(null)
      setActiveSearch(null)
      setSearchPage(0)
      setSearchHasMore(false)
      setSearchTaskId(null)
      try { sessionStorage.removeItem(SEARCH_STATE_KEY) } catch {}
      fetchBrowse(0, false)
      return
    }
    if (platforms.length === 0) return
    // When there's a query in the search box, clear any AI-generated filters
    // so the server re-parses the new text. User-set filters (from manually
    // editing the filter panel) are kept.
    if (query.trim() && aiFiltersActiveRef.current) {
      setCreatorDbFilters([])
      setCountry('')
      setMinFollowers('')
      setMaxFollowers('')
      aiFiltersActiveRef.current = false
      // Use a snapshot with cleared filters so the fetch doesn't include stale ones
      const vals = currentFilterVals()
      vals.creatorDbFilters = []
      vals.country = ''
      vals.minFollowers = ''
      vals.maxFollowers = ''
      await clubSearchWith(vals)
      return
    }
    await clubSearchWith(currentFilterVals())
  }

  // Club keyword search from an explicit filter snapshot (used by both the
  // regular Search button and the AI-parsed search). `persist` lets the
  // caller save a different snapshot (the user's visible filter values)
  // than the one actually searched with.
  const clubSearchWith = async (v: FilterVals, persist?: FilterVals) => {
    const populatedCreatorDbFilters = v.creatorDbFilters.filter((filter) => filter.value.trim() !== '')
    const qs = new URLSearchParams({
      platform: v.platform,
      limit: String(populatedCreatorDbFilters.length ? 100 : CLUB_PAGE_SIZE),
    })
    if (v.query.trim()) qs.set('q', v.query.trim())
    if (populatedCreatorDbFilters.length) {
      const filters = populatedCreatorDbFilters.map((filter) => {
        const field = filter.field as CreatorDbCanonicalField
        const type = CREATORDB_FIELD_MAP[field].type
        return {
          field,
          op: filter.op,
          value: filter.op === 'in'
            ? filter.value.split(',').map((value) => value.trim()).filter(Boolean)
            : type === 'number' ? Number(filter.value) : type === 'boolean' ? filter.value === 'true' : filter.value.trim(),
        }
      })
      // Inject basic filters (followers, country, engagement) directly into
      // cdb_filters so they are first-class CreatorDB filters and won't be
      // silently dropped by the 10-filter merge/trim in the backend.
      const hasField = (f: string) => filters.some((x) => x.field === f)
      if (v.minFollowers && !hasField('followers')) {
        filters.push({ field: 'followers' as CreatorDbCanonicalField, op: '>' as CreatorDbFilterOp, value: Number(v.minFollowers) })
      } else if (v.minFollowers && hasField('followers')) {
        // Don't add duplicate; user-set cdb_filter takes precedence
      }
      if (v.maxFollowers) {
        // For maxFollowers, add as a separate '<' entry (same field, different op is fine)
        const hasMaxFollowers = filters.some((x) => x.field === 'followers' && x.op === '<')
        if (!hasMaxFollowers) {
          filters.push({ field: 'followers' as CreatorDbCanonicalField, op: '<' as CreatorDbFilterOp, value: Number(v.maxFollowers) })
        }
      }
      if (v.country.trim() && !hasField('country')) {
        filters.push({ field: 'country' as CreatorDbCanonicalField, op: '=' as CreatorDbFilterOp, value: v.country.trim().toUpperCase() })
      }
      if (v.minEngagement && !hasField('shortEngagementRate')) {
        filters.push({ field: 'shortEngagementRate' as CreatorDbCanonicalField, op: '>' as CreatorDbFilterOp, value: Number(v.minEngagement) })
      }
      qs.set('cdb_filters', JSON.stringify(filters))
    }
    if (v.country.trim()) qs.set('country', v.country.trim().toUpperCase())
    if (v.minFollowers) qs.set('min_followers', v.minFollowers)
    if (v.maxFollowers) qs.set('max_followers', v.maxFollowers)
    if (v.minEngagement) qs.set('min_engagement', v.minEngagement)
    if (v.maxEngagement) qs.set('max_engagement', v.maxEngagement)
    if (v.gender) qs.set('gender', v.gender)
    if (v.language) qs.set('language', v.language)
    if (v.bioKeywords.trim()) qs.set('bio_keywords', v.bioKeywords.trim())
    if (v.lastPost) qs.set('last_post', v.lastPost)
    // Audience demographics are an Instagram-only club filter
    if (v.audienceAge && v.platform === 'instagram') qs.set('audience_age', v.audienceAge)
    // Generic advanced filters — only send params whose def applies to the
    // selected platform (server would skip them anyway; this keeps the URL
    // and the billed cache key clean).
    const applies = (paramKey: string) =>
      CLUB_FILTER_DEFS.some(
        (def) =>
          def.keys[v.platform as keyof typeof def.keys] &&
          (paramKey === def.id ||
            paramKey === `${def.id}_min` ||
            paramKey === `${def.id}_max` ||
            paramKey === `${def.id}_pct` ||
            paramKey === `${def.id}_months`)
      )
    for (const [k, val] of Object.entries(v.adv)) {
      if (val && applies(k)) qs.set(k, val)
    }
    if (v.creatorHas.length) qs.set('creator_has', v.creatorHas.join(','))
    if (v.platform === 'instagram') {
      for (const [k, val] of Object.entries(v.aud)) {
        if (val) qs.set(k, val)
      }
    }
    if (v.sortBy) {
      qs.set('sort_by', v.sortBy)
      qs.set('sort_order', v.sortOrder === 'asc' ? 'asc' : 'desc')
    }

    await runSearchPage(
      { endpoint: 'club-search', params: qs.toString(), pageSize: populatedCreatorDbFilters.length ? 100 : CLUB_PAGE_SIZE },
      0,
      false,
      persist ?? v
    )
  }

  // Voice input via the browser's Web Speech API (Chrome/Safari). The
  // transcript lands in the search box; the user then runs AI Search.
  const [speechReady, setSpeechReady] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  useEffect(() => {
    const w = window as any
    setSpeechReady(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])
  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = locale === 'zh' ? 'zh-CN' : 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e: any) => {
      let transcript = ''
      for (const r of e.results) transcript += r[0]?.transcript || ''
      if (transcript) setQuery(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  const refreshHistory = () => {
    fetch('/api/discovery/tasks')
      .then((r) => r.json())
      .then((data) => setHistoryTasks(Array.isArray(data?.tasks) ? data.tasks : []))
      .catch(() => {})
  }

  const clearSearch = () => {
    setQuery('')
    setSearchResult(null)
    setActiveSearch(null)
    setSearchPage(0)
    setSearchHasMore(false)
    setSearchTaskId(null)
    try { sessionStorage.removeItem(SEARCH_STATE_KEY) } catch {}
    refreshHistory()
    fetchBrowse(0, false)
  }

  // ---- Platform logos (inline SVGs) --------------------------------------
  const igGradId = useRef(`ig-grad-${Math.random().toString(36).slice(2, 8)}`).current
  const PlatformLogo = ({ platform, size = 20 }: { platform: string; size?: number }) => {
    switch (platform) {
      case 'instagram':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Instagram">
            <defs>
              <radialGradient id={igGradId} cx="30%" cy="107%" r="150%">
                <stop offset="0%" stopColor="#fdf497" />
                <stop offset="5%" stopColor="#fdf497" />
                <stop offset="45%" stopColor="#fd5949" />
                <stop offset="60%" stopColor="#d6249f" />
                <stop offset="90%" stopColor="#285AEB" />
              </radialGradient>
            </defs>
            <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${igGradId})`} />
            <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
            <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
          </svg>
        )
      case 'youtube':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="YouTube">
            <rect x="1" y="4" width="22" height="16" rx="4" fill="#FF0000" />
            <polygon points="10,8.5 16,12 10,15.5" fill="white" />
          </svg>
        )
      case 'tiktok':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="TikTok">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="black" />
            <path d="M16.5 7.5c-.8-.5-1.3-1.4-1.3-2.5h-2.2v10.2a2.3 2.3 0 1 1-1.6-2.2V10.7a4.5 4.5 0 1 0 3.8 4.5V10a5.3 5.3 0 0 0 3.1 1V8.8a3.3 3.3 0 0 1-1.8-.3z" fill="white" />
            <path d="M16.2 7.2c-.7-.5-1.2-1.3-1.2-2.2h-2v10a2.2 2.2 0 1 1-1.5-2.1v-2.2a4.3 4.3 0 1 0 3.7 4.4V9.7a5.1 5.1 0 0 0 3 1V8.5a3.2 3.2 0 0 1-2-1.3z" fill="#25F4EE" opacity="0.7" />
          </svg>
        )
      case 'twitter':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="X / Twitter">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="black" />
            <path d="M7 7l4.5 5.5L7 17h1.2l3.8-3.8L15 17h3l-4.8-5.8L17 7h-1.2l-3.5 3.5L9.5 7H7z" fill="white" />
          </svg>
        )
      case 'twitch':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Twitch">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="#9146FF" />
            <path d="M7 6l-1 3v8h3v2h2l2-2h3l4-4V6H7zm11 6.5l-2 2h-3l-1.5 1.5V14.5H8.5V7.5h9.5v5z" fill="white" />
            <rect x="14" y="9" width="1.5" height="3.5" rx="0.5" fill="white" />
            <rect x="11" y="9" width="1.5" height="3.5" rx="0.5" fill="white" />
          </svg>
        )
      case 'onlyfans':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="OnlyFans">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="#00AFF0" />
            <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="1.8" fill="none" />
            <circle cx="12" cy="12" r="1.5" fill="white" />
          </svg>
        )
      default:
        return <span className="text-sm font-medium text-gray-600">{platform}</span>
    }
  }

  // Relative time formatter for history table
  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return locale === 'zh' ? '刚刚' : 'just now'
    if (mins < 60) return locale === 'zh' ? `${mins} 分钟前` : `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return locale === 'zh' ? `${hours} 小时前` : `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return locale === 'zh' ? `${days} 天前` : `${days}d ago`
    const months = Math.floor(days / 30)
    return locale === 'zh' ? `${months} 个月前` : `${months}mo ago`
  }

  // Extract filter tags from a task's request object for display
  const taskFilterTags = (req: any, platform: string): string[] => {
    if (!req || typeof req !== 'object') return []
    const tags: string[] = []
    if (req.country) tags.push(req.country)
    if (req.minFollowers || req.maxFollowers) {
      const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(n)
      const min = req.minFollowers ? fmt(req.minFollowers) : '0'
      const max = req.maxFollowers ? fmt(req.maxFollowers) : '∞'
      tags.push(`${locale === 'zh' ? '粉丝 ' : ''}${min}–${max}`)
    }
    if (req.query) tags.push(req.query)
    if (req.language) tags.push(req.language)
    if (req.gender) tags.push(req.gender === 'MALE' ? (locale === 'zh' ? '男' : 'Male') : (locale === 'zh' ? '女' : 'Female'))
    return tags
  }

  // ---- Search history (tasks) --------------------------------------------
  const toggleHistory = async () => {
    const opening = !historyOpen
    setHistoryOpen(opening)
    if (!opening) return
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/discovery/tasks')
      const data = await res.json().catch(() => null)
      setHistoryTasks(res.ok && Array.isArray(data?.tasks) ? data.tasks : [])
    } catch {
      setHistoryTasks([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // Reopen a previous search task: restore its filters and show its page-0
  // snapshot. Entirely free — no vendor call, no charge. Paging within the
  // task only bills pages that were never fetched before.
  const openHistoryTask = async (id: string) => {
    setHistoryOpen(false)
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/discovery/tasks/${id}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || d.searchFailed)
      const req = data.request || {}
      const str = (v: unknown) => (v == null ? '' : String(v))
      setQuery(str(req.query))
      setPlatforms([data.platform])
      setCountry(str(req.country))
      setMinFollowers(str(req.minFollowers))
      setMaxFollowers(str(req.maxFollowers))
      setMinEngagement(str(req.minEngagement))
      setMaxEngagement(str(req.maxEngagement))
      setGender(str(req.gender))
      setLanguage(str(req.language))
      setBioKeywords(Array.isArray(req.bioKeywords) ? req.bioKeywords.join(', ') : '')
      setLastPost(str(req.lastPost))
      setAudienceAge(str(req.audienceAgeRange))
      // Stored advanced/audience filters are normalized (not UI param maps);
      // they still apply server-side via the task, so clear the UI state.
      setAdv({})
      setAud({})
      setCreatorHas(Array.isArray(req.creatorHas) ? req.creatorHas : [])
      setSortBy(str(req.sortBy))
      setSortOrder(req.sortOrder === 'asc' ? 'asc' : 'desc')
      setCreatorDbFilters(restoreCreatorDbFilters(req.creatorDbFilters))

      const presetPageSize = req.creatorDbPreset || req.creatorDbFilters ? Math.min(Number(req.limit) || 100, 100) : CLUB_PAGE_SIZE
      const request: DiscoverySearchRequest = {
        endpoint: 'club-search',
        params: new URLSearchParams({ task_id: id }).toString(),
        pageSize: presetPageSize,
      }
      const snapshot = data.data
      if (snapshot) {
        const results = Array.isArray(snapshot.results) ? snapshot.results : []
        setSearchResult(snapshot)
        setActiveSearch(request)
        setSearchPage(data.page ?? 0)
        setSearchHasMore(typeof snapshot.has_next_page === 'boolean' ? snapshot.has_next_page : results.length === presetPageSize)
        setSearchTaskId(id)
        try {
          const saved: SavedSearchState = {
            query: str(req.query),
            platforms: [data.platform],
            country: str(req.country),
            minFollowers: str(req.minFollowers),
            maxFollowers: str(req.maxFollowers),
            minEngagement: str(req.minEngagement),
            maxEngagement: str(req.maxEngagement),
            gender: str(req.gender),
            language: str(req.language),
            bioKeywords: Array.isArray(req.bioKeywords) ? req.bioKeywords.join(', ') : '',
            lastPost: str(req.lastPost),
            audienceAge: str(req.audienceAgeRange),
            adv: {},
            creatorHas: Array.isArray(req.creatorHas) ? req.creatorHas : [],
            aud: {},
            sortBy: str(req.sortBy),
            sortOrder: req.sortOrder === 'asc' ? 'asc' : 'desc',
            creatorDbFilters: restoreCreatorDbFilters(req.creatorDbFilters),
            result: snapshot,
            request,
            page: data.page ?? 0,
            hasMore: typeof snapshot.has_next_page === 'boolean' ? snapshot.has_next_page : results.length === presetPageSize,
            taskId: id,
          }
          sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(saved))
        } catch {}
      } else {
        // No snapshot for page 0 (shouldn't happen) — fetch through the
        // search route with the task id so billing dedup still applies.
        await runSearchPage(request, 0, false, undefined, id)
      }
    } catch (err: any) {
      setError(err.message || d.searchFailed)
    } finally {
      setIsLoading(false)
    }
  }

  const creators = searchResult ? searchResult.results : browseList || []
  const isBrowsing = !searchResult
  const matchedFollowerTier = FOLLOWER_TIER_OPTIONS.find(
    (tier) => tier.min === minFollowers && tier.max === maxFollowers
  )
  const followerTierValue =
    followerTierMode === 'custom'
      ? 'custom'
      : matchedFollowerTier?.value ?? (minFollowers || maxFollowers ? 'custom' : '')
  const setFollowerTier = (value: string) => {
    setFollowerTierMode(value === 'custom' ? 'custom' : '')
    if (value === 'custom') {
      setMinFollowers((current) => current || '0')
      return
    }
    const tier = FOLLOWER_TIER_OPTIONS.find((option) => option.value === value)
    if (!tier) return
    setMinFollowers(tier.min)
    setMaxFollowers(tier.max)
  }
  const showCustomFollowerRange = followerTierValue === 'custom'
  useEffect(() => {
    if (showCustomFollowerRange && !minFollowers) {
      setMinFollowers('0')
    }
  }, [showCustomFollowerRange, minFollowers])

  // ---- Advanced filter rendering --------
  const activePlatform = platforms[0] as 'instagram' | 'youtube' | 'tiktok'
  const zh = locale === 'zh'
  const inputCls = 'px-3 py-1.5 workspace-glass-control text-sm focus:outline-none'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'
  const creatorDbFilterFor = (field: CreatorDbCanonicalField): CreatorDbFilterInput => {
    const existing = creatorDbFilters.find((filter) => filter.field === field)
    if (existing) return existing
    const type = CREATORDB_FIELD_MAP[field].type
    // Fields that require the 'in' operator with array values in CreatorDB
    const arrayFields: CreatorDbCanonicalField[] = ['hashtags', 'niches', 'audienceAge']
    return {
      field,
      op: arrayFields.includes(field) ? 'in' : type === 'string' || type === 'boolean' ? '=' : '>',
      value: '',
    }
  }
  const updateCreatorDbFilter = (field: CreatorDbCanonicalField, patch: Partial<CreatorDbFilterInput>) =>
    setCreatorDbFilters((current) => {
      const index = current.findIndex((filter) => filter.field === field)
      if (index < 0) return [...current, { ...creatorDbFilterFor(field), ...patch }]
      return current.map((filter, i) => i === index ? { ...filter, ...patch } : filter)
    })

  const maintenanceMode = false // set to true to temporarily disable creator search

  return (
    <div>
      {/* Maintenance banner */}
      {maintenanceMode && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 mt-0.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
            <div>
              <h3 className="text-base font-bold text-amber-800">
                {locale === 'zh' ? '创作者搜索功能维护中' : 'Creator Search Under Maintenance'}
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                {locale === 'zh'
                  ? '我们正在升级创作者搜索引擎，以提供更好的搜索结果和更多的创作者数据。功能恢复后，我们将通过邮件通知所有用户。感谢您的耐心等待！'
                  : 'We are upgrading our creator search engine to deliver better results and richer creator data. We will notify all users via email when the feature is back. Thank you for your patience!'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Campaign-first tip */}
      {!maintenanceMode && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-primary-50 to-orange-50 border border-primary-100 px-5 py-4">
          <svg className="w-5 h-5 mt-0.5 text-primary-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.9 7.18 20l1.64-6.73-5-4.27 6.09-.74z"/></svg>
          <p className="text-sm text-gray-700">{d.campaignFirstTip}</p>
        </div>
      )}

      {/* Search + filters */}
      <form onSubmit={maintenanceMode ? (e) => e.preventDefault() : submit} className={`workspace-glass-toolbar rounded-2xl p-5 mb-6 overflow-visible relative z-10 ${maintenanceMode ? 'opacity-40 pointer-events-none select-none' : ''}`}>
        {/* Platform selector — above the search field */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition ${
                platforms.includes(p)
                  ? 'bg-white font-bold shadow-sm ring-1 ring-gray-200'
                  : 'bg-gray-100/60 font-medium hover:bg-gray-100 opacity-60'
              }`}
            >
              <PlatformLogo platform={p} size={20} />
              <span>{PLATFORM_LABELS[p]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={d.searchPlaceholder}
            rows={3}
            className="w-full px-4 py-3 workspace-glass-control workspace-glass-control-square focus:outline-none resize-none leading-6"
          />
          <div className="flex flex-wrap justify-end items-center gap-3">
          {speechReady && (
            <button
              type="button"
              onClick={toggleVoice}
              title={listening ? d.voiceListening : d.voiceInput}
              aria-label={listening ? d.voiceListening : d.voiceInput}
              className={`px-3.5 py-2.5 rounded-full transition ${
                listening
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'workspace-glass-control text-gray-600 hover:brightness-105'
              }`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                <path d="M12 18v4M8 22h8" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || platforms.length === 0 || creatorDbFilterLimitExceeded}
            title={d.aiSearchHint}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2"><Spinner /> {d.searching}</span>
            ) : (
              d.searchButton
            )}
          </button>
          {/* Info icon — hover to see search task billing note */}
          <div className="relative group">
            <button type="button" className="w-8 h-8 rounded-full workspace-glass-control text-gray-400 hover:text-gray-600 flex items-center justify-center transition" aria-label="Info">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 absolute right-0 top-full mt-2 w-80 p-4 rounded-2xl shadow-xl ring-1 ring-gray-200 z-[200] text-sm text-gray-600 leading-relaxed" style={{ backgroundColor: '#ffffff' }}>
              {d.searchTaskNote}
            </div>
          </div>
          {searchResult && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-4 py-2.5 bg-white/50 text-gray-700 rounded-full font-semibold hover:bg-white/70 transition"
            >
              {d.clearSearch}
            </button>
          )}
          </div>
        </div>

        {/* Live credit-cost estimate: updates as the user types/filters */}
        {searchPrice != null && (
          <p className="mt-2 text-xs text-gray-400">
            {query.trim() || activeCreatorDbFilters.length > 0
              ? d.searchCostEstimate.replace('{n}', String(searchPrice))
              : d.browseFreeNote.replace('{n}', String(searchPrice))}
          </p>
        )}

        {/* ── Structured filter sections ── */}
        <div className="mt-4">
          {/* Filter header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
              <span className="text-sm font-semibold text-gray-800">{zh ? '筛选条件' : 'Filters'}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCountry(''); setFollowerTier(''); setMinFollowers(''); setMaxFollowers('')
                setCreatorDbFilters([]); setAudienceAge('')
              }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              {zh ? '重置全部' : 'Reset all'}
            </button>
          </div>

          {/* Section 1 — Audience */}
          <div className="rounded-xl bg-gradient-to-r from-green-50/40 to-transparent border border-gray-100 mb-2">
            <button type="button" onClick={() => toggleFilterSection('audience')} className="w-full flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center">1</span>
                <div className="text-left">
                  <span className="text-xs font-semibold text-gray-800">{zh ? '受众' : 'Audience'}</span>
                  <span className="ml-2 text-[10px] text-gray-400">{zh ? '你想触达谁？' : 'Who do you want to reach?'}</span>
                </div>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openFilterSections.audience ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openFilterSections.audience && (
              <div className="px-3 pb-3 grid grid-cols-4 gap-3">
                {/* Audience location */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      {zh ? '受众所在地' : 'Audience location'}
                    </span>
                  </label>
                  {['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? (
                    <select
                      value={creatorDbFilterFor('audienceLocation').value}
                      onChange={(e) => updateCreatorDbFilter('audienceLocation', { value: e.target.value })}
                      className={`w-full ${inputCls}`}
                    >
                      <option value="">{zh ? '全部地区' : 'Anywhere'}</option>
                      {COUNTRY_FILTER_OPTIONS.map(({ code, key }) => (
                        <option key={code} value={code}>{(t.signupBusiness.countries as Record<string, string>)[key] || code}</option>
                      ))}
                    </select>
                  ) : (
                    <select value={country} onChange={(e) => setCountry(e.target.value)} className={`w-full ${inputCls}`}>
                      <option value="">{d.allCountries}</option>
                      {COUNTRY_FILTER_OPTIONS.map(({ code, key }) => (
                        <option key={code} value={code}>{(t.signupBusiness.countries as Record<string, string>)[key] || code}</option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Language */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M12 22l5-10 5 10"/><path d="M14 18h6"/></svg>
                      {zh ? '语言' : 'Language'}
                    </span>
                  </label>
                  {['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? (
                    <select
                      value={creatorDbFilterFor('mainLanguage').value}
                      onChange={(e) => updateCreatorDbFilter('mainLanguage', { value: e.target.value })}
                      className={`w-full ${inputCls}`}
                    >
                      <option value="">{zh ? '全部语言' : 'All languages'}</option>
                      {CREATORDB_LANGUAGE_OPTIONS.map(([value, langLabel]) => (
                        <option key={value} value={value}>{langLabel}</option>
                      ))}
                    </select>
                  ) : (
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`w-full ${inputCls}`}>
                      <option value="">{d.allLanguages}</option>
                      {LANGUAGE_FILTER_OPTIONS.map(({ code, label: langLabel }) => (
                        <option key={code} value={code}>{langLabel}</option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Audience age */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {zh ? '受众年龄' : 'Audience age'}
                    </span>
                  </label>
                  <select
                    value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('audienceAge').value : audienceAge}
                    onChange={(e) => {
                      if (['instagram', 'tiktok', 'youtube'].includes(activePlatform)) {
                        updateCreatorDbFilter('audienceAge', { value: e.target.value })
                      } else {
                        setAudienceAge(e.target.value)
                      }
                    }}
                    className={`w-full ${inputCls}`}
                  >
                    <option value="">{d.anyOption}</option>
                    {['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((age) => <option key={age} value={age}>{age}</option>)}
                  </select>
                </div>
                {/* Gender composition */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
                      {zh ? '性别构成' : 'Gender'}
                    </span>
                  </label>
                  {['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? (() => {
                    const femaleVal = creatorDbFilterFor('audienceFemaleRatio').value
                    const femalePct = femaleVal ? Math.round(Number(femaleVal) * 100) : 50
                    const isActive = femaleVal !== ''
                    return (
                      <div className="space-y-1">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={femalePct}
                          onChange={(e) => {
                            const pct = Number(e.target.value)
                            updateCreatorDbFilter('audienceFemaleRatio', { op: '>', value: String(pct / 100) })
                            // Clear the old audienceGender filter if it was set
                            updateCreatorDbFilter('audienceGender', { value: '' })
                          }}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-pink-500"
                          style={{
                            background: isActive
                              ? `linear-gradient(to right, #ec4899 0%, #ec4899 ${femalePct}%, #3b82f6 ${femalePct}%, #3b82f6 100%)`
                              : '#e5e7eb',
                          }}
                        />
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span style={{ color: isActive ? '#ec4899' : undefined }}>
                            {zh ? '女' : 'F'} {isActive ? `${femalePct}%+` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              updateCreatorDbFilter('audienceFemaleRatio', { value: '' })
                              updateCreatorDbFilter('audienceGender', { value: '' })
                            }}
                            className="text-[10px] text-gray-400 hover:text-gray-600"
                          >
                            {isActive ? (zh ? '重置' : 'Reset') : (zh ? '任意' : 'Any')}
                          </button>
                          <span style={{ color: isActive ? '#3b82f6' : undefined }}>
                            {isActive ? `${100 - femalePct}%+` : ''} {zh ? '男' : 'M'}
                          </span>
                        </div>
                      </div>
                    )
                  })() : (
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className={`w-full ${inputCls}`}
                    >
                      <option value="">{d.anyOption}</option>
                      <option value="female">{d.genderFemale}</option>
                      <option value="male">{d.genderMale}</option>
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 2 — Creator */}
          <div className="rounded-xl bg-gradient-to-r from-blue-50/40 to-transparent border border-gray-100 mb-2">
            <button type="button" onClick={() => toggleFilterSection('creator')} className="w-full flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">2</span>
                <div className="text-left">
                  <span className="text-xs font-semibold text-gray-800">{zh ? '创作者' : 'Creator'}</span>
                  <span className="ml-2 text-[10px] text-gray-400">{zh ? '寻找合适的创作者类型' : 'Find the right type of creators'}</span>
                </div>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openFilterSections.creator ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openFilterSections.creator && (
              <div className="px-3 pb-3 grid grid-cols-4 gap-3">
                {/* Creator's country */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {zh ? '创作者所在国' : "Creator's country"}
                    </span>
                  </label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={`w-full ${inputCls}`}>
                    <option value="">{zh ? '全部国家' : 'Any country'}</option>
                    {COUNTRY_FILTER_OPTIONS.map(({ code, key }) => (
                      <option key={code} value={code}>{(t.signupBusiness.countries as Record<string, string>)[key] || code}</option>
                    ))}
                  </select>
                </div>
                {/* Verified account */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      {zh ? '认证账号' : 'Verified account'}
                    </span>
                  </label>
                  <select
                    value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('isAccountVerified').value : ''}
                    onChange={(e) => updateCreatorDbFilter('isAccountVerified', { value: e.target.value })}
                    className={`w-full ${inputCls}`}
                  >
                    <option value="">{d.anyOption}</option>
                    <option value="true">{zh ? '是' : 'Yes'}</option>
                    <option value="false">{zh ? '否' : 'No'}</option>
                  </select>
                </div>
                {/* Hashtags */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-400">#</span>
                      {zh ? '标签（可选）' : 'Hashtags (optional)'}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('hashtags').value : ''}
                    onChange={(e) => updateCreatorDbFilter('hashtags', { value: e.target.value })}
                    placeholder={zh ? '如 #护肤, #旅行' : 'e.g. #skincare, #travel'}
                    className={`w-full ${inputCls}`}
                  />
                </div>
                {/* Niches */}
                <NicheAutocomplete
                  platform={activePlatform}
                  value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('niches').value : ''}
                  onChange={(v) => updateCreatorDbFilter('niches', { value: v })}
                  labelCls={labelCls}
                  inputCls={inputCls}
                  zh={zh}
                />
                {/* Followers / subscribers */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {zh ? '粉丝数' : 'Followers / subscribers'}
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={minFollowers}
                      onChange={(e) => { setMinFollowers(e.target.value); setFollowerTier('custom') }}
                      className={`w-1/2 ${inputCls}`}
                    >
                      <option value="">Min</option>
                      {[1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000].map((n) => (
                        <option key={n} value={String(n)}>{n.toLocaleString()}</option>
                      ))}
                    </select>
                    <span className="text-gray-400 font-medium text-sm">–</span>
                    <select
                      value={maxFollowers}
                      onChange={(e) => { setMaxFollowers(e.target.value); setFollowerTier('custom') }}
                      className={`w-1/2 ${inputCls}`}
                    >
                      <option value="">Max</option>
                      {[5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000, 10000000].map((n) => (
                        <option key={n} value={String(n)}>{n.toLocaleString()}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Last active */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {zh ? '最近活跃' : 'Last active'}
                    </span>
                  </label>
                  <select
                    value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('lastPublishTime').value : lastPost}
                    onChange={(e) => {
                      if (['instagram', 'tiktok', 'youtube'].includes(activePlatform)) {
                        const v = e.target.value
                        if (v === '-365') {
                          updateCreatorDbFilter('lastPublishTime', { op: '<', value: v })
                        } else {
                          updateCreatorDbFilter('lastPublishTime', { op: '>', value: v })
                        }
                      } else {
                        setLastPost(e.target.value)
                      }
                    }}
                    className={`w-full ${inputCls}`}
                  >
                    <option value="">{d.anyOption}</option>
                    <option value="90">{zh ? '近3个月活跃' : 'Within 3 months'}</option>
                    <option value="180">{zh ? '近6个月活跃' : 'Within 6 months'}</option>
                    <option value="365">{zh ? '近1年活跃' : 'Within 1 year'}</option>
                    <option value="-365">{zh ? '超过1年未活跃' : 'Over 1 year ago'}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section 3 — Performance */}
          <div className="rounded-xl bg-gradient-to-r from-purple-50/40 to-transparent border border-gray-100 mb-2">
            <button type="button" onClick={() => toggleFilterSection('performance')} className="w-full flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center">3</span>
                <div className="text-left">
                  <span className="text-xs font-semibold text-gray-800">{zh ? '数据表现' : 'Performance'}</span>
                  <span className="ml-2 text-[10px] text-gray-400">{zh ? '关注真实影响力的创作者' : 'Focus on creators with real impact'}</span>
                </div>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openFilterSections.performance ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openFilterSections.performance && (
              <div className="px-3 pb-3 grid grid-cols-4 gap-3">
                {/* Average short views */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      {zh ? '平均短视频播放量' : 'Average short views'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('shortAvgViews').value : ''}
                      onChange={(e) => updateCreatorDbFilter('shortAvgViews', { op: '>', value: e.target.value })}
                      placeholder={zh ? '如 5000 次播放' : 'e.g. 5000 views'}
                      className={`w-full ${inputCls}`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{zh ? '≥ 次播放' : '≥ views'}</span>
                  </div>
                </div>
                {/* Average engagement rate */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                      {zh ? '平均互动率' : 'Average engagement rate'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('shortEngagementRate').value : ''}
                      onChange={(e) => updateCreatorDbFilter('shortEngagementRate', { op: '>', value: e.target.value })}
                      placeholder={zh ? '如 2.5%' : 'e.g. 2.5%'}
                      className={`w-full ${inputCls}`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">≥ %</span>
                  </div>
                </div>
                {/* Followers growth (30d) */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      {zh ? '粉丝增长 (30天)' : 'Followers growth (30d)'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('followerGrowth30d').value : ''}
                      onChange={(e) => updateCreatorDbFilter('followerGrowth30d', { op: '>', value: e.target.value })}
                      placeholder={zh ? '如 500 新增粉丝' : 'e.g. 500 new followers'}
                      className={`w-full ${inputCls}`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{zh ? '≥ 新粉丝' : '≥ new'}</span>
                  </div>
                </div>
                {/* Content count (30d) */}
                <div>
                  <label className={labelCls}>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                      {zh ? '近30天发布数' : 'Posts in last 30d'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={['instagram', 'tiktok', 'youtube'].includes(activePlatform) ? creatorDbFilterFor('contentsIn30Days').value : ''}
                      onChange={(e) => updateCreatorDbFilter('contentsIn30Days', { op: '>', value: e.target.value })}
                      placeholder={zh ? '如 5 条内容' : 'e.g. 5 posts'}
                      className={`w-full ${inputCls}`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{zh ? '≥ 条' : '≥ posts'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sort (when browsing) */}
          {isBrowsing && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">{d.sortLabel}</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'followers' | 'recent')}
                className={inputCls}
              >
                <option value="followers">{d.sortFollowers}</option>
                <option value="recent">{d.sortRecent}</option>
              </select>
            </div>
          )}

          {creatorDbFilterExtraCost && (
            <p className="mt-2 text-xs font-medium text-amber-600">
              {zh
                ? `使用了 ${effectiveFilterCount} 个筛选条件（超过 10 个），本次搜索将消耗 2 倍积分。`
                : `Using ${effectiveFilterCount} filters (over 10) — this search costs 2× credits.`}
            </p>
          )}
          {creatorDbFilterLimitExceeded && (
            <p className="mt-2 text-xs font-semibold text-red-600">
              {zh
                ? '筛选条件已超过 20 个。请清空至少一个条件后再提交。'
                : 'Filter limit exceeded (20 max). Clear at least one before submitting.'}
            </p>
          )}
        </div>
      </form>

      {/* States */}
      {unavailable && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-medium">{d.serviceUnavailable}</p>
          <p className="text-yellow-700 text-sm mt-1">{d.serviceUnavailableHint}</p>
        </div>
      )}
      {error && !unavailable && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
          {searchBlocked && <> <PlansCta /></>}
        </div>
      )}

      {/* Search-only notices */}
      {searchResult &&
        (searchResult.warnings.length > 0 ||
          Object.values(searchResult.platform_coverage).some((v) => !COVERAGE_OK.has(v))) && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            {Object.entries(searchResult.platform_coverage)
              .filter(([, status]) => !COVERAGE_OK.has(status))
              .map(([platform, status]) => (
                <p key={platform}>
                  <span className="font-medium">{PLATFORM_LABELS[platform] || platform}:</span>{' '}
                  {status === 'unavailable_phase1'
                    ? 'live search for this platform is coming soon'
                    : status}
                </p>
              ))}
            {searchResult.warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}

      {/* Search history table — shown when no search results are active */}
      {!unavailable && !searchResult && !isLoading && (
        <div className="workspace-glass-card rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">{d.mySearchTasks}</h2>
          <p className="text-sm text-gray-400 mb-4">{d.mySearchTasksHint}</p>
          {!historyTasks ? (
            <div className="py-8 flex justify-center text-gray-400"><Spinner /></div>
          ) : historyTasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{d.historyEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2 pr-4 font-medium">{d.taskName}</th>
                    <th className="pb-2 pr-4 font-medium">{d.taskPlatform}</th>
                    <th className="pb-2 pr-4 font-medium">{d.taskFilters}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{d.taskCreatorsViewed}</th>
                    <th className="pb-2 font-medium text-right">{d.taskLastViewed}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyTasks.map((task) => {
                    const tags = taskFilterTags(task.request, task.platform)
                    const visibleTags = tags.slice(0, 3)
                    const extraCount = tags.length - visibleTags.length
                    return (
                      <tr
                        key={task.id}
                        onClick={() => openHistoryTask(task.id)}
                        className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition"
                      >
                        <td className="py-3 pr-4">
                          <span className="font-medium text-gray-800">{task.label}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <PlatformLogo platform={task.platform} size={18} />
                            <span className="text-gray-600 capitalize">{PLATFORM_LABELS[task.platform] || task.platform}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {visibleTags.map((tag, i) => (
                              <span key={i} className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">{tag}</span>
                            ))}
                            {extraCount > 0 && (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-400">
                                {d.taskMoreFilters.replace('{n}', String(extraCount))}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-gray-700">
                          {task.page_count * 10}
                        </td>
                        <td className="py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                          {relativeTime(task.updated_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!unavailable && (searchResult || isLoading) && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              {isLoading ? d.loadingCreators : `${creators.length}${isBrowsing && hasMore ? '+' : ''} ${d.resultsCount}`}
            </h2>
            {searchResult && searchResult.credits_left == null && (
              <p className="text-xs text-gray-400">
                {`${d.cacheHits}: ${searchResult.cache_hits} · ${d.liveCalls}: ${searchResult.live_calls}`}
              </p>
            )}
          </div>

          {isLoading && creators.length === 0 ? (
            /* Skeleton cards while the first page loads */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="workspace-glass-card rounded-2xl p-5 flex gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-gray-200/70 flex-shrink-0" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-4 bg-gray-200/70 rounded w-1/3" />
                    <div className="h-3 bg-gray-200/60 rounded w-1/2" />
                    <div className="h-3 bg-gray-200/50 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading && creators.length === 0 ? (
            <div className="workspace-glass-card rounded-2xl p-8 text-center text-gray-500">{d.noResults}</div>
          ) : (
            <div className="relative">
            {/* Floating indicator while refreshing on top of existing results */}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-start justify-center pt-16 pointer-events-none">
                <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/85 shadow-lg backdrop-blur-sm text-sm font-semibold text-gray-700">
                  <Spinner className="w-4 h-4 text-primary-600" /> {d.loadingCreators}
                </span>
              </div>
            )}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity ${
                isLoading ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              {creators.map((creator, creatorIndex) => (
                <div
                  key={`${searchTaskId ?? activeSearch?.params ?? 'browse'}:${searchPage}:${creator.id}:${creatorIndex}`}
                  onClick={
                    creator.id.startsWith('club:') ? () => openDetail(creator) : undefined
                  }
                  className={`workspace-glass-card rounded-2xl p-5 flex flex-col items-center text-center ${
                    creator.id.startsWith('club:')
                      ? 'cursor-pointer hover:shadow-md transition'
                      : ''
                  }`}
                >
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 w-full mb-3">
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 ring-2 ring-white">
                      <CreatorAvatar
                        url={creator.avatar_url}
                        name={creator.display_name || creator.handle || '?'}
                        textSize="text-xl"
                      />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-bold text-[15px] text-gray-900 truncate">
                        {creator.display_name || creator.handle || creator.id}
                      </p>
                      {creator.handle && (
                        <p className="text-xs text-gray-400 truncate">
                          @{creator.handle.replace(/^@/, '')}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-medium">
                          {PLATFORM_LABELS[creator.platform] || creator.platform}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-center gap-6 w-full py-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{formatFollowers(creator.follower_count, locale)}</p>
                        <p className="text-[10px] text-gray-400">{d.followers}</p>
                      </div>
                    </div>
                    {creator.engagement_rate != null && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{Number(creator.engagement_rate).toFixed(1)}%</p>
                          <p className="text-[10px] text-gray-400">{d.engagement}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full mt-3">
                    {creator.id.startsWith('club:') ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDetail(creator) }}
                        className="flex-1 px-3 py-2 workspace-glass-control rounded-xl text-sm font-medium text-gray-700 hover:brightness-105 transition text-center"
                      >
                        {d.viewDetails}
                        {creditPrices?.profile != null && (
                          <span className="text-[10px] text-gray-400 font-normal ml-1">
                            {d.creditsN.replace('{n}', String(creditPrices.profile))}
                          </span>
                        )}
                      </button>
                    ) : creator.profile_url ? (
                      <a
                        href={creator.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-2 workspace-glass-control rounded-xl text-sm font-medium text-gray-700 hover:brightness-105 transition text-center"
                      >
                        {d.viewDetails}
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 workspace-glass-control rounded-xl text-gray-400 hover:text-primary-600 transition flex-shrink-0"
                      title="Save"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}

          {isBrowsing && hasMore && !isLoading && creators.length > 0 && (
            <div className="mt-6 text-center">
              <button
                onClick={() => fetchBrowse(rawOffset, true)}
                disabled={isLoadingMore}
                className="px-6 py-2.5 bg-white/55 text-gray-700 rounded-full font-semibold hover:bg-white/75 transition disabled:opacity-50"
              >
                {isLoadingMore ? d.loadingCreators : d.loadMore}
              </button>
            </div>
          )}

          {searchResult && creators.length > 0 && (searchPage > 0 || searchHasMore) && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => activeSearch && runSearchPage(activeSearch, searchPage - 1, true, undefined, searchTaskId)}
                disabled={!activeSearch || searchPage === 0 || isLoading}
                className="px-5 py-2.5 bg-white/55 text-gray-700 rounded-full font-semibold hover:bg-white/75 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← {d.previousPage}
              </button>
              <span className="min-w-20 text-center text-sm font-medium text-gray-500">
                {d.pageLabel} {searchPage + 1}
              </span>
              <button
                type="button"
                onClick={() => activeSearch && runSearchPage(activeSearch, searchPage + 1, true, undefined, searchTaskId)}
                disabled={!activeSearch || !searchHasMore || isLoading}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {d.nextPage} →
              </button>
            </div>
          )}

          {/* Hidden for now — re-enable if the vendor attribution is needed
          <p className="mt-8 text-center text-xs text-gray-400">
            {d.dataAttribution}
          </p>
          */}
        </>
      )}

      {/* TEMP: influencers.club creator detail popup — remove with the other
          TEMP blocks, lib/influencers-club.ts, api/discovery/club-enrich and
          api/discovery/club-contact */}
      {detailFor && (
        <div
          data-solid
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header band */}
            <div className="relative h-24 bg-gradient-to-r from-primary-600 via-rose-500 to-orange-400 flex-shrink-0">
              <button
                onClick={closeDetail}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white text-lg leading-none transition"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="px-7 flex items-start gap-4 flex-shrink-0">
              <div className="relative z-10 w-20 h-20 -mt-10 rounded-full ring-4 ring-white bg-gray-200 overflow-hidden shadow-md flex-shrink-0">
                <CreatorAvatar
                  // Prefer the fresh search-result picture: enrich-cache
                  // avatar URLs are often expired club links (~24h lifetime).
                  key={detailFor.id}
                  url={detailFor.avatar_url || detail?.avatar_url || null}
                  name={detailFor.display_name || detailFor.handle || '?'}
                  textSize="text-2xl"
                />
              </div>
              <div className="flex-1 min-w-0 pt-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 truncate">
                    {detail?.name || detailFor.display_name || detailFor.handle}
                  </h3>
                  <span className="px-2 py-0.5 bg-gray-900 text-white rounded-full text-[11px] font-medium flex-shrink-0">
                    {PLATFORM_LABELS[detailFor.platform] || detailFor.platform}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  @{detailFor.handle?.replace(/^@+/, '')}
                  {detail && (detail.location || detail.language) && (
                    <span className="text-gray-400">
                      {' '}· {[detail.location, detail.language].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-7 py-5 flex-1">
              {detailLoading && (
                <p className="py-10 text-center text-sm text-gray-500">
                  Loading creator details…
                </p>
              )}
              {detailError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {detailError}
                  {detailBlocked && <> <PlansCta /></>}
                </div>
              )}

              {detail && (
                <>
                  {/* Key stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Total followers',
                        value: formatFollowers(detail.total_followers, locale),
                        caption: 'all platforms',
                      },
                      {
                        label: 'Engagement',
                        value:
                          detail.engagement_percent != null
                            ? `${Number(detail.engagement_percent).toFixed(1)}%`
                            : '—',
                      },
                      {
                        label: 'Growth',
                        value: formatGrowth(detail.follower_growth) || '—',
                      },
                      {
                        label: 'Posts / mo',
                        value:
                          detail.posting_frequency_recent_months != null
                            ? Number(detail.posting_frequency_recent_months).toFixed(1)
                            : '—',
                      },
                    ].map((s) => (
                      <div key={s.label} className="border border-gray-100 bg-gray-50/60 rounded-xl px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">
                          {s.label}
                        </p>
                        <p className="text-base font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
                        {s.caption && <p className="text-[10px] text-gray-400">{s.caption}</p>}
                      </div>
                    ))}
                  </div>

                  {/* About */}
                  {detail.bio && (
                    <div className="mt-6">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">
                        About
                      </p>
                      <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed line-clamp-6">
                        {detail.bio}
                      </p>
                    </div>
                  )}

                  {/* Categories */}
                  {detail.niche?.length > 0 && (
                    <div className="mt-6">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                        Categories
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {dedupeTags(detail.niche).map((n) => (
                          <span
                            key={n}
                            className="px-2.5 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium capitalize"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Platform presence */}
                  {detail.accounts?.length > 0 && (
                    <div className="mt-6">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                        Platform presence
                      </p>
                      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                        {detail.accounts.map((a: any) => (
                          <div
                            key={a.platform}
                            className="flex items-center justify-between px-4 py-2.5 bg-white"
                          >
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-700 capitalize">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  { instagram: 'bg-pink-500', youtube: 'bg-red-500', tiktok: 'bg-gray-900', twitter: 'bg-sky-400', twitch: 'bg-purple-500' }[
                                    a.platform as string
                                  ] || 'bg-gray-300'
                                }`}
                              />
                              {a.platform}
                            </span>
                            <span className="text-sm text-gray-600 tabular-nums">
                              {formatFollowers(a.followers, locale)}
                              {a.engagement_percent != null && (
                                <span className="text-gray-400">
                                  {' '}· {Number(a.engagement_percent).toFixed(1)}%
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full audience analytics (separate paid fetch) */}
                  <div className="mt-6">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                      Audience analytics
                    </p>
                    {!analytics && (
                      <>
                        <button
                          onClick={loadAnalytics}
                          disabled={analyticsLoading}
                          className="w-full px-4 py-2.5 border border-primary-200 bg-primary-50 text-primary-700 rounded-xl text-sm font-semibold hover:bg-primary-100 transition disabled:opacity-50"
                        >
                          {analyticsLoading
                            ? 'Loading analytics…'
                            : `View full analytics${
                                creditPrices?.analytics != null
                                  ? ` · ${d.creditsN.replace('{n}', String(creditPrices.analytics))}`
                                  : ''
                              }`}
                        </button>
                        {creditPrices?.analytics != null && (
                          <p className="mt-1.5 text-[11px] text-gray-400 text-center">
                            {d.chargedOncePerCreator}
                          </p>
                        )}
                        {analyticsError && (
                          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                            {analyticsError}
                            {analyticsBlocked && <> <PlansCta /></>}
                          </div>
                        )}
                      </>
                    )}
                    {analytics && (
                      <div className="space-y-4">
                        {/* Averages */}
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Avg views', value: analytics.avg_views },
                            { label: 'Avg likes', value: analytics.avg_likes },
                            { label: 'Avg comments', value: analytics.avg_comments },
                          ]
                            .filter((s) => s.value != null)
                            .map((s) => (
                              <div key={s.label} className="border border-gray-100 bg-gray-50/60 rounded-xl px-3 py-2.5">
                                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{s.label}</p>
                                <p className="text-base font-bold text-gray-900 mt-0.5">
                                  {formatFollowers(Math.round(Number(s.value)), locale)}
                                </p>
                              </div>
                            ))}
                        </div>
                        {analytics.audience ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                              {
                                title: 'Gender',
                                rows: (analytics.audience.genders || []).map((g: any) => ({
                                  label: g.code === 'MALE' ? 'Male' : g.code === 'FEMALE' ? 'Female' : g.code,
                                  weight: g.weight,
                                })),
                              },
                              {
                                title: 'Age',
                                rows: (analytics.audience.ages || []).map((a: any) => ({
                                  label: a.code,
                                  weight: a.weight,
                                })),
                              },
                              {
                                title: 'Top countries',
                                rows: (analytics.audience.countries || []).map((c: any) => ({
                                  label: c.name || c.code,
                                  weight: c.weight,
                                })),
                              },
                              {
                                title: 'Languages',
                                rows: (analytics.audience.languages || []).map((l: any) => ({
                                  label: l.name || l.code,
                                  weight: l.weight,
                                })),
                              },
                            ]
                              .filter((sec) => sec.rows.length > 0)
                              .map((sec) => (
                                <div key={sec.title} className="border border-gray-100 rounded-xl p-3">
                                  <p className="text-xs font-semibold text-gray-500 mb-2">{sec.title}</p>
                                  <div className="space-y-1.5">
                                    {sec.rows.map((row: any) => (
                                      <div key={row.label} className="flex items-center gap-2 text-xs">
                                        <span className="w-20 truncate text-gray-600">{row.label}</span>
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-to-r from-primary-500 to-rose-400"
                                            style={{ width: `${Math.min(100, Math.round((row.weight || 0) * 100))}%` }}
                                          />
                                        </div>
                                        <span className="w-10 text-right tabular-nums text-gray-500">
                                          {((row.weight || 0) * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">
                            Audience demographics are not available for this creator.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer actions */}
            {detail && (
              <div className="px-7 py-4 border-t border-gray-100 flex-shrink-0">
                {!detail.contactable && (
                  <p className="mb-2 text-xs text-gray-400 text-center">
                    No verified contact channel for this creator yet — reach out via their profile instead.
                  </p>
                )}
                <div className="flex items-center gap-3">
                <button
                  onClick={openContact}
                  disabled={!detail.contactable}
                  title={detail.contactable ? undefined : 'This creator cannot be reached yet'}
                  className="flex-1 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-rose-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Contact the creator
                </button>
                {detailFor.profile_url && (
                  <a
                    href={detailFor.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
                  >
                    {d.openOnPlatform.replace('{platform}', PLATFORM_LABELS[detailFor.platform] || detailFor.platform)} ↗
                  </a>
                )}
                </div>
                {detail.contactable && creditPrices?.profile != null && (
                  <p className="mt-2 text-[11px] text-gray-400 text-center">{d.outreachIncluded}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TEMP: contact-the-creator compose modal */}
      {contactOpen && detailFor && (
        <div
          data-solid
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
          onClick={() => !contactSending && setContactOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-7"
            onClick={(e) => e.stopPropagation()}
          >
            {contactSent ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl">
                  ✓
                </div>
                <h3 className="text-lg font-bold text-gray-900 mt-4">Message sent</h3>
                <p className="text-sm text-gray-500 mt-1.5">
                  Your message is on its way to{' '}
                  {detail?.name || detailFor.display_name || detailFor.handle}. Replies will
                  arrive at your account email.
                </p>
                <button
                  onClick={() => setContactOpen(false)}
                  className="mt-6 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900">
                  Contact {detail?.name || detailFor.display_name || detailFor.handle}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Delivered by Overseed — the creator can reply directly to your message.
                </p>

                <textarea
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder={d.contactMsgPlaceholder}
                  className="mt-4 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                <p className="text-right text-[11px] text-gray-400 mt-1">
                  {contactMsg.length}/2000
                </p>

                {/* Attachments */}
                <div className="mt-2">
                  {contactFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {contactFiles.map((f, i) => (
                        <span
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-2 pl-1.5 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600"
                        >
                          {f.type.startsWith('image/') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={URL.createObjectURL(f)}
                              alt=""
                              className="w-6 h-6 rounded object-cover"
                            />
                          ) : (
                            <span className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                              PDF
                            </span>
                          )}
                          <span className="max-w-[140px] truncate">{f.name}</span>
                          <button
                            onClick={() =>
                              setContactFiles(contactFiles.filter((_, j) => j !== i))
                            }
                            className="text-gray-400 hover:text-gray-600"
                            aria-label="Remove attachment"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <label className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 cursor-pointer">
                    <span className="text-base leading-none">＋</span> Add photos or files
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        addContactFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <span className="ml-2 text-[11px] text-gray-400">
                    Images or PDF · up to 3 files · 4MB combined
                  </span>
                </div>

                {contactError && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {contactError}
                    {contactBlocked && <> <PlansCta /></>}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 mt-5">
                  <button
                    onClick={() => setContactOpen(false)}
                    disabled={contactSending}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendContact}
                    disabled={contactSending || contactMsg.trim().length < 10}
                    className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-rose-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {contactSending ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* END TEMP */}
    </div>
  )
}
