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
const SOURCE_LABELS: Record<DiscoverySource, string> = {
  kol: 'YouTube API',
  club: 'Influencers Club API',
}
// Club bills 0.01 credits per returned creator — keep pages small.
const CLUB_PAGE_SIZE = 10
/* END TEMP */

const PLATFORMS = ['youtube', 'instagram', 'tiktok'] as const
const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
}
const PAGE_SIZE = 50

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
  const [source, setSource] = useState<DiscoverySource>('kol')
  // The KOL service's live search covers YouTube only (phase 1) — lock the
  // default source to YouTube so IG/TikTok searches don't dead-end.
  const [platforms, setPlatforms] = useState<string[]>(['youtube'])
  const [country, setCountry] = useState('')
  const [minFollowers, setMinFollowers] = useState('')
  const [maxFollowers, setMaxFollowers] = useState('')
  const [sort, setSort] = useState<'followers' | 'recent'>('followers')

  const [browseList, setBrowseList] = useState<DiscoveredCreator[] | null>(null)
  // Offset into the raw (un-narrowed) creator index for pagination — may
  // exceed the number of displayed cards when platforms are filtered
  // client-side.
  const [rawOffset, setRawOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  // YouTube API source: only YouTube is searchable (phase 1).
  // TEMP: club source takes exactly one platform per request (and each
  // returned creator costs credits), so its pills act as radio buttons.
  const platformDisabled = (p: string) => source === 'kol' && p !== 'youtube'

  const togglePlatform = (p: string) => {
    if (platformDisabled(p)) return
    if (source === 'club') {
      setPlatforms([p])
      return
    }
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  /* TEMP: switch data source — one platform for club, YouTube-only for kol */
  const changeSource = (s: DiscoverySource) => {
    setSource(s)
    setSearchResult(null)
    if (s === 'club') {
      setPlatforms((prev) => [prev[0] || 'instagram'])
    } else {
      setPlatforms(['youtube'])
    }
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

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) {
      setSearchResult(null)
      fetchBrowse(0, false)
      return
    }
    if (platforms.length === 0) return
    setIsLoading(true)
    setError(null)
    setUnavailable(false)
    try {
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

      const res = await fetch(
        `/api/discovery/${isClub ? 'club-search' : 'search'}?${qs}`
      )
      if (res.status === 503) {
        setUnavailable(true)
        setSearchResult(null)
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || d.searchFailed)
      setSearchResult(data)
    } catch (err: any) {
      setError(err.message || d.searchFailed)
      setSearchResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setSearchResult(null)
    fetchBrowse(0, false)
  }

  const creators = searchResult ? searchResult.results : browseList || []
  const isBrowsing = !searchResult

  return (
    <div>
      {/* Search + filters */}
      <form onSubmit={submit} className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.searchPlaceholder}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={isLoading || platforms.length === 0}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? d.searching : d.searchButton}
          </button>
          {searchResult && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              {d.clearSearch}
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          {/* TEMP: influencers.club data source picker — remove with
              lib/influencers-club.ts and app/api/discovery/club-search/ */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Data source</label>
            <select
              value={source}
              onChange={(e) => changeSource(e.target.value as DiscoverySource)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {(Object.keys(SOURCE_LABELS) as DiscoverySource[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          {/* END TEMP */}
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1.5">{d.platformsLabel}</span>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  disabled={platformDisabled(p)}
                  title={platformDisabled(p) ? 'Coming soon for this data source' : undefined}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    platformDisabled(p)
                      ? 'bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed'
                      : platforms.includes(p)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.countryLabel}</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={d.countryPlaceholder}
              maxLength={2}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.minFollowers}</label>
            <input
              type="number"
              min={0}
              value={minFollowers}
              onChange={(e) => setMinFollowers(e.target.value)}
              placeholder="10000"
              className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {isBrowsing && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{d.sortLabel}</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'followers' | 'recent')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="followers">{d.sortFollowers}</option>
                <option value="recent">{d.sortRecent}</option>
              </select>
            </div>
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
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Search-only notices */}
      {searchResult &&
        (searchResult.warnings.length > 0 ||
          Object.values(searchResult.platform_coverage).some((v) => v !== 'ok')) && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            {Object.entries(searchResult.platform_coverage)
              .filter(([, status]) => status !== 'ok')
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
            {searchResult && (
              <p className="text-xs text-gray-400">
                {/* TEMP: club responses report remaining credits instead of cache stats */}
                {searchResult.credits_left != null
                  ? `Influencers Club credits left: ${searchResult.credits_left}`
                  : `${d.cacheHits}: ${searchResult.cache_hits} · ${d.liveCalls}: ${searchResult.live_calls}`}
              </p>
            )}
          </div>

          {!isLoading && creators.length === 0 ? (
            <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-8 text-center text-gray-500">{d.noResults}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {creators.map((creator) => (
                <div key={creator.id} className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-5 flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {creator.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {(creator.display_name || creator.handle || '?').charAt(0)}
                      </div>
                    )}
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
                    {creator.profile_url && (
                      <div className="mt-3">
                        <a
                          href={creator.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:underline font-medium"
                        >
                          {d.viewProfile} ↗
                        </a>
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
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50"
              >
                {isLoadingMore ? d.loadingCreators : d.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
