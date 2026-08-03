'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { PlatformIcon } from '@/components/campaigns/CampaignRowCard'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Saved Creators: the brand's bookmarked platform creators, as a filterable
// card grid. Bookmarks come from the applications table and creator profiles.

const PAGE_SIZE = 9
const FOLLOWER_BUCKETS = [
  { value: '', labelKey: 'any' },
  { value: '10000', label: '10K+' },
  { value: '50000', label: '50K+' },
  { value: '100000', label: '100K+' },
  { value: '500000', label: '500K+' },
]

const COUNTRY_LABELS: Record<string, { en: string; zh: string }> = {
  US: { en: 'United States', zh: '美国' },
  USA: { en: 'United States', zh: '美国' },
  UK: { en: 'United Kingdom', zh: '英国' },
  CA: { en: 'Canada', zh: '加拿大' },
  Canada: { en: 'Canada', zh: '加拿大' },
  AU: { en: 'Australia', zh: '澳大利亚' },
  DE: { en: 'Germany', zh: '德国' },
  FR: { en: 'France', zh: '法国' },
  ES: { en: 'Spain', zh: '西班牙' },
  IT: { en: 'Italy', zh: '意大利' },
  CN: { en: 'China', zh: '中国' },
  China: { en: 'China', zh: '中国' },
  HK: { en: 'Hong Kong SAR', zh: '中国香港特别行政区' },
  'Hong Kong': { en: 'Hong Kong SAR', zh: '中国香港特别行政区' },
  MO: { en: 'Macao SAR', zh: '中国澳门特别行政区' },
  Macau: { en: 'Macao SAR', zh: '中国澳门特别行政区' },
  SG: { en: 'Singapore', zh: '新加坡' },
  JP: { en: 'Japan', zh: '日本' },
  KR: { en: 'South Korea', zh: '韩国' },
  Korea: { en: 'South Korea', zh: '韩国' },
  AE: { en: 'United Arab Emirates', zh: '阿联酋' },
  UAE: { en: 'United Arab Emirates', zh: '阿联酋' },
  BR: { en: 'Brazil', zh: '巴西' },
  MX: { en: 'Mexico', zh: '墨西哥' },
}

export default function SavedCreatorsPage() {
  const { t, locale } = useLanguage()
  const s = t.brand.savedCreators

  const [saved, setSaved] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('')
  const [country, setCountry] = useState('')
  const [category, setCategory] = useState('')
  const [minFollowers, setMinFollowers] = useState('')
  const [sort, setSort] = useState<'recent' | 'followers'>('recent')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/saved-creators')
      .then((res) => (res.ok ? res.json() : { saved: [] }))
      .then((data) => setSaved(data.saved || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const maxFollowers = (inf: any) =>
    Math.max(0, ...(inf?.socialAccounts || []).map((a: any) => a.followerCount || 0))
  const topEngagement = (inf: any) => {
    const rates = (inf?.socialAccounts || [])
      .map((a: any) => (a.engagementRate != null ? Number(a.engagementRate) : null))
      .filter((v: number | null) => v != null)
    return rates.length ? Math.max(...(rates as number[])) : null
  }

  const platforms = useMemo(() => {
    const set = new Set<string>()
    saved.forEach((row) =>
      (row.influencer?.socialAccounts || []).forEach((a: any) => a.platform?.name && set.add(a.platform.name))
    )
    return [...set].sort()
  }, [saved])

  const countries = useMemo(() => {
    const set = new Set<string>()
    saved.forEach((row) => row.influencer?.locationCountry && set.add(row.influencer.locationCountry))
    return [...set].sort()
  }, [saved])

  const categories = useMemo(() => {
    const set = new Set<string>()
    saved.forEach((row) => row.influencer?.primaryNiche && set.add(row.influencer.primaryNiche))
    return [...set].sort()
  }, [saved])

  const hasFilters = !!(query || platform || country || category || minFollowers)

  const visible = useMemo(() => {
    let list = [...saved]
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((row) => {
        const inf = row.influencer
        const handle = inf?.socialAccounts?.[0]?.username || ''
        return (
          inf?.displayName?.toLowerCase().includes(q) ||
          inf?.user?.name?.toLowerCase().includes(q) ||
          handle.toLowerCase().includes(q)
        )
      })
    }
    if (platform) {
      list = list.filter((row) =>
        (row.influencer?.socialAccounts || []).some((a: any) => a.platform?.name === platform)
      )
    }
    if (country) list = list.filter((row) => row.influencer?.locationCountry === country)
    if (category) list = list.filter((row) => row.influencer?.primaryNiche === category)
    if (minFollowers) list = list.filter((row) => maxFollowers(row.influencer) >= Number(minFollowers))
    if (sort === 'followers') {
      list.sort((a, b) => maxFollowers(b.influencer) - maxFollowers(a.influencer))
    } else {
      list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    }
    return list
  }, [saved, query, platform, country, category, minFollowers, sort])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const unsave = async (influencerId: string) => {
    setBusyId(influencerId)
    try {
      const res = await fetch(`/api/saved-creators?influencerId=${influencerId}`, { method: 'DELETE' })
      if (res.ok) setSaved((prev) => prev.filter((row) => row.influencerId !== influencerId))
    } finally {
      setBusyId(null)
    }
  }

  const savedAgo = (iso: string) => {
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
    const rtf = new Intl.RelativeTimeFormat(locale === 'zh' ? 'zh' : 'en', { numeric: 'auto' })
    if (days < 1) return `${s.savedPrefix} ${rtf.format(0, 'day')}`
    if (days < 30) return `${s.savedPrefix} ${rtf.format(-days, 'day')}`
    return `${s.savedPrefix} ${rtf.format(-Math.round(days / 30), 'month')}`
  }

  const compact = (n: number) =>
    new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  const countryLabel = (value?: string | null) =>
    value ? (COUNTRY_LABELS[value]?.[locale === 'zh' ? 'zh' : 'en'] || value) : '—'

  const selectClass =
    'px-3 py-2 workspace-glass-control text-sm font-medium text-gray-700 focus:outline-none'

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-6xl mx-auto workspace-page-tight pb-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">
            {s.title} › {s.breadcrumb}
          </p>
          <h1 className="text-3xl font-bold text-gray-900">{s.title}</h1>
          <p className="text-gray-500 mt-1">{s.subtitle}</p>
        </div>

        {/* Toolbar */}
        <div className="mb-4 workspace-glass-toolbar rounded-2xl px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder={s.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 workspace-glass-control text-sm focus:outline-none"
            />
          </div>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1) }} className={selectClass} title={s.platform}>
            <option value="">{s.platform}: {s.all}</option>
            {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1) }} className={selectClass} title={s.country}>
            <option value="">{s.country}: {s.all}</option>
            {countries.map((cn) => <option key={cn} value={cn}>{countryLabel(cn)}</option>)}
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className={selectClass} title={s.category}>
            <option value="">{s.category}: {s.all}</option>
            {categories.map((c) => <option key={c} value={c}>{t.categoryNames[c] || c}</option>)}
          </select>
          <select value={minFollowers} onChange={(e) => { setMinFollowers(e.target.value); setPage(1) }} className={selectClass} title={s.followersLabel}>
            {FOLLOWER_BUCKETS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.value ? `${s.followersLabel}: ${b.label}` : `${s.followersLabel}: ${s.any}`}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value as any); setPage(1) }} className={selectClass} title={s.sortBy}>
            <option value="recent">{s.sortRecentlySaved}</option>
            <option value="followers">{s.sortFollowers}</option>
          </select>
          <button
            onClick={() => { setQuery(''); setPlatform(''); setCountry(''); setCategory(''); setMinFollowers(''); setPage(1) }}
            disabled={!hasFilters}
            className="px-4 py-2 rounded-full text-sm font-semibold text-primary-600 hover:bg-white/55 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↺ {s.clearFilters}
          </button>
        </div>

        <p className="text-sm text-gray-500 font-medium mb-4">{visible.length} {s.count}</p>

        {/* Grid */}
        {loading ? (
          <div className="workspace-glass-card rounded-2xl p-10 text-center text-gray-400 text-sm">…</div>
        ) : saved.length === 0 ? (
          <div className="workspace-glass-card rounded-2xl p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">{s.empty}</p>
            <p className="text-gray-400">{s.emptyDesc}</p>
          </div>
        ) : paged.length === 0 ? (
          <div className="workspace-glass-card rounded-2xl p-10 text-center text-gray-500">{s.noMatches}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paged.map((row) => {
              const inf = row.influencer
              const name = inf?.displayName || inf?.user?.name || 'Creator'
              const handle = inf?.socialAccounts?.[0]?.username
              const followers = maxFollowers(inf)
              const eng = topEngagement(inf)
              return (
                <div key={row.influencerId} className="workspace-glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400">{savedAgo(row.savedAt)}</span>
                    <button
                      onClick={() => unsave(row.influencerId)}
                      disabled={busyId === row.influencerId}
                      className="text-primary-600 hover:text-red-500 transition disabled:opacity-50"
                      title={s.savedState}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {inf?.avatarUrl || inf?.user?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={inf.avatarUrl || inf.user.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
                          {name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 flex items-center gap-1.5 truncate">
                        {name}
                        {inf?.isVerified && (
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l2.4 2.4 3.3-.5.5 3.3L20.6 9.6 22 12l-1.4 2.4.6 3.3-3.3.5L15.4 21.6 12 20.2 8.6 21.6 6.1 18.2l-3.3-.5.6-3.3L2 12l1.4-2.4-.5-3.3 3.3.5L8.6 2.4 12 2zm-1.2 12.7l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" />
                          </svg>
                        )}
                      </p>
                      {handle && <p className="text-sm text-gray-500 truncate">@{handle}</p>}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {(inf?.socialAccounts || []).slice(0, 3).map((acc: any) => (
                          <PlatformIcon key={acc.id} name={acc.platform?.name || ''} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {inf?.primaryNiche && (
                    <span className="inline-block mt-3 px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                      {t.categoryNames[inf.primaryNiche] || inf.primaryNiche}
                    </span>
                  )}

                  <div className="grid grid-cols-3 divide-x divide-gray-100 mt-3 text-center">
                    <div>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{followers ? compact(followers) : '—'}</p>
                      <p className="text-[11px] text-gray-400">{s.followers}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{countryLabel(inf?.locationCountry)}</p>
                      <p className="text-[11px] text-gray-400">{s.country}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{eng != null ? `${eng.toFixed(1)}%` : '—'}</p>
                      <p className="text-[11px] text-gray-400">{s.engRate}</p>
                    </div>
                  </div>

                  {inf?.bio && <p className="text-xs text-gray-500 mt-3 line-clamp-1">{inf.bio}</p>}

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Link
                      href={`/influencer/${row.influencerId}`}
                      className="text-center px-4 py-2 bg-indigo-100 text-primary-700 rounded-full text-sm font-semibold hover:bg-indigo-200/70 transition"
                    >
                      {s.viewProfile}
                    </Link>
                    <Link
                      href="/dashboard/messages"
                      className="text-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-50 transition"
                    >
                      {s.message}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-9 h-9 rounded-full bg-white shadow-sm text-gray-600 disabled:opacity-40 hover:text-primary-700 transition"
              aria-label="Previous page"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-9 h-9 rounded-full text-sm transition ${
                  n === safePage ? 'bg-white text-gray-900 font-bold shadow-sm ring-1 ring-gray-200' : 'bg-white shadow-sm text-gray-600 font-semibold hover:text-gray-900'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-9 h-9 rounded-full bg-white shadow-sm text-gray-600 disabled:opacity-40 hover:text-primary-700 transition"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </BrandWorkspaceLayout>
  )
}
