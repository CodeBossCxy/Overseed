'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatNumber } from '@/lib/i18n/formatNumber'
import {
  COUNTRY_FILTER_OPTIONS,
} from '@/components/discovery/DiscoverPanel'
import {
  CREATORDB_LANGUAGE_OPTIONS,
} from '@/lib/creatordb-filter-fields'
import Markdown from '@/components/Markdown'

type Creator = {
  id: string; platform: string; handle: string | null; display_name: string | null
  bio: string | null; country: string | null; language?: string | null
  follower_count: number | null
  engagement_rate: string | number | null; niche_tags: string[]
  profile_url: string | null; avatar_url: string | null; score: number | null
}
type QueueItem = {
  id: string; externalCreatorId: string; platform: string; handle: string | null
  displayName: string | null; avatarUrl: string | null; followerCount: number | null
  engagementRate: string | number | null; nicheTags: string[]; status: string
}
type Campaign = {
  id: string; title: string; status: string; deadline: string | null
  compensationType: string; paymentMin: number | string | null; paymentMax: number | string | null
  giftDescription: string | null; giftValue?: number | string | null; images: string[]; description: string | null
  contentGuidelines?: string | null; contentType?: string | null; createdAt: string
  campaignStartDate?: string | null; campaignEndDate?: string | null
  totalSlots: number; filledSlots: number; viewCount: number
  hashtagsRequired?: string | null; mentionsRequired?: string | null
  categories: { categoryId: string; category: { name: string } }[]
  platforms: { platformId: string; platform: { name: string } }[]
  followerRequirements?: { id: string; minFollowers: number; maxFollowers: number | null; minEngagementRate?: string | number | null; platform: { name: string } }[]
  brand?: { companyName: string | null; logoUrl: string | null } | null
}

const PLATFORM_LABEL: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' }
const STATUS_STYLE: Record<string, string> = {
  SHORTLISTED: 'bg-slate-100 text-slate-600', PENDING_REVIEW: 'bg-amber-50 text-amber-600',
  READY_FOR_OUTREACH: 'bg-violet-50 text-violet-600', CONTACTED: 'bg-blue-50 text-blue-600',
  INTERESTED: 'bg-emerald-50 text-emerald-600', PENDING_RESPONSE: 'bg-orange-50 text-orange-600',
}
const icon = (path: string, className = 'w-5 h-5') => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d={path}/></svg>
)
const searchIcon = 'm21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'
const sparkle = 'm12 3 .7 2.3A6 6 0 0 0 16.7 9l2.3.7-2.3.7a6 6 0 0 0-4 4L12 17l-.7-2.6a6 6 0 0 0-4-4L5 9.7 7.3 9a6 6 0 0 0 4-3.7L12 3Z'

function compact(value: number | null) {
  return value == null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
function avatar(creator: { avatar_url?: string | null; avatarUrl?: string | null; display_name?: string | null; displayName?: string | null }, size = 'w-14 h-14') {
  const src = creator.avatar_url || creator.avatarUrl
  const name = creator.display_name || creator.displayName || '?'
  return <div className={`${size} rounded-full overflow-hidden bg-gradient-to-br from-indigo-100 to-orange-100 flex-shrink-0`}>{src ? <img src={src} alt="" className="w-full h-full object-cover"/> : <span className="w-full h-full flex items-center justify-center font-bold text-indigo-800">{name[0]}</span>}</div>
}

type CampaignStats = { total: number; pending: number; approved: number; rejected: number; underReview: number }

export default function BrandCampaignDetailClient({ campaign: initialCampaign, stats }: { campaign: Campaign; stats: CampaignStats }) {
  const { t, locale } = useLanguage()
  const d = t.brand.discover
  const m = t.brand.campaignDetail.manage
  const router = useRouter()
  const [campaign, setCampaign] = useState(initialCampaign)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submitForReview = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }), // server converts to PENDING_REVIEW
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || t.brand.campaigns.submitFailed)
      setCampaign((cp) => ({ ...cp, status: 'PENDING_REVIEW' }))
      router.refresh()
    } catch (err: any) {
      setSubmitError(err.message || t.brand.campaigns.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const removeCampaign = async (mode: 'delete' | 'cancel') => {
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/campaigns/${campaign.id}${mode === 'cancel' ? '?mode=cancel' : ''}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        if (mode === 'delete') {
          router.push('/dashboard/brand/campaigns')
        } else {
          setShowDelete(false)
          setCampaign((cp) => ({ ...cp, status: 'CANCELLED' }))
          router.refresh()
        }
      }
    } finally {
      setDeleting(false)
    }
  }

  const canCancel = ['ACTIVE', 'PENDING_REVIEW', 'PAUSED'].includes(campaign.status)

  const deleteModal = showDelete && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setShowDelete(false)}>
      <div data-solid className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-[#17255f]" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg">{t.brand.campaigns.deleteConfirmTitle}</h3>
        <p className="text-sm text-[#59678f] mt-2">{t.brand.campaigns.deleteConfirmDesc}</p>
        {canCancel && (
          <p className="text-sm text-[#59678f] mt-2">{t.brand.campaigns.cancelConfirmDesc}</p>
        )}
        <p className="text-sm font-semibold mt-3 truncate">{campaign.title}</p>
        <div className="flex flex-wrap justify-end gap-2 mt-6">
          <button onClick={() => setShowDelete(false)} disabled={deleting} className="px-4 py-2 text-sm font-medium text-[#59678f] hover:text-[#17255f] rounded-xl transition disabled:opacity-50">
            {t.brand.campaigns.keepCampaign}
          </button>
          {canCancel && (
            <button onClick={() => removeCampaign('cancel')} disabled={deleting} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50">
              {t.brand.campaigns.cancelCampaign}
            </button>
          )}
          <button onClick={() => removeCampaign('delete')} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50">
            {deleting ? '…' : t.brand.campaigns.deletePermanently}
          </button>
        </div>
      </div>
    </div>
  )
  const [tab, setTab] = useState<'detail' | 'direct'>('detail')
  const [query, setQuery] = useState('')
  // Filters default to the campaign brief (platform / follower requirement);
  // the brand can adjust them before running the AI match.
  const [platform, setPlatform] = useState(() => {
    const p = (initialCampaign.platforms[0]?.platform.name || '').toLowerCase()
    return ['youtube', 'instagram', 'tiktok'].includes(p) ? p : 'youtube'
  })
  // CreatorDB canonical filters
  type CdbFilter = { field: string; op: string; value: string }
  const [cdbFilters, setCdbFilters] = useState<CdbFilter[]>([])
  const cdbFilterFor = (field: string) => cdbFilters.find(f => f.field === field) || { field, op: '=', value: '' }
  const updateCdbFilter = (field: string, updates: Partial<CdbFilter>) => {
    setCdbFilters(prev => {
      const exists = prev.find(f => f.field === field)
      if (exists) {
        const updated = prev.map(f => f.field === field ? { ...f, ...updates } : f)
        // Remove if value cleared
        return updated.filter(f => f.value.trim() !== '')
      }
      const newFilter = { field, op: '=', value: '', ...updates }
      return newFilter.value.trim() ? [...prev, newFilter] : prev
    })
  }

  // Keep these simple states for creator country + followers (injected into cdb_filters on search)
  const [creatorCountry, setCreatorCountry] = useState('')
  const [minFollowers, setMinFollowers] = useState(() => {
    const min = initialCampaign.followerRequirements?.[0]?.minFollowers
    return min ? String(min) : ''
  })
  const [maxFollowers, setMaxFollowers] = useState(() => {
    const max = initialCampaign.followerRequirements?.[0]?.maxFollowers
    return max ? String(max) : ''
  })
  const [creators, setCreators] = useState<Creator[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  // No creators are shown until the brand runs the AI match (or a manual
  // search) — discovery is metered, so nothing auto-loads.
  const [matched, setMatched] = useState(false)
  const [aiMatching, setAiMatching] = useState(false)
  const [searchPrice, setSearchPrice] = useState<number | null>(null)
  const [queueBusy, setQueueBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Creator | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Filters + results survive navigating away and back (per campaign, per tab)
  const searchStateKey = `campaign-discover:${initialCampaign.id}:v1`
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(searchStateKey)
      if (!raw) return
      const s = JSON.parse(raw)
      if (!Array.isArray(s?.creators) || s.creators.length === 0) return
      setQuery(s.query || '')
      if (s.platform) setPlatform(s.platform)
      setCreatorCountry(s.creatorCountry || '')
      setMinFollowers(s.minFollowers || '')
      setMaxFollowers(s.maxFollowers || '')
      setCdbFilters(s.cdbFilters || [])
      setCreators(s.creators)
      setMatched(true)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!matched || creators.length === 0) return
    try {
      sessionStorage.setItem(searchStateKey, JSON.stringify({
        query, platform, creatorCountry, minFollowers, maxFollowers, cdbFilters, creators,
      }))
    } catch {}
  }, [matched, creators, query, platform, creatorCountry, minFollowers, maxFollowers, cdbFilters, searchStateKey])

  const loadQueue = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaign.id}/outreach`)
    if (res.ok) setQueue((await res.json()).queue || [])
  }, [campaign.id])

  const buildCdbFiltersParam = useCallback(() => {
    const filters: { field: string; op: string; value: string | number | boolean | string[] }[] = []

    // Add all user-set CreatorDB filters
    for (const f of cdbFilters) {
      if (!f.value.trim()) continue
      const field = f.field
      // Array fields
      if (['hashtags', 'niches', 'audienceAge'].includes(field)) {
        filters.push({ field, op: 'in', value: f.value.split(',').map(v => v.trim()).filter(Boolean) })
      } else if (field === 'audienceFemaleRatio') {
        filters.push({ field, op: '>', value: Number(f.value) })
      } else if (field === 'isAccountVerified') {
        filters.push({ field, op: '=', value: f.value === 'true' })
      } else if (['followers', 'shortEngagementRate', 'shortAvgViews', 'lastPublishTime'].includes(field)) {
        filters.push({ field, op: f.op || '>', value: Number(f.value) })
      } else {
        filters.push({ field, op: f.op || '=', value: f.value })
      }
    }

    // Inject basic filters
    if (minFollowers && !filters.some(f => f.field === 'followers' && f.op === '>')) {
      filters.push({ field: 'followers', op: '>', value: Number(minFollowers) })
    }
    if (maxFollowers && !filters.some(f => f.field === 'followers' && f.op === '<')) {
      filters.push({ field: 'followers', op: '<', value: Number(maxFollowers) })
    }
    if (creatorCountry.trim() && !filters.some(f => f.field === 'country')) {
      filters.push({ field: 'country', op: '=', value: creatorCountry.trim().toUpperCase() })
    }

    return filters
  }, [cdbFilters, minFollowers, maxFollowers, creatorCountry])

  const discover = useCallback(async (search = '') => {
    setLoading(true); setError('')
    const searching = Boolean(search.trim())
    const qs = new URLSearchParams({ platform })
    const filters = buildCdbFiltersParam()

    if (filters.length > 0) {
      qs.set('cdb_filters', JSON.stringify(filters))
      qs.set('limit', '100')
      qs.set('offset', '0')
      qs.set('cdb_sort', 'followers')
    } else if (searching) {
      qs.set('q', search.trim())
      qs.set('limit', '10')
    } else {
      qs.set('sort', 'followers')
      qs.set('limit', '50')
    }
    if (searching && !filters.length) {
      qs.set('q', search.trim())
    }

    try {
      const endpoint = (searching || filters.length > 0) ? 'club-search' : 'creators'
      const res = await fetch(`/api/discovery/${endpoint}?${qs}`)
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || 'Creator discovery is temporarily unavailable.')
      setCreators(data?.results || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false); setMatched(true) }
  }, [platform, buildCdbFiltersParam])

  const aiMatch = async () => {
    if (aiMatching) return
    setAiMatching(true); setError('')
    try {
      // Auto-fill filters from campaign brief
      const autoFilters: CdbFilter[] = []

      // Map campaign categories to niches
      const catNames = campaign.categories.map(c => c.category.name).join(', ')
      if (catNames) {
        autoFilters.push({ field: 'niches', op: 'in', value: catNames })
      }

      // Map campaign platforms
      const campPlatform = (campaign.platforms[0]?.platform.name || '').toLowerCase()
      if (['youtube', 'instagram', 'tiktok'].includes(campPlatform)) {
        setPlatform(campPlatform)
      }

      // Use query as hashtags if provided
      if (query.trim()) {
        autoFilters.push({ field: 'hashtags', op: 'in', value: query.trim() })
      }

      // Set last active to 3 months for freshness
      autoFilters.push({ field: 'lastPublishTime', op: '>', value: '90' })

      // Set the filters in state so they appear in the UI
      setCdbFilters(autoFilters)

      // Build the full filter set for the search
      const filters: { field: string; op: string; value: string | number | boolean | string[] }[] = []

      for (const f of autoFilters) {
        if (!f.value.trim()) continue
        if (['hashtags', 'niches', 'audienceAge'].includes(f.field)) {
          filters.push({ field: f.field, op: 'in', value: f.value.split(',').map(v => v.trim()).filter(Boolean) })
        } else if (['followers', 'shortEngagementRate', 'lastPublishTime'].includes(f.field)) {
          filters.push({ field: f.field, op: f.op || '>', value: Number(f.value) })
        } else {
          filters.push({ field: f.field, op: f.op || '=', value: f.value })
        }
      }

      // Inject follower requirements from campaign
      if (minFollowers && !filters.some(f => f.field === 'followers')) {
        filters.push({ field: 'followers', op: '>', value: Number(minFollowers) })
      }
      if (maxFollowers) {
        filters.push({ field: 'followers', op: '<', value: Number(maxFollowers) })
      }
      if (creatorCountry.trim()) {
        filters.push({ field: 'country', op: '=', value: creatorCountry.trim().toUpperCase() })
      }

      const activePlatform = campPlatform && ['youtube', 'instagram', 'tiktok'].includes(campPlatform) ? campPlatform : platform
      const qs = new URLSearchParams({ platform: activePlatform, limit: '100', offset: '0', cdb_sort: 'followers' })
      qs.set('cdb_filters', JSON.stringify(filters))

      const res = await fetch(`/api/discovery/club-search?${qs}`)
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || 'Creator matching is temporarily unavailable.')
      setCreators(data?.results || [])
      setMatched(true)
    } catch (e: any) { setError(e.message) }
    finally { setAiMatching(false) }
  }

  useEffect(() => { loadQueue() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch('/api/pricing/config')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.creditSystemEnabled && typeof data.prices?.discovery_search === 'number') {
          setSearchPrice(data.prices.discovery_search)
        }
      })
      .catch(() => {})
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/campaigns/${initialCampaign.id}?lang=${locale}&track=0`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCampaign(data) })
      .catch(() => {})
    return () => controller.abort()
  }, [initialCampaign.id, locale])

  const addCreator = async (creator: Creator) => {
    setQueueBusy(true); setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/outreach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creator }) })
      const data = await res.json(); if (!res.ok) throw new Error(data.message)
      setQueue(data.queue); setSelected(null)
    } catch (e: any) { setError(e.message || 'Could not add creator') }
    finally { setQueueBusy(false) }
  }
  const removeCreator = async (id: string) => {
    const res = await fetch(`/api/campaigns/${campaign.id}/outreach?outreachId=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) setQueue((await res.json()).queue)
  }
  const requestOutreach = async () => {
    setQueueBusy(true)
    const res = await fetch(`/api/campaigns/${campaign.id}/outreach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request' }) })
    if (res.ok) setQueue((await res.json()).queue)
    else setError((await res.json()).message || 'Could not request outreach')
    setQueueBusy(false)
  }
  const openCreator = async (creator: Creator) => {
    setSelected(creator); setDetail(null)
    if (!creator.id.startsWith('club:') || !creator.handle) return
    setDetailLoading(true)
    const qs = new URLSearchParams({ platform: creator.platform, handle: creator.handle })
    const res = await fetch(`/api/discovery/club-enrich?${qs}`)
    if (res.ok) setDetail(await res.json())
    setDetailLoading(false)
  }

  const queuedIds = useMemo(() => new Set(queue.map(q => q.externalCreatorId)), [queue])
  const budget = campaign.paymentMin ? `$${formatNumber(Number(campaign.paymentMin), locale)}${campaign.paymentMax ? ` – $${formatNumber(Number(campaign.paymentMax), locale)}` : '+'}` : campaign.giftDescription || m.negotiable
  const cover = campaign.images?.[0]

  const campaignTabs = <div className="flex gap-2 mb-5 p-1.5 w-fit rounded-2xl bg-white/35 border border-white/50">
    <button onClick={() => setTab('detail')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'detail' ? 'bg-white/80 shadow-sm text-[#17255f]' : 'text-[#7180ad]'}`}>{m.tabDetail}</button>
    <button onClick={() => setTab('direct')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'direct' ? 'bg-white/80 shadow-sm text-[#17255f]' : 'text-[#7180ad]'}`}>{m.tabDirect}</button>
  </div>

  const fCls = 'workspace-glass-control px-3 py-2 text-sm'
  const zh = locale === 'zh'
  const filterSections = <>
    {/* Section 1 — Audience */}
    <div className="rounded-xl bg-gradient-to-r from-green-50/40 to-transparent border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-green-100 text-green-700 text-[9px] font-bold flex items-center justify-center">1</span>
        {zh ? '受众' : 'Audience'}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <select value={cdbFilterFor('audienceLocation').value} onChange={e => updateCdbFilter('audienceLocation', { value: e.target.value })} className={fCls}>
          <option value="">{zh ? '受众所在地' : 'Audience location'}</option>
          {COUNTRY_FILTER_OPTIONS.map(({ code, key }) => <option key={code} value={code}>{(t.signupBusiness.countries as Record<string, string>)[key] || code}</option>)}
        </select>
        <select value={cdbFilterFor('mainLanguage').value} onChange={e => updateCdbFilter('mainLanguage', { value: e.target.value })} className={fCls}>
          <option value="">{zh ? '语言' : 'Language'}</option>
          {CREATORDB_LANGUAGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={cdbFilterFor('audienceAge').value} onChange={e => updateCdbFilter('audienceAge', { value: e.target.value })} className={fCls}>
          <option value="">{zh ? '受众年龄' : 'Audience age'}</option>
          {['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map(age => <option key={age} value={age}>{age}</option>)}
        </select>
        <select value={cdbFilterFor('audienceGender').value} onChange={e => updateCdbFilter('audienceGender', { value: e.target.value })} className={fCls}>
          <option value="">{zh ? '受众性别' : 'Audience gender'}</option>
          <option value="female">{zh ? '女性为主' : 'Mostly female'}</option>
          <option value="male">{zh ? '男性为主' : 'Mostly male'}</option>
        </select>
      </div>
    </div>

    {/* Section 2 — Creator */}
    <div className="rounded-xl bg-gradient-to-r from-blue-50/40 to-transparent border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center">2</span>
        {zh ? '创作者' : 'Creator'}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <select value={platform} onChange={e => setPlatform(e.target.value)} className={fCls}>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
        <select value={creatorCountry} onChange={e => setCreatorCountry(e.target.value)} className={fCls}>
          <option value="">{zh ? '创作者所在国' : "Creator's country"}</option>
          {COUNTRY_FILTER_OPTIONS.map(({ code, key }) => <option key={code} value={code}>{(t.signupBusiness.countries as Record<string, string>)[key] || code}</option>)}
        </select>
        <input type="text" value={cdbFilterFor('hashtags').value} onChange={e => updateCdbFilter('hashtags', { op: 'in', value: e.target.value })} placeholder={zh ? '标签（可选）' : 'Hashtags'} className={fCls} />
        <input type="text" value={cdbFilterFor('niches').value} onChange={e => updateCdbFilter('niches', { op: 'in', value: e.target.value })} placeholder={zh ? '领域' : 'Niche'} className={fCls} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
        <select value={minFollowers} onChange={e => setMinFollowers(e.target.value)} className={fCls}>
          <option value="">{zh ? '最少粉丝' : 'Min followers'}</option>
          <option value="1000">1,000</option>
          <option value="5000">5,000</option>
          <option value="10000">10,000</option>
          <option value="25000">25,000</option>
          <option value="50000">50,000</option>
          <option value="100000">100,000</option>
          <option value="500000">500,000</option>
          <option value="1000000">1,000,000</option>
        </select>
        <select value={maxFollowers} onChange={e => setMaxFollowers(e.target.value)} className={fCls}>
          <option value="">{zh ? '最多粉丝' : 'Max followers'}</option>
          <option value="5000">5,000</option>
          <option value="10000">10,000</option>
          <option value="25000">25,000</option>
          <option value="50000">50,000</option>
          <option value="100000">100,000</option>
          <option value="500000">500,000</option>
          <option value="1000000">1,000,000</option>
          <option value="10000000">10,000,000</option>
        </select>
        <select value={cdbFilterFor('lastPublishTime').value} onChange={e => updateCdbFilter('lastPublishTime', { op: '>', value: e.target.value })} className={fCls}>
          <option value="">{zh ? '最近活跃' : 'Last active'}</option>
          <option value="90">{zh ? '近3个月' : 'Last 3 months'}</option>
          <option value="180">{zh ? '近6个月' : 'Last 6 months'}</option>
          <option value="365">{zh ? '近1年' : 'Last year'}</option>
        </select>
        <select value={cdbFilterFor('isAccountVerified').value} onChange={e => updateCdbFilter('isAccountVerified', { value: e.target.value })} className={fCls}>
          <option value="">{zh ? '认证账号' : 'Verified'}</option>
          <option value="true">{zh ? '是' : 'Yes'}</option>
          <option value="false">{zh ? '否' : 'No'}</option>
        </select>
      </div>
    </div>

    {/* Section 3 — Performance */}
    <div className="rounded-xl bg-gradient-to-r from-amber-50/40 to-transparent border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold flex items-center justify-center">3</span>
        {zh ? '数据表现' : 'Performance'}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input type="number" min={0} step="0.1" value={cdbFilterFor('shortEngagementRate').value} onChange={e => updateCdbFilter('shortEngagementRate', { op: '>', value: e.target.value })} placeholder={zh ? '最低互动率 %' : 'Min engagement %'} className={fCls} />
        <input type="number" min={0} value={cdbFilterFor('shortAvgViews').value} onChange={e => updateCdbFilter('shortAvgViews', { op: '>', value: e.target.value })} placeholder={zh ? '最低平均播放量' : 'Min avg views'} className={fCls} />
      </div>
    </div>
  </>

  if (tab === 'detail') {
    const category = campaign.categories.map(c => c.category.name).join(' & ') || 'Campaign'
    const platforms = campaign.platforms.map(p => p.platform.name).join(', ') || m.allPlatforms
    const remaining = Math.max(0, campaign.totalSlots - campaign.filledSlots)
    const progress = campaign.totalSlots ? Math.min(100, (campaign.filledSlots / campaign.totalSlots) * 100) : 0
    const requirements = [
      ...(campaign.followerRequirements || []).map(r =>
        m.minFollowersReq.replace('{count}', compact(r.minFollowers)).replace('{platform}', r.platform.name) +
        (r.minEngagementRate ? m.engagementSuffix.replace('{rate}', String(Number(r.minEngagementRate))) : '')
      ),
      campaign.hashtagsRequired ? m.requiredHashtags + campaign.hashtagsRequired : null,
      campaign.mentionsRequired ? m.requiredMentions + campaign.mentionsRequired : null,
    ].filter(Boolean) as string[]
    const statusLabel = (m.statusLabels as Record<string,string>)[campaign.status] || campaign.status.toLowerCase().replaceAll('_', ' ')
    return <div className="campaign-manage max-w-[1500px] mx-auto workspace-page-tight pb-8 text-[#17255f]">
      <div className="flex items-center gap-2 text-sm text-[#6272a4] mb-5"><Link href="/dashboard/brand/campaigns">{m.breadcrumbPipeline}</Link><span>›</span><b className="text-[#17255f]">{campaign.title}</b></div>
      {campaignTabs}
      {campaign.status === 'DRAFT' && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">📝 {t.brand.campaigns.draftBannerTitle}</p>
            <p className="text-sm text-amber-700 mt-0.5">{t.brand.campaigns.draftBannerDesc}</p>
            {submitError && <p className="text-sm text-red-600 mt-1">{submitError}</p>}
          </div>
          <button
            type="button"
            onClick={submitForReview}
            disabled={submitting}
            className="flex-shrink-0 px-5 py-2.5 bg-primary-600 text-white rounded-full text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50"
          >
            {submitting ? '…' : t.brand.campaigns.submitForReview}
          </button>
        </div>
      )}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
        <div className="min-w-0 space-y-4">
          <header>
            <h1 className="text-4xl font-bold tracking-tight">{campaign.title}</h1>
            <p className="text-[#6876a1] mt-1">{m.subtitle}</p>
            <div className="flex flex-wrap gap-5 items-center mt-5 text-sm">
              <span className="px-4 py-2 rounded-full bg-violet-50 text-violet-700 font-semibold">✦ &nbsp;{category}</span>
              <span>▣ &nbsp; {m.posted} {new Date(campaign.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span>▣ &nbsp; {m.deadline} {campaign.deadline ? new Date(campaign.deadline).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : m.flexible}</span>
              <span className={`px-4 py-2 rounded-full font-semibold capitalize ${campaign.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 border border-dashed border-gray-400' : 'bg-violet-100 text-violet-700'}`}>● &nbsp;{statusLabel}</span>
            </div>
          </header>

          <div className="h-72 md:h-[360px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#f3e4d9] to-[#ead4c5]">{cover ? <img src={cover} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex flex-col items-center justify-center text-[#947f79]"><span className="text-7xl">✦</span><span className="mt-3">{m.campaignCover}</span></div>}</div>

          <section className="workspace-glass-card rounded-3xl p-6">
            <h2 className="text-xl font-bold">{m.aboutTitle}</h2>
            {campaign.description
              ? <Markdown className="text-sm leading-6 text-[#59678f] mt-2">{campaign.description}</Markdown>
              : <p className="text-sm leading-6 text-[#59678f] mt-2">{m.noDescription}</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6 pt-5 border-t border-white/60 text-sm">
              <div><p className="text-[#7884a8]">{m.platforms}</p><b>{platforms}</b></div>
              <div><p className="text-[#7884a8]">{m.creatorType}</p><b>{category}{m.creatorsSuffix}</b></div>
              <div><p className="text-[#7884a8]">{m.campaignPeriod}</p><b>{campaign.campaignStartDate ? new Date(campaign.campaignStartDate).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US') : m.flexible}</b></div>
              <div><p className="text-[#7884a8]">{m.compensation}</p><b>{budget}</b></div>
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="workspace-glass-card rounded-3xl p-6"><h2 className="text-xl font-bold mb-4">{m.requirements}</h2>{requirements.length ? <ul className="space-y-3 text-sm text-[#59678f]">{requirements.map(r => <li key={r} className="flex gap-2"><span className="text-violet-500">●</span>{r}</li>)}</ul> : <p className="text-sm text-[#7884a8]">{m.noRequirements}</p>}</section>
            <section className="workspace-glass-card rounded-3xl p-6"><h2 className="text-xl font-bold mb-4">{m.deliverables}</h2><div className="flex gap-3"><span className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">▣</span><div><b>{campaign.contentType ? campaign.contentType.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()) : m.campaignContent}</b><p className="text-sm text-[#66739a] mt-1 whitespace-pre-line">{campaign.contentGuidelines || m.deliverablesNote}</p></div></div></section>
          </div>

          <section className="workspace-glass-card rounded-3xl p-6 flex gap-5"><span className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">▣</span><div className="grid md:grid-cols-3 gap-6 flex-1 text-sm"><div><p className="text-[#7884a8]">{m.applicationWindow}</p><b>{campaign.deadline ? `${m.until}${new Date(campaign.deadline).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}` : m.openEnded}</b></div><div><p className="text-[#7884a8]">{m.contentDue}</p><b>{campaign.campaignEndDate ? new Date(campaign.campaignEndDate).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US') : m.toBeConfirmed}</b></div><div><p className="text-[#7884a8]">{m.notes}</p><b>{campaign.hashtagsRequired || m.managedByOverseed}</b></div></div></section>
        </div>

        <aside className="workspace-glass-card rounded-3xl p-7 xl:sticky xl:top-5">
          <div className="flex justify-between"><b>{m.status}</b><span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${campaign.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 border border-dashed border-gray-400' : 'bg-violet-100 text-violet-700'}`}>● &nbsp;{statusLabel}</span></div>
          <div className="mt-7"><p className="text-sm text-[#7180ad]">{m.compensation}</p><div className="flex justify-between items-end mt-2"><b className="text-2xl capitalize">{campaign.compensationType.toLowerCase().replaceAll('_',' ')}</b>{campaign.giftValue && <div className="text-right"><p className="text-xs text-[#7180ad]">{m.giftValue}</p><b className="text-xl">${formatNumber(Number(campaign.giftValue), locale)}</b></div>}</div></div>
          <div className="border-t border-white/70 mt-6 pt-6 space-y-5"><div className="flex justify-between"><span>{m.applications}</span><b>{stats.total}</b></div><div><div className="flex justify-between"><span>{m.spotsFilled}</span><b>{campaign.filledSlots} / {campaign.totalSlots}</b></div><div className="h-2 bg-slate-200/70 rounded-full mt-3"><div className="h-full bg-blue-500 rounded-full" style={{width:`${progress}%`}}/></div><p className="text-xs text-[#7884a8] mt-2">{m.spotsRemaining.replace('{count}', String(remaining))}</p></div><div className="flex justify-between border-t border-white/70 pt-5"><span>{m.views}</span><b>{campaign.viewCount}</b></div></div>
          <div className="space-y-3 mt-7"><Link href={`/dashboard/brand/campaigns/${campaign.id}/applications`} className="block text-center py-4 rounded-xl bg-blue-600 text-white font-semibold">{m.viewApplications}</Link><Link href={`/dashboard/brand/campaigns/${campaign.id}/edit`} className="block text-center py-4 rounded-xl border border-white bg-white/25 font-semibold">{m.editCampaign}</Link><button type="button" onClick={() => setShowDelete(true)} className="block w-full text-center py-4 rounded-xl border border-red-200 bg-red-50/60 text-red-600 font-semibold hover:bg-red-100 transition">{m.deleteCampaign}</button></div>
          <div className="border-t border-white/70 mt-7 pt-6"><p className="text-xs text-[#7884a8]">{m.campaignOwner}</p><div className="flex gap-3 items-center mt-3"><span className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center font-bold overflow-hidden">{campaign.brand?.logoUrl ? <img src={campaign.brand.logoUrl} alt="" className="w-full h-full object-cover"/> : (campaign.brand?.companyName || 'B').slice(0, 2).toUpperCase()}</span><div><b>{campaign.brand?.companyName || 'Brand'}</b><p className="text-xs text-[#7884a8]">{m.brandAccount}</p></div></div></div>
        </aside>
      </div>
      {deleteModal}
    </div>
  }

  const directStatusLabel = (s: string) => (m.statusLabels as Record<string,string>)[s] || s.toLowerCase().replace('_', ' ')

  return <div className="campaign-manage max-w-[1500px] mx-auto workspace-page-tight pb-8 text-[#17255f]">
    <div className="mb-5">
      <h1 className="text-3xl font-bold tracking-tight">{m.breadcrumbPipeline}</h1>
      <div className="flex items-center gap-2 mt-2 text-sm text-[#6272a4]">
        <Link href="/dashboard/brand/campaigns">{m.breadcrumbPipeline}</Link><span>›</span><span>{campaign.title}</span><span>›</span><b className="text-[#17255f]">{m.breadcrumbManage}</b>
      </div>
    </div>

    {campaignTabs}
    <section className="workspace-glass-card rounded-3xl p-4 md:p-5 mb-4 flex flex-col md:flex-row md:items-center gap-5">
      <div className="w-full md:w-40 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-[#f2e9dd] to-[#d9c4ae]">{cover ? <img src={cover} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl">✦</div>}</div>
      <div className="flex-1">
        <h2 className="text-xl font-bold">{campaign.title}</h2>
        <p className="text-sm text-[#7180ad] mt-1">{campaign.categories.map(c => c.category.name).join(', ') || 'Lifestyle'} &nbsp;·&nbsp; {campaign.platforms.map(p => p.platform.name).join(', ') || m.allPlatforms}</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-7 mt-4 max-w-2xl">
          <div><p className="text-xs text-[#7f8bb1]">{m.budget}</p><b>{budget}</b></div>
          <div><p className="text-xs text-[#7f8bb1]">{m.deadline}</p><b>{campaign.deadline ? new Date(campaign.deadline).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : m.flexible}</b></div>
          <div><p className="text-xs text-[#7f8bb1]">{m.status}</p><span className="inline-flex mt-1 px-3 py-1 rounded-md bg-slate-100 text-xs font-semibold capitalize">{directStatusLabel(campaign.status)}</span></div>
        </div>
      </div>
      <Link href={`/dashboard/brand/campaigns/${campaign.id}/edit`} className="rounded-2xl border border-white/80 bg-white/40 px-6 py-3 font-semibold text-sm">{m.viewCampaignDetails}&nbsp;→</Link>
    </section>

    <div className="grid xl:grid-cols-[minmax(0,1fr)_390px] gap-4 items-start">
      <div className="min-w-0">
        <>
          <section className="workspace-glass-card rounded-3xl p-5 mb-4">
            <div className="flex gap-4 items-center"><div className="w-12 h-12 rounded-2xl bg-white/70 text-indigo-600 flex items-center justify-center">{icon(sparkle)}</div><div className="flex-1"><b>{m.contactManaged}</b><p className="text-sm text-[#7180ad] mt-1">{m.shortlistDesc}</p></div><span className="hidden md:block text-sm font-semibold">{m.learnHow}&nbsp;→</span></div>
            <div className="mt-5 grid md:grid-cols-4 gap-2 bg-white/25 rounded-2xl p-3 text-sm">{[[m.stepShortlist,m.stepShortlistDesc],[m.stepOutreach,m.stepOutreachDesc],[m.stepResponse,m.stepResponseDesc],[m.stepCollab,m.stepCollabDesc]].map(([a,b], i) => <div key={a} className="flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-white/75 flex items-center justify-center text-indigo-500">{i+1}</span><div><b>{a}</b><p className="text-xs text-[#7d88aa]">{b}</p></div>{i<3 && <span className="ml-auto hidden md:block">→</span>}</div>)}</div>
          </section>

          {/* Search + filters only appear after the AI recommendation ran */}
          {matched && (
          <form onSubmit={e => { e.preventDefault(); discover(query) }} className="mb-4">
            <div className="flex gap-2"><div className="workspace-glass-control flex-1 flex items-center gap-3 px-4 py-3">{icon(searchIcon, 'w-4 h-4')}<input value={query} onChange={e => setQuery(e.target.value)} className="bg-transparent outline-none w-full" placeholder={d.searchByNamePlaceholder}/></div><button className="px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold">{d.searchButton}</button></div>
            <div className="space-y-2 mt-3">
              {filterSections}
              <button type="button" onClick={() => { setQuery(''); setCreatorCountry(''); setMinFollowers(''); setMaxFollowers(''); setCdbFilters([]); setCreators([]); setMatched(false); try { sessionStorage.removeItem(searchStateKey) } catch {} }} className="px-3 py-1 text-sm text-[#65739e]">{d.clearAll}</button>
            </div>
          </form>
          )}
          {error && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          {!matched && (
            <section className="workspace-glass-card rounded-3xl px-6 py-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/70 text-indigo-600 flex items-center justify-center text-2xl">✨</div>
              <h3 className="font-bold text-xl mt-4">{m.aiMatchTitle}</h3>
              <p className="text-sm text-[#7180ad] mt-2 max-w-lg mx-auto">{m.aiMatchDesc}</p>
              <div className="mt-5 mx-auto max-w-lg grid sm:grid-cols-3 gap-2 text-xs text-[#5f6c95]">
                {[m.aiMatchStep1, m.aiMatchStep2, m.aiMatchStep3].map((s, i) => (
                  <div key={s} className="bg-white/40 rounded-xl px-3 py-2.5">
                    <span className="text-indigo-500 font-bold">{i + 1}.</span> {s}
                  </div>
                ))}
              </div>
              <form
                className="mt-6 mx-auto max-w-xl"
                onSubmit={(e) => { e.preventDefault(); aiMatch() }}
              >
                <div className="workspace-glass-control flex items-center gap-3 px-4 py-3 text-left">
                  {icon(searchIcon, 'w-4 h-4 shrink-0 text-[#7d88aa]')}
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={d.searchPlaceholder}
                    className="bg-transparent outline-none w-full text-sm"
                  />
                </div>
              </form>
              <div className="mt-4 mx-auto max-w-2xl space-y-2">
                <p className="text-xs text-[#7d88aa] mb-2">{m.aiMatchFiltersNote}</p>
                {filterSections}
              </div>
              <button
                type="button"
                onClick={aiMatch}
                disabled={aiMatching}
                className="mt-6 px-8 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold disabled:opacity-50"
              >
                ✨ {aiMatching ? m.aiMatchLoading : m.aiMatchButton}
                {!aiMatching && searchPrice != null && (
                  <span className="font-normal"> · {d.creditsN.replace('{n}', String(searchPrice))}</span>
                )}
              </button>
              {searchPrice != null && (
                <p className="mt-3 text-xs text-[#7d88aa] max-w-md mx-auto">
                  {m.aiMatchCostNote.replace('{n}', String(searchPrice))}
                </p>
              )}
            </section>
          )}
          {matched && (<>
          <div className="flex items-center justify-between mb-3"><b>{loading ? m.findingCreators : m.creatorsFound.replace('{count}', String(creators.length))}</b><span className="text-sm text-[#7180ad]">{m.sortBy}<b>{m.relevance}</b></span></div>
          <div className={`grid md:grid-cols-2 2xl:grid-cols-3 gap-3 transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
            {creators.map(c => <article key={c.id} className="workspace-glass-card rounded-3xl p-5 min-h-64 flex flex-col">
              <div className="flex gap-3 items-center">{avatar(c)}<div className="min-w-0"><button onClick={() => openCreator(c)} className="font-bold truncate block max-w-full text-left hover:text-indigo-600">{c.display_name || c.handle || 'Creator'} <span className="text-indigo-500">●</span></button><p className="text-xs text-[#7581a5] truncate">@{c.handle?.replace(/^@/, '') || 'creator'}</p><span className="text-xs mt-1 inline-block px-2 py-0.5 rounded bg-white/50">{PLATFORM_LABEL[c.platform] || c.platform}</span>{(c.country || c.language) && <p className="text-xs text-[#7581a5] mt-1 truncate">{[c.country, c.language ? (CREATORDB_LANGUAGE_OPTIONS.find(([code]) => code === c.language)?.[1] || c.language) : null].filter(Boolean).join(' · ')}</p>}</div></div>
              <div className="grid grid-cols-2 gap-4 mt-5"><div><b className="text-xl">{compact(c.follower_count)}</b><p className="text-xs text-[#7d88aa]">{m.followers}</p></div><div><b className="text-xl">{c.engagement_rate == null ? '—' : `${Number(c.engagement_rate).toFixed(1)}%`}</b><p className="text-xs text-[#7d88aa]">{m.engRate}</p></div></div>
              <div className="flex flex-wrap gap-1 mt-4">{c.niche_tags.slice(0,3).map(t => <span key={t} className="text-xs bg-white/50 rounded-full px-2.5 py-1">{t}</span>)}</div>
              <div className="flex gap-2 mt-auto pt-5"><button onClick={() => openCreator(c)} className="flex-1 py-2 rounded-xl border border-white bg-white/25 text-sm font-semibold">{m.viewProfile}</button><button disabled={queuedIds.has(c.id) || queueBusy} onClick={() => addCreator(c)} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white text-sm font-semibold disabled:opacity-50">{queuedIds.has(c.id) ? m.added : m.addToCampaign}</button></div>
            </article>)}
          </div>
          </>)}
        </>
      </div>

      <aside className="workspace-glass-card rounded-3xl p-5 xl:sticky xl:top-5">
        <div className="flex justify-between items-center"><h2 className="text-xl font-bold">{m.outreachQueue} <span className="text-sm border border-white rounded-lg px-2 py-1 ml-1">{queue.length}</span></h2><span>⌃</span></div>
        <p className="text-sm text-[#7180ad] mt-1">{m.queueDesc}</p>
        <div className="space-y-4 mt-6 max-h-[430px] overflow-auto pr-1">{queue.length === 0 && <div className="py-10 text-center text-sm text-[#7b87aa]">{m.queueEmpty}</div>}{queue.map(q => <div key={q.id} className="flex items-center gap-3">{avatar(q, 'w-10 h-10')}<div className="min-w-0 flex-1"><b className="block truncate text-sm">{q.displayName || q.handle || 'Creator'}</b><p className="text-xs text-[#7e89aa] truncate">@{q.handle?.replace(/^@/, '')}</p></div><span className={`text-[10px] whitespace-nowrap px-2.5 py-1.5 rounded-lg ${STATUS_STYLE[q.status] || STATUS_STYLE.SHORTLISTED}`}>{q.status.replaceAll('_',' ').toLowerCase()}</span>{q.status === 'SHORTLISTED' && <button onClick={() => removeCreator(q.id)} className="text-[#7180ad]">×</button>}</div>)}</div>
        <div className="mt-6 bg-indigo-50/60 rounded-2xl p-4 text-sm"><b>ⓘ &nbsp;{m.aboutOutreach}</b><p className="text-xs text-[#6775a0] mt-2">{m.aboutOutreachDesc}</p></div>
        <button disabled={!queue.some(q => q.status === 'SHORTLISTED') || queueBusy} onClick={requestOutreach} className="w-full mt-5 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold disabled:opacity-50">✈ &nbsp; {m.requestOutreach}</button>
        <p className="text-center text-xs text-[#7d88aa] mt-3">{m.reviewQueueNote}</p>
      </aside>
    </div>

    {selected && <div className="fixed inset-0 z-50 bg-[#18204b]/35 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}><div className="bg-[#fbfbff] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-auto" onClick={e => e.stopPropagation()}>
      <div className="p-7 flex justify-between"><div className="flex gap-5">{avatar(selected, 'w-24 h-24')}<div><h2 className="text-2xl font-bold">{selected.display_name || selected.handle} <span className="text-indigo-500">●</span></h2><p className="text-[#7180ad]">@{selected.handle?.replace(/^@/,'')}</p><p className="text-sm mt-2">{PLATFORM_LABEL[selected.platform]} {selected.country && ` · ${selected.country}`}</p></div></div><button onClick={() => setSelected(null)} className="text-2xl self-start">×</button></div>
      <div className="px-7 grid grid-cols-2 md:grid-cols-4 gap-3">{[[m.followers,compact(detail?.total_followers ?? selected.follower_count)],[m.modalEngagement,selected.engagement_rate == null ? '—' : `${Number(selected.engagement_rate).toFixed(1)}%`],[m.modalCountry,detail?.location || selected.country || '—'],[m.modalMatchScore,selected.score == null ? '—' : `${Math.round(selected.score)}%`]].map(([k,v]) => <div key={k} className="border border-slate-100 rounded-2xl p-4"><b className="text-xl">{v}</b><p className="text-xs text-[#7d88aa] mt-1">{k}</p></div>)}</div>
      <div className="p-7"><h3 className="font-bold">{m.modalAbout}</h3><p className="text-sm leading-6 text-[#5f6c95] mt-2">{detailLoading ? m.loadingProfile : detail?.bio || selected.bio || m.profileFallback}</p><div className="flex flex-wrap gap-2 mt-4">{(detail?.niche || selected.niche_tags).slice(0,8).map((t:string) => <span key={t} className="bg-gray-200 text-gray-700 rounded-full px-3 py-1 text-xs">{t}</span>)}</div></div>
      <div className="border-t border-slate-100 p-5 flex items-center gap-3 justify-between"><div className="text-xs text-[#7180ad]">🛡 {m.businessContactNote}<br/>{m.neverSharedNote}</div><button disabled={queuedIds.has(selected.id) || queueBusy} onClick={() => addCreator(selected)} className="px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold disabled:opacity-50">{queuedIds.has(selected.id) ? m.addedToQueue : m.addToQueue}</button></div>
    </div></div>}
  </div>
}
