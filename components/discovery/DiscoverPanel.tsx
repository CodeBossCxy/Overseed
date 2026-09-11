'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface DiscoveredCreator {
  id: string
  platform: string
  handle: string | null
  display_name: string | null
  bio: string | null
  country: string | null
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

const PLATFORMS = ['youtube', 'instagram', 'tiktok'] as const
const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
}
const PAGE_SIZE = 50

// Country filter options — ISO codes sent to the discovery APIs, labels from
// the shared t.signupBusiness.countries map.
const COUNTRY_FILTER_OPTIONS: { code: string; key: string }[] = [
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
const LANGUAGE_FILTER_OPTIONS: { code: string; label: string }[] = [
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
const AUDIENCE_AGE_OPTIONS = ['13-17', '18-24', '25-34', '35-44', '45-64', '65-'] as const

// Coverage statuses that are normal operation, not warnings worth a banner.
const COVERAGE_OK = new Set(['ok', 'cache', 'live'])

// Avatar with referrerPolicy (Google's image CDN rejects some localhost/hotlink
// referrers) and a fallback to the creator's initial if the URL has rotted.
function CreatorAvatar({ url, name, textSize = '' }: { url: string | null; name: string; textSize?: string }) {
  const [failed, setFailed] = useState(false)
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
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(count)
}

// Creator discovery UI shared by the standalone database page and the
// per-campaign "Find your influencer" tab. With no query it browses the
// local creator index; a keyword search goes through the cache-first
// discovery endpoint (which may trigger live provider lookups).
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
  const [sort, setSort] = useState<'followers' | 'recent'>('followers')

  // Pricing v4 search price (credits per page of 10) for the live cost
  // estimate under the search bar. null = credit system off / not loaded.
  const [searchPrice, setSearchPrice] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/pricing/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.creditSystemEnabled && typeof data.prices?.discovery_search === 'number') {
          setSearchPrice(data.prices.discovery_search)
        }
      })
      .catch(() => {})
  }, [])

  // Advanced filters (keyword search via the club API only — the local
  // browse index doesn't support them)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [minEngagement, setMinEngagement] = useState('')
  const [maxEngagement, setMaxEngagement] = useState('')
  const [gender, setGender] = useState('')
  const [language, setLanguage] = useState('')
  const [bioKeywords, setBioKeywords] = useState('')
  const [lastPost, setLastPost] = useState('')
  const [audienceAge, setAudienceAge] = useState('')

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

  // Initial load and re-browse when the sort changes (other filters apply
  // on submit to avoid refetching per keystroke).
  useEffect(() => {
    if (!searchResult) fetchBrowse(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort])

  const runSearchPage = async (
    request: DiscoverySearchRequest,
    page: number,
    preserveCurrentOnEmpty = false
  ) => {
    setIsLoading(true)
    setError(null)
    setSearchBlocked(false)
    setUnavailable(false)
    try {
      const qs = new URLSearchParams(request.params)
      if (request.endpoint === 'club-search') qs.set('page', String(page))
      // The offset is ignored by Club, but lets Overseed's local fallback
      // return the corresponding page if the provider is unavailable.
      qs.set('offset', String(page * request.pageSize))

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
      setSearchHasMore(results.length === request.pageSize)
    } catch (err: any) {
      setError(err.message || d.searchFailed)
      if (!preserveCurrentOnEmpty) {
        setSearchResult(null)
        setActiveSearch(null)
        setSearchPage(0)
        setSearchHasMore(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) {
      setSearchResult(null)
      setActiveSearch(null)
      setSearchPage(0)
      setSearchHasMore(false)
      fetchBrowse(0, false)
      return
    }
    if (platforms.length === 0) return

    /* TEMP: influencers.club search path — small pages, one platform */
    const isClub = source === 'club'
    const qs = isClub
      ? new URLSearchParams({
          q: query.trim(),
          platform: platforms[0],
          limit: String(CLUB_PAGE_SIZE),
        })
      : new URLSearchParams({
          q: query.trim(),
          topics: query.trim(),
          platforms: platforms.join(','),
          limit: String(PAGE_SIZE),
        })
    /* END TEMP */
    if (country.trim()) qs.set('country', country.trim().toUpperCase())
    if (minFollowers) qs.set('min_followers', minFollowers)
    if (maxFollowers) qs.set('max_followers', maxFollowers)
    if (minEngagement) qs.set('min_engagement', minEngagement)
    if (maxEngagement) qs.set('max_engagement', maxEngagement)
    if (gender) qs.set('gender', gender)
    if (language) qs.set('language', language)
    if (bioKeywords.trim()) qs.set('bio_keywords', bioKeywords.trim())
    if (lastPost) qs.set('last_post', lastPost)
    // Audience demographics are an Instagram-only club filter
    if (audienceAge && platforms[0] === 'instagram') qs.set('audience_age', audienceAge)

    await runSearchPage(
      {
        endpoint: isClub ? 'club-search' : 'search',
        params: qs.toString(),
        pageSize: isClub ? CLUB_PAGE_SIZE : PAGE_SIZE,
      },
      0
    )
  }

  const clearSearch = () => {
    setQuery('')
    setSearchResult(null)
    setActiveSearch(null)
    setSearchPage(0)
    setSearchHasMore(false)
    fetchBrowse(0, false)
  }

  const creators = searchResult ? searchResult.results : browseList || []
  const isBrowsing = !searchResult

  return (
    <div>
      {/* Search + filters */}
      <form onSubmit={submit} className="workspace-glass-toolbar rounded-2xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.searchPlaceholder}
            className="flex-1 px-4 py-2.5 workspace-glass-control focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || platforms.length === 0}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? d.searching : d.searchButton}
          </button>
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

        {/* Live credit-cost estimate: updates as the user types/filters */}
        {searchPrice != null && (
          <p className="mt-2 text-xs text-gray-400">
            {query.trim()
              ? d.searchCostEstimate.replace('{n}', String(searchPrice))
              : d.browseFreeNote.replace('{n}', String(searchPrice))}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1.5">{d.platformsLabel}</span>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-sm transition ${
                    platforms.includes(p)
                      ? 'bg-white text-gray-900 font-bold shadow-sm ring-1 ring-gray-200'
                      : 'bg-gray-100 text-gray-700 font-medium hover:bg-gray-200'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.countryLabel}</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
            >
              <option value="">{d.allCountries}</option>
              {COUNTRY_FILTER_OPTIONS.map(({ code, key }) => (
                <option key={code} value={code}>
                  {(t.signupBusiness.countries as Record<string, string>)[key] || code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.minFollowers}</label>
            <input
              type="number"
              min={0}
              value={minFollowers}
              onChange={(e) => setMinFollowers(e.target.value)}
              placeholder="10000"
              className="w-32 px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.maxFollowers}</label>
            <input
              type="number"
              min={0}
              value={maxFollowers}
              onChange={(e) => setMaxFollowers(e.target.value)}
              placeholder="1000000"
              className="w-32 px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
            />
          </div>
          {isBrowsing && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.sortLabel}</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'followers' | 'recent')}
                className="px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
              >
                <option value="followers">{d.sortFollowers}</option>
                <option value="recent">{d.sortRecent}</option>
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
          >
            {showAdvanced ? d.advancedFiltersHide : d.advancedFilters}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-200/60">
            <p className="text-xs text-gray-400 mb-3">{d.advancedHint}</p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.minEngagement}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={minEngagement}
                  onChange={(e) => setMinEngagement(e.target.value)}
                  placeholder="1"
                  className="w-24 px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.maxEngagement}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={maxEngagement}
                  onChange={(e) => setMaxEngagement(e.target.value)}
                  placeholder="10"
                  className="w-24 px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.genderLabel}</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
                >
                  <option value="">{d.anyOption}</option>
                  <option value="FEMALE">{d.genderFemale}</option>
                  <option value="MALE">{d.genderMale}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.languageLabel}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
                >
                  <option value="">{d.allLanguages}</option>
                  {LANGUAGE_FILTER_OPTIONS.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.bioKeywordsLabel}</label>
                <input
                  type="text"
                  value={bioKeywords}
                  onChange={(e) => setBioKeywords(e.target.value)}
                  placeholder={d.bioKeywordsPlaceholder}
                  className="w-48 px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.lastPostLabel}</label>
                <select
                  value={lastPost}
                  onChange={(e) => setLastPost(e.target.value)}
                  className="px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
                >
                  <option value="">{d.anyOption}</option>
                  <option value="90">{d.lastPost90}</option>
                  <option value="365">{d.lastPost365}</option>
                </select>
              </div>
              {platforms[0] === 'instagram' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.audienceAgeLabel}</label>
                  <select
                    value={audienceAge}
                    onChange={(e) => setAudienceAge(e.target.value)}
                    className="px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
                  >
                    <option value="">{d.anyOption}</option>
                    {AUDIENCE_AGE_OPTIONS.map((range) => (
                      <option key={range} value={range}>
                        {range === '65-' ? '65+' : range}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
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

      {!unavailable && (
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

          {!isLoading && creators.length === 0 ? (
            <div className="workspace-glass-card rounded-2xl p-8 text-center text-gray-500">{d.noResults}</div>
          ) : (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${
                isLoading ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              {creators.map((creator) => (
                // TEMP: club results open the detail popup on click
                <div
                  key={creator.id}
                  onClick={
                    creator.id.startsWith('club:') ? () => openDetail(creator) : undefined
                  }
                  className={`workspace-glass-card rounded-2xl p-5 flex gap-4 ${
                    creator.id.startsWith('club:')
                      ? 'cursor-pointer hover:shadow-md transition'
                      : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    <CreatorAvatar
                      url={creator.avatar_url}
                      name={creator.display_name || creator.handle || '?'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {creator.display_name || creator.handle || creator.id}
                      </p>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs flex-shrink-0">
                        {PLATFORM_LABELS[creator.platform] || creator.platform}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatFollowers(creator.follower_count, locale)} {d.followers}
                      {creator.engagement_rate != null && (
                        <> · {Number(creator.engagement_rate).toFixed(1)}% {d.engagement}</>
                      )}
                      {creator.country && <> · {creator.country}</>}
                    </p>
                    {creator.bio && (
                      <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{creator.bio}</p>
                    )}
                    {creator.niche_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {creator.niche_tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(creator.profile_url || creator.id.startsWith('club:')) && (
                      <div className="mt-3 flex items-center gap-4">
                        {creator.id.startsWith('club:') && (
                          <span className="text-sm text-primary-600 font-medium">
                            {d.viewDetails}
                          </span>
                        )}
                        {creator.profile_url && (
                          <a
                            href={creator.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-primary-600 hover:underline font-medium"
                          >
                            {d.viewProfile} ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
                onClick={() => activeSearch && runSearchPage(activeSearch, searchPage - 1, true)}
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
                onClick={() => activeSearch && runSearchPage(activeSearch, searchPage + 1, true)}
                disabled={!activeSearch || !searchHasMore || isLoading}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {d.nextPage} →
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-gray-400">
            {d.dataAttribution}
          </p>
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
                  url={detail?.avatar_url || detailFor.avatar_url || null}
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
                            className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium capitalize"
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
                          {analyticsLoading ? 'Loading analytics…' : 'View full analytics'}
                        </button>
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
                    View profile ↗
                  </a>
                )}
                </div>
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
