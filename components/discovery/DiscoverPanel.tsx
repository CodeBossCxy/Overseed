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

  /* TEMP: influencers.club creator detail popup (contact info stripped
     server-side; brands contact creators inside Overseed only) */
  const [detailFor, setDetailFor] = useState<DiscoveredCreator | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const openDetail = async (creator: DiscoveredCreator) => {
    if (!creator.handle) return
    setDetailFor(creator)
    setDetail(null)
    setDetailError(null)
    setDetailBlocked(false)
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams({
        platform: creator.platform,
        handle: creator.handle,
      })
      const res = await fetch(`/api/discovery/club-enrich?${qs}`)
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
    setSearchBlocked(false)
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
      if (!res.ok) {
        setSearchBlocked(QUOTA_CODES.includes(data?.code))
        throw new Error(data?.message || d.searchFailed)
      }
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

        <div className="mt-4 flex flex-wrap items-end gap-4">
          {/* TEMP: influencers.club data source picker — remove with
              lib/influencers-club.ts and app/api/discovery/club-search/ */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Data source</label>
            <select
              value={source}
              onChange={(e) => changeSource(e.target.value as DiscoverySource)}
              className="px-3 py-1.5 workspace-glass-control text-sm focus:outline-none"
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
                  className={`px-3 py-1.5 rounded-full text-sm transition ${
                    platformDisabled(p)
                      ? 'bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed'
                      : platforms.includes(p)
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
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={d.countryPlaceholder}
              maxLength={2}
              className="w-24 px-3 py-1.5 workspace-glass-control text-sm uppercase focus:outline-none"
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
            <div className="workspace-glass-card rounded-2xl p-8 text-center text-gray-500">{d.noResults}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {(creator.profile_url || creator.id.startsWith('club:')) && (
                      <div className="mt-3 flex items-center gap-4">
                        {/* TEMP: club cards advertise the detail popup */}
                        {creator.id.startsWith('club:') && (
                          <span className="text-sm text-primary-600 font-medium">
                            View details · 1 credit
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
            <div className="px-7 -mt-10 flex items-end gap-4 flex-shrink-0">
              <div className="w-20 h-20 rounded-full ring-4 ring-white bg-gray-200 overflow-hidden shadow-md flex-shrink-0">
                {(detail?.avatar_url || detailFor.avatar_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detail?.avatar_url || detailFor.avatar_url || ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                    {(detailFor.display_name || detailFor.handle || '?').charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
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
                </>
              )}
            </div>

            {/* Footer actions */}
            {detail && (
              <div className="flex items-center gap-3 px-7 py-4 border-t border-gray-100 flex-shrink-0">
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
                  placeholder="Introduce your brand and describe the collaboration you have in mind…"
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
