'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatNumber } from '@/lib/i18n/formatNumber'
import {
  COUNTRY_FILTER_OPTIONS,
  MultiSelectFilter,
  NicheAutocomplete,
  NicheTags,
} from '@/components/discovery/DiscoverPanel'
import {
  CREATORDB_LANGUAGE_OPTIONS,
} from '@/lib/creatordb-filter-fields'
import Markdown from '@/components/Markdown'
import CreatorAvatar from '@/components/ui/CreatorAvatar'

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

function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  switch (platform) {
    case 'instagram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Instagram">
          <defs>
            <radialGradient id="cdb-ig-grad" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#d6249f" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#cdb-ig-grad)" />
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
    default:
      return null
  }
}
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
  const [tab, setTabRaw] = useState<'detail' | 'direct'>('detail')
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`campaign-tab:${initialCampaign.id}`)
      if (saved === 'direct') setTabRaw('direct')
    } catch {}
  }, [initialCampaign.id])
  const setTab = (t: 'detail' | 'direct') => {
    setTabRaw(t)
    try { sessionStorage.setItem(`campaign-tab:${initialCampaign.id}`, t) } catch {}
  }
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
  const [outreachModalCreator, setOutreachModalCreator] = useState<Creator | null>(null)
  const [outreachMsg, setOutreachMsg] = useState('')
  const [outreachFiles, setOutreachFiles] = useState<File[]>([])
  const [outreachSending, setOutreachSending] = useState(false)
  const [outreachSent, setOutreachSent] = useState(false)
  const [outreachError, setOutreachError] = useState<string | null>(null)
  const [rememberMsg, setRememberMsg] = useState(false)
  const [rememberedMsg, setRememberedMsg] = useState('')
  const [rememberedFiles, setRememberedFiles] = useState<File[]>([])
  const [nicheMap, setNicheMap] = useState<Record<string, string[]>>({})
  const [nichesLoading, setNichesLoading] = useState(false)
  const [followerTierMode, setFollowerTierMode] = useState('')
  const [openFilterSections, setOpenFilterSections] = useState<Record<string, boolean>>({
    audience: true, creator: true, performance: true,
  })
  const toggleFilterSection = (key: string) => setOpenFilterSections(prev => ({ ...prev, [key]: !prev[key] }))

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
      if (['hashtags', 'niches', 'audienceAge', 'audienceLocation', 'mainLanguage'].includes(field)) {
        filters.push({ field, op: 'in', value: f.value.split(',').map(v => v.trim()).filter(Boolean) })
      } else if (field === 'audienceFemaleRatio') {
        filters.push({ field, op: '>', value: Number(f.value) })
      } else if (field === 'isAccountVerified') {
        filters.push({ field, op: '=', value: f.value === 'true' })
      } else if (['followers', 'shortEngagementRate', 'shortAvgViews', 'lastPublishTime', 'followerGrowth30d', 'contentsIn30Days'].includes(field)) {
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
      const countries = creatorCountry.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
      if (countries.length === 1) {
        filters.push({ field: 'country', op: '=', value: countries[0] })
      } else if (countries.length > 1) {
        filters.push({ field: 'country', op: 'in', value: countries })
      }
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
      // ── LOG: Campaign brief inputs ──
      console.group('[DirectOutreach] AI Match — Campaign Brief')
      console.log('Campaign ID:', campaign.id)
      console.log('Campaign Title:', campaign.title)
      console.log('Categories:', campaign.categories.map(c => c.category.name))
      console.log('Platforms:', campaign.platforms.map(p => p.platform.name))
      console.log('Follower requirements:', campaign.followerRequirements)
      console.log('Content type:', campaign.contentType)
      console.log('Description:', campaign.description?.slice(0, 200))
      console.log('User query:', query || '(none)')
      console.log('Pre-set filters — minFollowers:', minFollowers, 'maxFollowers:', maxFollowers, 'country:', creatorCountry)
      console.groupEnd()

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

      // ── LOG: Auto-derived filters ──
      console.group('[DirectOutreach] Auto-derived CDB filters from campaign')
      console.table(autoFilters)
      console.groupEnd()

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

      // ── LOG: Final filters sent to API ──
      console.group('[DirectOutreach] Final filters → /api/discovery/club-search')
      console.log('Filters:', JSON.stringify(filters, null, 2))
      console.groupEnd()

      const activePlatform = campPlatform && ['youtube', 'instagram', 'tiktok'].includes(campPlatform) ? campPlatform : platform
      const qs = new URLSearchParams({ platform: activePlatform, limit: '100', offset: '0', cdb_sort: 'followers' })
      qs.set('cdb_filters', JSON.stringify(filters))

      console.log('[DirectOutreach] Request URL:', `/api/discovery/club-search?platform=${activePlatform}&limit=100&offset=0&cdb_sort=followers`)

      const res = await fetch(`/api/discovery/club-search?${qs}`)
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)

      // ── LOG: Response summary ──
      console.group('[DirectOutreach] Search response')
      console.log('Status:', res.status)
      console.log('Total results:', data?.total)
      console.log('Returned results:', data?.results?.length)
      if (data?.results?.length > 0) {
        console.table(data.results.slice(0, 5).map((c: any) => ({
          handle: c.handle,
          display_name: c.display_name,
          followers: c.follower_count,
          engagement: c.engagement_rate,
          niches: c.niche_tags?.join(', '),
          country: c.country,
        })))
      }
      if (data?.ai_parsed) console.log('AI parsed params:', data.ai_parsed)
      console.groupEnd()

      if (!res.ok) throw new Error(data?.message || 'Creator matching is temporarily unavailable.')
      setCreators(data?.results || [])
      setMatched(true)
    } catch (e: any) { setError(e.message) }
    finally { setAiMatching(false) }
  }

  useEffect(() => { loadQueue() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch niche tags for displayed creators (same mechanism as DiscoverPanel)
  useEffect(() => {
    if (creators.length === 0) return
    const toFetch = creators
      .filter(c => c.handle && c.platform)
      .map(c => ({ platform: c.platform, handle: (c.handle || '').replace(/^@/, '').toLowerCase() }))
      .filter(c => !nicheMap[`${c.platform}:${c.handle}`])
    if (toFetch.length === 0) return
    setNichesLoading(true)
    fetch('/api/discovery/creator-niches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creators: toFetch }),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.niches) setNicheMap(prev => ({ ...prev, ...data.niches }))
      })
      .catch(() => {})
      .finally(() => setNichesLoading(false))
  }, [creators]) // eslint-disable-line react-hooks/exhaustive-deps
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

  const addCreator = async (creator: Creator, message?: string, files?: File[]) => {
    setQueueBusy(true); setError('')
    try {
      const fd = new FormData()
      fd.set('creator', JSON.stringify(creator))
      if (message) fd.set('message', message.trim())
      if (files) files.forEach((f) => fd.append('files', f))
      const res = await fetch(`/api/campaigns/${campaign.id}/outreach`, { method: 'POST', body: fd })
      const data = await res.json(); if (!res.ok) throw new Error(data.message)
      setQueue(data.queue); setSelected(null)
    } catch (e: any) { setError(e.message || 'Could not add creator') }
    finally { setQueueBusy(false) }
  }

  const addOutreachFiles = (list: FileList | null) => {
    if (!list) return
    setOutreachError(null)
    const next = [...outreachFiles]
    for (const f of Array.from(list)) {
      if (next.length >= 3) break
      if (f.size > 4 * 1024 * 1024) {
        setOutreachError(`"${f.name}" exceeds the 4MB limit`)
        continue
      }
      const total = next.reduce((sum, file) => sum + file.size, 0) + f.size
      if (total > 4 * 1024 * 1024) {
        setOutreachError('Attachments exceed 4MB combined — remove a file or use smaller ones')
        continue
      }
      next.push(f)
    }
    setOutreachFiles(next)
  }

  const sendOutreach = async () => {
    if (!outreachModalCreator || outreachMsg.trim().length < 10) return
    setOutreachSending(true)
    setOutreachError(null)
    try {
      const fd = new FormData()
      fd.set('creator', JSON.stringify(outreachModalCreator))
      fd.set('message', outreachMsg.trim())
      outreachFiles.forEach((f) => fd.append('files', f))
      const res = await fetch(`/api/campaigns/${campaign.id}/outreach`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || `Server error (${res.status})`)
      if (!data) throw new Error('Empty response from server')
      setQueue(data.queue)
      setOutreachSent(true)
      if (rememberMsg) {
        setRememberedMsg(outreachMsg.trim())
        setRememberedFiles([...outreachFiles])
      }
    } catch (err: any) {
      setOutreachError(err.message || 'Failed to send message')
    } finally {
      setOutreachSending(false)
    }
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
  const inputCls = 'px-3 py-1.5 workspace-glass-control text-sm focus:outline-none'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'
  const zh = locale === 'zh'
  const filterSections = <>
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
            <MultiSelectFilter
              value={cdbFilterFor('audienceLocation').value}
              onChange={(v) => updateCdbFilter('audienceLocation', { op: 'in', value: v })}
              options={COUNTRY_FILTER_OPTIONS.map(({ code, key }) => ({
                value: code,
                label: (t.signupBusiness.countries as Record<string, string>)[key] || code,
              }))}
              placeholder={zh ? '全部地区' : 'Anywhere'}
              inputCls={inputCls}
            />
          </div>
          {/* Language */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M12 22l5-10 5 10"/><path d="M14 18h6"/></svg>
                {zh ? '语言' : 'Language'}
              </span>
            </label>
            <MultiSelectFilter
              value={cdbFilterFor('mainLanguage').value}
              onChange={(v) => updateCdbFilter('mainLanguage', { op: 'in', value: v })}
              options={CREATORDB_LANGUAGE_OPTIONS.map(([value, langLabel]) => ({
                value,
                label: langLabel,
              }))}
              placeholder={zh ? '全部语言' : 'All languages'}
              inputCls={inputCls}
            />
          </div>
          {/* Audience age */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {zh ? '受众年龄' : 'Audience age'}
              </span>
            </label>
            <MultiSelectFilter
              value={cdbFilterFor('audienceAge').value}
              onChange={(v) => updateCdbFilter('audienceAge', { op: 'in', value: v })}
              options={['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((age) => ({
                value: age,
                label: age,
              }))}
              placeholder={zh ? '全部' : 'Any'}
              inputCls={inputCls}
            />
          </div>
          {/* Gender composition */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
                {zh ? '性别构成' : 'Gender'}
              </span>
            </label>
            {['instagram', 'tiktok', 'youtube'].includes(platform) ? (() => {
              const femaleVal = cdbFilterFor('audienceFemaleRatio').value
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
                      updateCdbFilter('audienceFemaleRatio', { op: '>', value: String(pct / 100) })
                      updateCdbFilter('audienceGender', { value: '' })
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
                        updateCdbFilter('audienceFemaleRatio', { value: '' })
                        updateCdbFilter('audienceGender', { value: '' })
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
                value={cdbFilterFor('audienceGender').value}
                onChange={(e) => updateCdbFilter('audienceGender', { value: e.target.value })}
                className={`w-full ${inputCls}`}
              >
                <option value="">{zh ? '全部' : 'Any'}</option>
                <option value="female">{zh ? '女性为主' : 'Mostly female'}</option>
                <option value="male">{zh ? '男性为主' : 'Mostly male'}</option>
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
          {/* Platform */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                {zh ? '平台' : 'Platform'}
              </span>
            </label>
            <select value={platform} onChange={e => setPlatform(e.target.value)} className={`w-full ${inputCls}`}>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </div>
          {/* Creator's country */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {zh ? '创作者所在国' : "Creator's country"}
              </span>
            </label>
            <MultiSelectFilter
              value={creatorCountry}
              onChange={setCreatorCountry}
              options={COUNTRY_FILTER_OPTIONS.map(({ code, key }) => ({
                value: code,
                label: (t.signupBusiness.countries as Record<string, string>)[key] || code,
              }))}
              placeholder={zh ? '全部国家' : 'Any country'}
              inputCls={inputCls}
            />
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
              value={cdbFilterFor('isAccountVerified').value}
              onChange={(e) => updateCdbFilter('isAccountVerified', { value: e.target.value })}
              className={`w-full ${inputCls}`}
            >
              <option value="">{zh ? '全部' : 'Any'}</option>
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
              value={cdbFilterFor('hashtags').value}
              onChange={(e) => updateCdbFilter('hashtags', { op: 'in', value: e.target.value })}
              placeholder={zh ? '如 #护肤, #旅行' : 'e.g. #skincare, #travel'}
              className={`w-full ${inputCls}`}
            />
          </div>
          {/* Niches */}
          <NicheAutocomplete
            platform={platform}
            value={cdbFilterFor('niches').value}
            onChange={(v) => updateCdbFilter('niches', { op: 'in', value: v })}
            labelCls={labelCls}
            inputCls={inputCls}
            zh={zh}
          />
          {/* Followers / subscribers */}
          <div className="col-span-2">
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {zh ? '粉丝数' : 'Followers / subscribers'}
              </span>
            </label>
            <div className="flex items-center gap-1.5">
              {minFollowers === 'custom' ? (
                <input
                  type="number"
                  min={0}
                  placeholder={zh ? '最少粉丝' : 'Min followers'}
                  autoFocus
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    setMinFollowers(v && Number(v) > 0 ? v : '')
                    setFollowerTierMode('custom')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = (e.target as HTMLInputElement).value.trim()
                      setMinFollowers(v && Number(v) > 0 ? v : '')
                      setFollowerTierMode('custom')
                    }
                  }}
                  className={`flex-1 ${inputCls}`}
                />
              ) : (
                <select
                  value={minFollowers}
                  onChange={(e) => { setMinFollowers(e.target.value); setFollowerTierMode('custom') }}
                  className={`flex-1 ${inputCls}`}
                >
                  <option value="">{zh ? '不限' : 'Any'}</option>
                  {[1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000].map((n) => (
                    <option key={n} value={String(n)}>{n.toLocaleString()}</option>
                  ))}
                  <option value="custom">{zh ? '自定义...' : 'Custom...'}</option>
                </select>
              )}
              <span className="text-gray-400 font-medium text-sm">–</span>
              {maxFollowers === 'custom' ? (
                <input
                  type="number"
                  min={0}
                  placeholder={zh ? '最多粉丝' : 'Max followers'}
                  autoFocus
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    setMaxFollowers(v && Number(v) > 0 ? v : '')
                    setFollowerTierMode('custom')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = (e.target as HTMLInputElement).value.trim()
                      setMaxFollowers(v && Number(v) > 0 ? v : '')
                      setFollowerTierMode('custom')
                    }
                  }}
                  className={`flex-1 ${inputCls}`}
                />
              ) : (
                <select
                  value={maxFollowers}
                  onChange={(e) => { setMaxFollowers(e.target.value); setFollowerTierMode('custom') }}
                  className={`flex-1 ${inputCls}`}
                >
                  <option value="">{zh ? '不限' : 'Any'}</option>
                  {[5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000, 10000000].map((n) => (
                    <option key={n} value={String(n)}>{n.toLocaleString()}</option>
                  ))}
                  <option value="custom">{zh ? '自定义...' : 'Custom...'}</option>
                </select>
              )}
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
              value={cdbFilterFor('lastPublishTime').value}
              onChange={(e) => {
                const v = e.target.value
                if (v === '-365') {
                  updateCdbFilter('lastPublishTime', { op: '<', value: v })
                } else {
                  updateCdbFilter('lastPublishTime', { op: '>', value: v })
                }
              }}
              className={`w-full ${inputCls}`}
            >
              <option value="">{zh ? '全部' : 'Any'}</option>
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
                value={cdbFilterFor('shortAvgViews').value}
                onChange={(e) => updateCdbFilter('shortAvgViews', { op: '>', value: e.target.value })}
                placeholder={zh ? '如 5,000' : 'e.g. 5,000'}
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
                value={cdbFilterFor('shortEngagementRate').value}
                onChange={(e) => updateCdbFilter('shortEngagementRate', { op: '>', value: e.target.value })}
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
                value={cdbFilterFor('followerGrowth30d').value}
                onChange={(e) => updateCdbFilter('followerGrowth30d', { op: '>', value: e.target.value })}
                placeholder={zh ? '如 500' : 'e.g. 500'}
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
                value={cdbFilterFor('contentsIn30Days').value}
                onChange={(e) => updateCdbFilter('contentsIn30Days', { op: '>', value: e.target.value })}
                placeholder={zh ? '如 5' : 'e.g. 5'}
                className={`w-full ${inputCls}`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{zh ? '≥ 条' : '≥ posts'}</span>
            </div>
          </div>
        </div>
      )}
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

          <div className="h-72 md:h-[360px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#f3e4d9] to-[#ead4c5]">{cover ? <img src={cover} alt="" className="w-full h-full object-contain"/> : <div className="w-full h-full flex flex-col items-center justify-center text-[#947f79]"><span className="text-7xl">✦</span><span className="mt-3">{m.campaignCover}</span></div>}</div>

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
          <div className={`space-y-3 transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
            {creators.map(c => {
              const handle = (c.handle || '').replace(/^@/, '').toLowerCase()
              const creatorKey = handle ? `${c.platform}:${handle}` : null
              return (
              <div key={c.id} className="workspace-glass-card rounded-2xl p-5">
                {/* Top section: avatar + info + platform link */}
                <div className="flex gap-4">
                  {/* Avatar with gradient ring */}
                  <div className="flex-shrink-0">
                    <div className="w-[80px] h-[80px] rounded-full p-[3px] bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600">
                      <div className="w-full h-full rounded-full bg-white p-[2px]">
                        <div className="w-full h-full rounded-full bg-gray-100 overflow-hidden">
                          <CreatorAvatar url={c.avatar_url} name={c.display_name || c.handle || '?'} size="w-full h-full" textSize="text-xl" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Name, handle, niche tags */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-extrabold text-lg text-gray-900 truncate leading-tight uppercase tracking-wide">
                          {c.display_name || c.handle || c.id}
                        </p>
                        {c.handle && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-sm text-gray-400">@{c.handle.replace(/^@/, '')}</p>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.handle?.replace(/^@/, '') || '') }}
                              className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                              title={zh ? '复制' : 'Copy handle'}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Platform link */}
                      {c.profile_url && (
                        <a
                          href={c.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50 transition flex-shrink-0"
                        >
                          <PlatformIcon platform={c.platform} size={16} />
                          {PLATFORM_LABEL[c.platform] || c.platform}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                          </svg>
                        </a>
                      )}
                    </div>
                    {/* Niche tags (fetched separately like discovery) */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <NicheTags creatorKey={creatorKey} nicheMap={nicheMap} loading={nichesLoading} />
                    </div>
                  </div>
                </div>

                {/* Bottom row: followers + actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100/80">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    <span className="text-lg font-bold text-gray-900">{c.follower_count != null ? new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US').format(c.follower_count) : '—'}</span>
                    <span className="text-sm text-gray-400">{zh ? '粉丝' : 'followers'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => openCreator(c)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-400 to-slate-400 text-white rounded-full text-sm font-semibold hover:from-indigo-500 hover:to-slate-500 transition shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      {zh ? '查看资料' : 'View Profile'}
                    </button>
                    <button
                      type="button"
                      disabled={queuedIds.has(c.id) || queueBusy}
                      onClick={() => {
                        setOutreachModalCreator(c)
                        setOutreachMsg(rememberMsg && rememberedMsg ? rememberedMsg : '')
                        setOutreachFiles([])
                        setOutreachSent(false)
                        setOutreachError(null)
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 border border-indigo-200 text-indigo-600 rounded-full text-sm font-semibold hover:bg-indigo-50 transition disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      {queuedIds.has(c.id) ? (zh ? '已添加' : m.added) : (zh ? '联系' : 'Contact')}
                    </button>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
          </>)}
        </>
      </div>

      <aside className="workspace-glass-card rounded-3xl p-5 xl:sticky xl:top-5">
        <div className="flex justify-between items-center"><h2 className="text-xl font-bold">{m.outreachQueue} <span className="text-sm border border-white rounded-lg px-2 py-1 ml-1">{queue.length}</span></h2><span>⌃</span></div>
        <p className="text-sm text-[#7180ad] mt-1">{m.queueDesc}</p>
        <div className="space-y-4 mt-6 max-h-[430px] overflow-auto pr-1">{queue.length === 0 && <div className="py-10 text-center text-sm text-[#7b87aa]">{m.queueEmpty}</div>}{queue.map(q => <div key={q.id} className="flex items-center gap-3"><CreatorAvatar url={q.avatarUrl} name={q.displayName || q.handle || 'Creator'} size="w-10 h-10" textSize="text-xs" /><div className="min-w-0 flex-1"><b className="block truncate text-sm">{q.displayName || q.handle || 'Creator'}</b><p className="text-xs text-[#7e89aa] truncate">@{q.handle?.replace(/^@/, '')}</p></div><span className={`text-[10px] whitespace-nowrap px-2.5 py-1.5 rounded-lg ${STATUS_STYLE[q.status] || STATUS_STYLE.SHORTLISTED}`}>{q.status.replaceAll('_',' ').toLowerCase()}</span>{q.status === 'SHORTLISTED' && <button onClick={() => removeCreator(q.id)} className="text-[#7180ad]">×</button>}</div>)}</div>
        <div className="mt-6 bg-indigo-50/60 rounded-2xl p-4 text-sm"><b>ⓘ &nbsp;{m.aboutOutreach}</b><p className="text-xs text-[#6775a0] mt-2">{m.aboutOutreachDesc}</p></div>
        <button disabled={!queue.some(q => q.status === 'SHORTLISTED') || queueBusy} onClick={requestOutreach} className="w-full mt-5 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold disabled:opacity-50">✈ &nbsp; {m.requestOutreach}</button>
        <p className="text-center text-xs text-[#7d88aa] mt-3">{m.reviewQueueNote}</p>
      </aside>
    </div>

    {selected && <div className="fixed inset-0 z-50 bg-[#18204b]/35 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}><div className="bg-[#fbfbff] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-auto" onClick={e => e.stopPropagation()}>
      <div className="p-7 flex justify-between"><div className="flex gap-5"><CreatorAvatar url={selected.avatar_url} name={selected.display_name || selected.handle || 'Creator'} size="w-24 h-24" textSize="text-3xl" /><div><h2 className="text-2xl font-bold">{selected.display_name || selected.handle} <span className="text-indigo-500">●</span></h2><p className="text-[#7180ad]">@{selected.handle?.replace(/^@/,'')}</p><p className="text-sm mt-2">{PLATFORM_LABEL[selected.platform]} {selected.country && ` · ${selected.country}`}</p></div></div><button onClick={() => setSelected(null)} className="text-2xl self-start">×</button></div>
      <div className="px-7 grid grid-cols-2 md:grid-cols-4 gap-3">{[[m.followers,compact(detail?.total_followers ?? selected.follower_count)],[m.modalEngagement,selected.engagement_rate == null ? '—' : `${Number(selected.engagement_rate).toFixed(1)}%`],[m.modalCountry,detail?.location || selected.country || '—'],[m.modalMatchScore,selected.score == null ? '—' : `${Math.round(selected.score)}%`]].map(([k,v]) => <div key={k} className="border border-slate-100 rounded-2xl p-4"><b className="text-xl">{v}</b><p className="text-xs text-[#7d88aa] mt-1">{k}</p></div>)}</div>
      <div className="p-7"><h3 className="font-bold">{m.modalAbout}</h3><p className="text-sm leading-6 text-[#5f6c95] mt-2">{(detailLoading ? m.loadingProfile : detail?.bio || selected.bio || m.profileFallback).split('\n').filter((l: string) => !/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(l) && !/(?:\+?\d[\d\s\-().]{7,}\d)/.test(l)).join('\n')}</p><div className="flex flex-wrap gap-2 mt-4">{(detail?.niche || selected.niche_tags).slice(0,8).map((t:string) => <span key={t} className="bg-[#2c0beb]/10 text-[#2c0beb] rounded-full px-3 py-1 text-xs">{t}</span>)}</div></div>
      <div className="border-t border-slate-100 p-5 flex items-center gap-3 justify-between"><div className="text-xs text-[#7180ad]">🛡 {m.businessContactNote}<br/>{m.neverSharedNote}</div><button disabled={queuedIds.has(selected.id) || queueBusy} onClick={() => { setOutreachModalCreator(selected); setOutreachMsg(rememberMsg && rememberedMsg ? rememberedMsg : ''); setOutreachFiles(rememberMsg && rememberedFiles.length > 0 ? [...rememberedFiles] : []); setOutreachSent(false); setOutreachError(null) }} className="px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold disabled:opacity-50">{queuedIds.has(selected.id) ? m.addedToQueue : m.addToQueue}</button></div>
    </div></div>}

    {outreachModalCreator && createPortal(
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        onClick={() => !outreachSending && setOutreachModalCreator(null)}
      >
        <div className="rounded-3xl shadow-2xl max-w-lg w-full p-7" style={{ backgroundColor: '#ffffff' }} onClick={(e) => e.stopPropagation()}>
          {outreachSent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl">✓</div>
              <h3 className="text-lg font-bold text-gray-900 mt-4">{zh ? '已添加到外联队列' : 'Added to outreach queue'}</h3>
              <p className="text-sm text-gray-500 mt-1.5">
                {zh
                  ? `${outreachModalCreator.display_name || outreachModalCreator.handle} 已添加到队列。点击"请求 Overseed 外联"后我们将代您联系。`
                  : `${outreachModalCreator.display_name || outreachModalCreator.handle} has been added to the queue. Click "Request Overseed Outreach" when ready and we'll reach out on your behalf.`}
              </p>
              <button onClick={() => setOutreachModalCreator(null)} className="mt-6 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition">
                {zh ? '完成' : 'Done'}
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-gray-900">
                {zh ? '联系 ' : 'Contact '}{outreachModalCreator.display_name || outreachModalCreator.handle}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {zh ? '由 Overseed 代为发送 — 创作者可以直接回复您的消息。' : 'Delivered by Overseed — the creator can reply directly to your message.'}
              </p>
              <textarea
                value={outreachMsg}
                onChange={(e) => setOutreachMsg(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder={zh ? '写下您的合作邀请消息...' : 'Write your collaboration message...'}
                className="mt-4 w-full px-4 py-3 rounded-xl text-sm focus:outline-none resize-none"
                style={{ border: '1px solid #e5e7eb' }}
              />
              <p className="text-right text-[11px] text-gray-400 mt-1">{outreachMsg.length}/2000</p>

              <div className="mt-2">
                {outreachFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {outreachFiles.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="flex items-center gap-2 pl-1.5 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                        {f.type.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={URL.createObjectURL(f)} alt="" className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <span className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">PDF</span>
                        )}
                        <span className="max-w-[140px] truncate">{f.name}</span>
                        <button onClick={() => setOutreachFiles(outreachFiles.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600" aria-label="Remove">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 cursor-pointer">
                  <span className="text-base leading-none">＋</span> {zh ? '添加图片或文件' : 'Add photos or files'}
                  <input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={(e) => { addOutreachFiles(e.target.files); e.target.value = '' }} />
                </label>
                <span className="ml-2 text-[11px] text-gray-400">{zh ? '图片或PDF · 最多3个 · 共4MB' : 'Images or PDF · up to 3 files · 4MB combined'}</span>
              </div>

              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input type="checkbox" checked={rememberMsg} onChange={(e) => setRememberMsg(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-gray-600">{zh ? '记住此消息用于下一位创作者' : 'Remember this message for the next creator'}</span>
              </label>

              {outreachError && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{outreachError}</div>
              )}

              <div className="flex items-center justify-end gap-3 mt-5">
                <button onClick={() => setOutreachModalCreator(null)} disabled={outreachSending} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition disabled:opacity-50">
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button onClick={sendOutreach} disabled={outreachSending || outreachMsg.trim().length < 10} className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-rose-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  {outreachSending ? (zh ? '发送中…' : 'Sending…') : (zh ? '发送消息' : 'Send message')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>,
    document.body)}
  </div>
}
