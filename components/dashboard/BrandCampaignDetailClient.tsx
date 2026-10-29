'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { buildMatchProfile, matchFiltersToApiFilters } from '@/lib/campaign-match-profile'
import Markdown from '@/components/Markdown'
import CreatorAvatar from '@/components/ui/CreatorAvatar'
import CreatorDetailModal, { useCreatorDetail } from '@/components/discovery/CreatorDetailModal'

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
  compensationType: string; compensationTypes?: string[]; paymentMin: number | string | null; paymentMax: number | string | null
  giftDescription: string | null; giftValue?: number | string | null; images: string[]; description: string | null
  contentGuidelines?: string | null; contentType?: string | null; createdAt: string
  campaignStartDate?: string | null; campaignEndDate?: string | null
  totalSlots: number; filledSlots: number; viewCount: number
  hashtagsRequired?: string | null; mentionsRequired?: string | null
  // New campaign matching fields
  campaignObjective?: string | null
  targetCountries?: string[]; targetLanguages?: string[]
  targetAudienceAge?: string[]; targetAudienceGender?: string | null
  productUrl?: string | null; brandPositioning?: string | null
  contentStyles?: string[]; creatorTierPreference?: string | null; creatorTypePreference?: string | null
  budgetPerCreator?: number | string | null; totalBudget?: number | string | null
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
  SHORTLISTED: 'bg-slate-100 text-slate-600',
  SENT: 'bg-blue-50 text-blue-600',
  FAILED: 'bg-red-50 text-red-600',
  AWAITING_RESPONSE: 'bg-amber-50 text-amber-600',
  RESPONDED: 'bg-emerald-50 text-emerald-600',
  DECLINED: 'bg-red-50 text-red-600',
  NEGOTIATING: 'bg-violet-50 text-violet-600',
  OFFER_ACCEPTED: 'bg-indigo-50 text-indigo-600',
  IN_PROGRESS: 'bg-sky-50 text-sky-600',
  COMPLETED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, { en: string; zh: string }> = {
  SHORTLISTED: { en: 'Queued', zh: '待发送' },
  SENT: { en: 'Outreach Sent', zh: '已触达' },
  FAILED: { en: 'Failed', zh: '发送失败' },
  AWAITING_RESPONSE: { en: 'Awaiting Reply', zh: '等待回复' },
  RESPONDED: { en: 'Responded', zh: '已回复' },
  DECLINED: { en: 'Declined', zh: '已拒绝' },
  NEGOTIATING: { en: 'Negotiating', zh: '协商中' },
  OFFER_ACCEPTED: { en: 'Offer Accepted', zh: '已接受' },
  IN_PROGRESS: { en: 'In Progress', zh: '进行中' },
  COMPLETED: { en: 'Completed', zh: '已完成' },
  CANCELLED: { en: 'Cancelled', zh: '已取消' },
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

/** Tiny isolated input — typing never re-renders the parent. */
function DebouncedInput({
  defaultValue = '', onCommit, delay = 300, ...props
}: { defaultValue?: string; onCommit: (v: string) => void; delay?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLInputElement>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return (
    <input
      {...props}
      ref={ref}
      defaultValue={defaultValue}
      onChange={(e) => {
        const v = e.target.value
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => commitRef.current(v), delay)
      }}
    />
  )
}

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
  const setTab = (t: 'detail' | 'direct') => {
    setTabRaw(t)
  }
  // Scroll to top on mount (Next.js client navigation preserves scroll position).
  // Use requestAnimationFrame to run after the browser has laid out the new content
  // and after Next.js scroll restoration has fired.
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    })
  }, [])
  const [query, setQuery] = useState('')
  // Filters default to the campaign brief (platform / follower requirement);
  // the brand can adjust them before running the AI match.
  const [platform, setPlatform] = useState('auto')
  // CreatorDB canonical filters
  type CdbFilter = { field: string; op: string; value: string }
  const [cdbFilters, setCdbFilters] = useState<CdbFilter[]>([])
  const cdbFilterFor = (field: string) => cdbFilters.find(f => f.field === field) || { field, op: '=', value: '' }
  const updateCdbFilter = useCallback((field: string, updates: Partial<CdbFilter>) => {
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
  }, [])
  const nicheOnChange = useCallback((v: string) => updateCdbFilter('niches', { op: 'in', value: v }), [updateCdbFilter])

  // Keep these simple states for creator country + followers (injected into cdb_filters on search)
  // All filters start empty — the AI match reads the campaign brief directly.
  const [creatorCountry, setCreatorCountry] = useState('')
  const [minFollowers, setMinFollowers] = useState('')
  const [maxFollowers, setMaxFollowers] = useState('')
  const [creators, setCreators] = useState<Creator[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  // Saved/favorited creators
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [savingKey, setSavingKey] = useState<string | null>(null)
  // No creators are shown until the brand runs the AI match (or a manual
  // search) — discovery is metered, so nothing auto-loads.
  const [matched, setMatched] = useState(false)
  const [aiMatching, setAiMatching] = useState(false)
  // Pagination state
  const [searchPage, setSearchPage] = useState(0)
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [searchNextOffset, setSearchNextOffset] = useState(0)
  const lastSearchRef = useRef<{ endpoint: string; qs: URLSearchParams; pageSize: number } | null>(null)
  const [searchPrice, setSearchPrice] = useState<number | null>(null)
  const [outreachPrice, setOutreachPrice] = useState<number | null>(null)
  const [queueBusy, setQueueBusy] = useState(false)
  const [error, setError] = useState('')
  const {
    detailFor: selected,
    detail,
    detailLoading,
    openDetail: openCreatorDetail,
    closeDetail: closeCreatorDetail,
    unlockFeature,
    unlockAudienceBundle,
    featureUnlocks,
    featureUnlocked,
    featureLoading,
    featureError,
    featureConfirm,
    promptUnlock,
    dismissConfirm,
    detailError,
    detailBlocked,
  } = useCreatorDetail()
  // Multi-select outreach (like discovery page)
  const [selectedForOutreach, setSelectedForOutreach] = useState<Set<string>>(new Set())
  const [outreachModalOpen, setOutreachModalOpen] = useState(false)
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
  const [bioMap, setBioMap] = useState<Record<string, string>>({})
  const [followerTierMode, setFollowerTierMode] = useState('')
  const [openFilterSections, setOpenFilterSections] = useState<Record<string, boolean>>({
    audience: false, creator: false, performance: false,
  })
  const toggleFilterSection = (key: string) => setOpenFilterSections(prev => ({ ...prev, [key]: !prev[key] }))

  const [allCreators, setAllCreators] = useState<Creator[]>([]) // all creators across pages
  const [searchTaskId, setSearchTaskId] = useState<string | null>(null) // server task ID for free pagination

  // ── Product Tour: inject cached example creators when tour reaches this step ──
  const creatorsRef = useRef(creators)
  creatorsRef.current = creators
  const matchedRef = useRef(matched)
  matchedRef.current = matched
  const tabRef = useRef(tab)
  tabRef.current = tab
  const tourPrevStateRef = useRef<{ creators: Creator[]; matched: boolean; tab: 'detail' | 'direct' } | null>(null)
  useEffect(() => {
    const TOUR_CREATORS: Creator[] = [
      {
        id: 'cdb:instagram:lorraineschwartz',
        platform: 'instagram',
        handle: 'lorraineschwartz',
        display_name: 'Lorraine Schwartz',
        bio: 'The Queen of Diamonds 💎 Celebrity jeweler to the stars. Iconic red carpet moments.',
        country: 'US',
        language: 'en',
        follower_count: 831000,
        engagement_rate: '1.8',
        niche_tags: ['Jewelry', 'Luxury', 'Fashion'],
        profile_url: 'https://www.instagram.com/lorraineschwartz',
        avatar_url: null,
        score: 95,
      },
      {
        id: 'cdb:instagram:theblingbag',
        platform: 'instagram',
        handle: 'theblingbag',
        display_name: 'The Bling Bag',
        bio: 'Your daily dose of jewelry inspiration ✨ Earrings, necklaces & accessories.',
        country: 'US',
        language: 'en',
        follower_count: 245000,
        engagement_rate: '3.2',
        niche_tags: ['Jewelry', 'Earrings', 'Accessories'],
        profile_url: 'https://www.instagram.com/theblingbag',
        avatar_url: null,
        score: 91,
      },
      {
        id: 'cdb:instagram:fashionista_in_style',
        platform: 'instagram',
        handle: 'fashionista_in_style',
        display_name: 'Fashionista In Style',
        bio: 'Fashion & jewelry content creator 💫 Styling tips and accessory hauls.',
        country: 'US',
        language: 'en',
        follower_count: 189000,
        engagement_rate: '4.1',
        niche_tags: ['Fashion', 'Jewelry', 'Style'],
        profile_url: 'https://www.instagram.com/fashionista_in_style',
        avatar_url: null,
        score: 88,
      },
    ]

    const handleShowDirectTab = () => {
      if (!tourPrevStateRef.current) {
        tourPrevStateRef.current = {
          creators: creatorsRef.current,
          matched: matchedRef.current,
          tab: tabRef.current,
        }
      }
      setTabRaw('direct')
      setMatched(false)
      setCreators([])
    }

    const handleShowTourCreators = () => {
      if (!tourPrevStateRef.current) {
        tourPrevStateRef.current = {
          creators: creatorsRef.current,
          matched: matchedRef.current,
          tab: tabRef.current,
        }
      }
      setTabRaw('direct')
      setCreators(TOUR_CREATORS)
      setMatched(true)
      setAiMatching(false)
    }

    const handleClearTourCreators = () => {
      if (tourPrevStateRef.current) {
        setCreators(tourPrevStateRef.current.creators)
        setMatched(tourPrevStateRef.current.matched)
        setTabRaw(tourPrevStateRef.current.tab)
        tourPrevStateRef.current = null
      }
    }

    const handleShowDetailTab = () => {
      setTabRaw('detail')
    }

    const handleShowMatchingLoading = () => {
      setAiMatching(true)
    }

    const handleOpenTourProfile = () => {
      // Open the first cached tour creator's profile
      const c = creatorsRef.current[0]
      if (c) openCreatorDetail(c as any)
    }

    const handleCloseTourProfile = () => {
      closeCreatorDetail()
    }

    const handleSelectFirstCreator = () => {
      const c = creatorsRef.current[0]
      if (c) {
        const handle = (c.handle || '').replace(/^@/, '').toLowerCase()
        if (handle) {
          setSelectedForOutreach(new Set([`${c.platform}:${handle}`]))
        }
      }
    }

    const handleDeselectAllCreators = () => {
      setSelectedForOutreach(new Set())
    }

    const handleOpenOutreachEditor = () => {
      setOutreachModalOpen(true)
      setOutreachMsg('')
      setOutreachFiles([])
      setOutreachSent(false)
      setOutreachError(null)
    }

    const handleCloseOutreachEditor = () => {
      setOutreachModalOpen(false)
    }

    window.addEventListener('tour:openOutreachEditor', handleOpenOutreachEditor)
    window.addEventListener('tour:closeOutreachEditor', handleCloseOutreachEditor)
    window.addEventListener('tour:selectFirstCreator', handleSelectFirstCreator)
    window.addEventListener('tour:deselectAllCreators', handleDeselectAllCreators)
    window.addEventListener('tour:showDirectTab', handleShowDirectTab)
    window.addEventListener('tour:showDetailTab', handleShowDetailTab)
    window.addEventListener('tour:showMatchingLoading', handleShowMatchingLoading)
    window.addEventListener('tour:showCampaignCreators', handleShowTourCreators)
    window.addEventListener('tour:clearCampaignCreators', handleClearTourCreators)
    window.addEventListener('tour:openProfile', handleOpenTourProfile)
    window.addEventListener('tour:closeProfile', handleCloseTourProfile)
    return () => {
      window.removeEventListener('tour:openOutreachEditor', handleOpenOutreachEditor)
      window.removeEventListener('tour:closeOutreachEditor', handleCloseOutreachEditor)
      window.removeEventListener('tour:selectFirstCreator', handleSelectFirstCreator)
      window.removeEventListener('tour:deselectAllCreators', handleDeselectAllCreators)
      window.removeEventListener('tour:showDirectTab', handleShowDirectTab)
      window.removeEventListener('tour:showDetailTab', handleShowDetailTab)
      window.removeEventListener('tour:showMatchingLoading', handleShowMatchingLoading)
      window.removeEventListener('tour:showCampaignCreators', handleShowTourCreators)
      window.removeEventListener('tour:clearCampaignCreators', handleClearTourCreators)
      window.removeEventListener('tour:openProfile', handleOpenTourProfile)
      window.removeEventListener('tour:closeProfile', handleCloseTourProfile)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      // Don't restore AI-inferred cdbFilters — they shouldn't be shown in the UI
      const all = s.allCreators || s.creators
      setAllCreators(all)
      setCreators(all.slice(0, PAGE_SIZE))
      setSearchPage(0)
      if (s.searchTaskId) setSearchTaskId(s.searchTaskId)
      if (all.length >= PAGE_SIZE) setSearchHasMore(true)
      setMatched(true)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!matched || creators.length === 0) return
    try {
      sessionStorage.setItem(searchStateKey, JSON.stringify({
        query, platform, creatorCountry, minFollowers, maxFollowers, creators, allCreators, searchTaskId,
      }))
    } catch {}
  }, [matched, creators, allCreators, query, platform, creatorCountry, minFollowers, maxFollowers, searchStateKey])

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

  const PAGE_SIZE = 20
  const BATCH_SIZE = 100 // fetch 100 from CreatorDB, slice into 5 pages of 20 client-side

  // Sort results by AI bio relevance (Best Match), ties broken by followers
  const sortByRelevance = (results: Creator[]) =>
    [...results].sort((a, b) => {
      const relA = (a as any).ai_relevance ?? 0
      const relB = (b as any).ai_relevance ?? 0
      const diff = relB - relA
      if (diff !== 0) return diff
      return (b.follower_count ?? 0) - (a.follower_count ?? 0)
    })

  // Resolve 'auto' to the campaign's platform
  const resolvedPlatform = (() => {
    if (platform !== 'auto') return platform
    const p = (campaign.platforms[0]?.platform.name || '').toLowerCase()
    return ['tiktok', 'instagram', 'youtube'].includes(p) ? p : 'instagram'
  })()

  const discover = useCallback(async (search = '', page = 0, offset = 0) => {
    setLoading(true); setError('')
    const searching = Boolean(search.trim())
    const qs = new URLSearchParams({ platform: resolvedPlatform })
    const filters = buildCdbFiltersParam()

    if (filters.length > 0) {
      qs.set('cdb_filters', JSON.stringify(filters))
      qs.set('limit', String(BATCH_SIZE))
      qs.set('offset', String(offset))
      qs.set('cdb_sort', 'followers')
    } else if (searching) {
      qs.set('q', search.trim())
      qs.set('limit', String(PAGE_SIZE))
      qs.set('offset', String(offset))
    } else {
      qs.set('sort', 'followers')
      qs.set('limit', String(PAGE_SIZE))
      qs.set('offset', String(offset))
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
      const results = sortByRelevance(data?.results || [])
      setAllCreators(results)
      setCreators(results)
      setSearchPage(0)
      setSearchTotal(0)
      setSearchTaskId(data?.task_id || null)
      setSearchHasMore(data?.has_next_page ?? false)
      setSearchNextOffset(1)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false); setMatched(true) }
  }, [resolvedPlatform, buildCdbFiltersParam])

  const aiMatch = async () => {
    if (aiMatching) return
    setAiMatching(true); setError('')
    try {
      // Build a structured matching profile from campaign data. This generates
      // typed filters with source/constraint metadata and a natural-language
      // brief for AI niche extraction + bio scoring.
      const profile = buildMatchProfile(campaign)

      // Apply user overrides from the filter UI (take precedence over campaign)
      const apiFilters = matchFiltersToApiFilters(profile.filters)
      // Override follower range if user changed it in the UI
      if (minFollowers) {
        const idx = apiFilters.findIndex(f => f.field === 'followers' && f.op === '>')
        if (idx >= 0) apiFilters[idx].value = Number(minFollowers)
        else apiFilters.push({ field: 'followers', op: '>', value: Number(minFollowers) })
      }
      if (maxFollowers) {
        const idx = apiFilters.findIndex(f => f.field === 'followers' && f.op === '<')
        if (idx >= 0) apiFilters[idx].value = Number(maxFollowers)
        else apiFilters.push({ field: 'followers', op: '<', value: Number(maxFollowers) })
      }
      // Override country if user changed it
      if (creatorCountry.trim()) {
        const idx = apiFilters.findIndex(f => f.field === 'country')
        if (idx >= 0) apiFilters[idx].value = creatorCountry.trim().toUpperCase()
        else apiFilters.push({ field: 'country', op: '=', value: creatorCountry.trim().toUpperCase() })
      }

      // Append user keywords to the brief
      const briefText = query.trim()
        ? `${profile.briefText}\nAdditional keywords: ${query.trim()}`
        : profile.briefText

      // Use resolved platform (respects 'auto' → campaign platform)
      const activePlatform = resolvedPlatform

      const qs = new URLSearchParams({
        platform: activePlatform,
        limit: String(BATCH_SIZE),
        offset: '0',
        cdb_sort: 'followers',
        q: briefText,
      })
      if (apiFilters.length > 0) {
        qs.set('cdb_filters', JSON.stringify(apiFilters))
      }
      if (minFollowers) qs.set('min_followers', minFollowers)
      if (maxFollowers) qs.set('max_followers', maxFollowers)
      if (creatorCountry.trim()) qs.set('country', creatorCountry.trim().toUpperCase())

      // ── LOG ──
      console.group('[DirectOutreach] AI Match via MatchProfile')
      console.log('Brief:', briefText.slice(0, 200))
      console.log('Filters:', apiFilters)
      console.log('Platform:', profile.platform)
      console.log('Metadata:', profile.metadata)
      console.groupEnd()

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
          ai_relevance: c.ai_relevance ?? '—',
        })))
      }
      if (data?.ai_parsed) console.log('AI parsed params:', data.ai_parsed)
      if (data?.search_adjustments) console.log('Search adjustments:', data.search_adjustments)
      console.groupEnd()

      if (!res.ok) throw new Error(data?.message || 'Creator matching is temporarily unavailable.')
      const results = sortByRelevance(data?.results || [])
      setAllCreators(results)
      setCreators(results)
      setSearchPage(0)
      setSearchTotal(0)
      setSearchTaskId(data?.task_id || null)
      setSearchHasMore(data?.has_next_page ?? false)
      setSearchNextOffset(1)
      setMatched(true)
    } catch (e: any) { setError(e.message) }
    finally { setAiMatching(false) }
  }

  const goToPage = async (page: number) => {
    if (loading || !searchTaskId) return
    setLoading(true); setError('')
    try {
      const qs = new URLSearchParams({ task_id: searchTaskId, page: String(page), platform: resolvedPlatform })
      const res = await fetch(`/api/discovery/club-search?${qs}`)
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || 'Failed to load page.')
      const results = sortByRelevance(data?.results || [])
      setAllCreators(prev => {
        // Accumulate all pages for session persistence
        const existing = new Set(prev.map((c: Creator) => c.id))
        const newOnes = results.filter((c: Creator) => !existing.has(c.id))
        return [...prev, ...newOnes]
      })
      setCreators(results)
      setSearchPage(page)
      setSearchHasMore(data?.has_next_page ?? false)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadQueue() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved/favorited creator keys
  useEffect(() => {
    fetch('/api/saved-creators/discovery?keysOnly=1')
      .then((res) => (res.ok ? res.json() : { keys: [] }))
      .then((data) => setSavedKeys(new Set(data.keys || [])))
      .catch(() => {})
  }, [])

  const toggleSaveCreator = async (creator: Creator) => {
    const handle = (creator.handle || '').replace(/^@/, '').toLowerCase()
    if (!handle) return
    const key = `${creator.platform}:${handle}`
    if (savingKey === key) return
    setSavingKey(key)
    const wasSaved = savedKeys.has(key)
    setSavedKeys((prev) => {
      const next = new Set(prev)
      wasSaved ? next.delete(key) : next.add(key)
      return next
    })
    try {
      const res = wasSaved
        ? await fetch(`/api/saved-creators/discovery?platform=${encodeURIComponent(creator.platform)}&handle=${encodeURIComponent(handle)}`, { method: 'DELETE' })
        : await fetch('/api/saved-creators/discovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: creator.platform,
              handle,
              displayName: creator.display_name,
              avatarUrl: creator.avatar_url,
              followerCount: creator.follower_count,
              engagementRate: creator.engagement_rate != null ? Number(creator.engagement_rate) : null,
              nicheTags: creator.niche_tags || [],
            }),
          })
      if (!res.ok) {
        setSavedKeys((prev) => {
          const next = new Set(prev)
          wasSaved ? next.add(key) : next.delete(key)
          return next
        })
      }
    } catch {
      setSavedKeys((prev) => {
        const next = new Set(prev)
        wasSaved ? next.add(key) : next.delete(key)
        return next
      })
    } finally {
      setSavingKey(null)
    }
  }

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
        if (data?.bios && typeof data.bios === 'object') setBioMap(prev => ({ ...prev, ...data.bios }))
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
          if (typeof data.prices?.outreach === 'number') setOutreachPrice(data.prices.outreach)
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
      setQueue(data.queue); closeCreatorDetail()
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

  const toggleSelectForOutreach = (c: Creator) => {
    const handle = (c.handle || '').replace(/^@/, '').toLowerCase()
    if (!handle) return
    const key = `${c.platform}:${handle}`
    setSelectedForOutreach(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const isSelectedForOutreach = (c: Creator) => {
    const handle = (c.handle || '').replace(/^@/, '').toLowerCase()
    return handle ? selectedForOutreach.has(`${c.platform}:${handle}`) : false
  }

  const getSelectedCreatorObjects = (): Creator[] =>
    creators.filter(c => {
      const handle = (c.handle || '').replace(/^@/, '').toLowerCase()
      return handle ? selectedForOutreach.has(`${c.platform}:${handle}`) : false
    })

  const openBulkOutreach = () => {
    setOutreachModalOpen(true)
    setOutreachMsg(rememberMsg && rememberedMsg ? rememberedMsg : '')
    setOutreachFiles(rememberMsg && rememberedFiles.length > 0 ? [...rememberedFiles] : [])
    setOutreachSent(false)
    setOutreachError(null)
  }

  const sendOutreach = async () => {
    const selected = getSelectedCreatorObjects()
    if (selected.length === 0 || outreachMsg.trim().length < 10) return
    setOutreachSending(true)
    setOutreachError(null)
    try {
      // Send each selected creator to the campaign outreach endpoint
      for (const c of selected) {
        const fd = new FormData()
        fd.set('creator', JSON.stringify(c))
        fd.set('message', outreachMsg.trim())
        outreachFiles.forEach((f) => fd.append('files', f))
        const res = await fetch(`/api/campaigns/${campaign.id}/outreach`, { method: 'POST', body: fd })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.message || `Failed for @${c.handle}`)
        setQueue(data.queue)
      }
      setOutreachSent(true)
      setSelectedForOutreach(new Set())
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
  const openCreator = (creator: Creator) => openCreatorDetail(creator as any)

  const queuedIds = useMemo(() => new Set(queue.map(q => q.externalCreatorId)), [queue])
  const budget = campaign.paymentMin ? `$${formatNumber(Number(campaign.paymentMin), locale)}${campaign.paymentMax ? ` – $${formatNumber(Number(campaign.paymentMax), locale)}` : '+'}` : campaign.giftDescription || m.negotiable
  const cover = campaign.images?.[0]

  const campaignTabs = <div data-tour="campaign-tabs" className="flex gap-2 mb-5 p-1.5 w-fit rounded-2xl bg-white/35 border border-white/50">
    <button onClick={() => setTab('detail')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'detail' ? 'bg-white/80 shadow-sm text-[#17255f]' : 'text-[#7180ad]'}`}>{m.tabDetail}</button>
    <button data-tour="direct-outreach-tab" onClick={() => setTab('direct')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'direct' ? 'bg-white/80 shadow-sm text-[#17255f]' : 'text-[#7180ad]'}`}>{m.tabDirect}</button>
  </div>

  const fCls = 'workspace-glass-control px-3 py-2 text-sm'
  const inputCls = 'h-[38px] px-3 py-1.5 workspace-glass-control text-sm focus:outline-none'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'
  const zh = locale === 'zh'
  const filterSections = <>
    {/* Section 1 — Audience */}
    <div className="rounded-xl bg-gradient-to-r from-green-50/40 to-transparent border border-gray-100 mb-2">
      <button type="button" onClick={() => toggleFilterSection('audience')} className="w-full flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center">1</span>
          <div className="text-left">
            <span className="text-xs font-semibold text-gray-800">{d.audienceSection}</span>
            <span className="ml-2 text-[10px] text-gray-400">{d.audienceDesc}</span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${openFilterSections.audience ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {openFilterSections.audience && (
        <div className="px-3 pb-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Audience location */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                {d.audienceLocation}
              </span>
            </label>
            <MultiSelectFilter
              value={cdbFilterFor('audienceLocation').value}
              onChange={(v) => updateCdbFilter('audienceLocation', { op: 'in', value: v })}
              options={COUNTRY_FILTER_OPTIONS.map(({ code, key }) => ({
                value: code,
                label: (t.signupBusiness.countries as Record<string, string>)[key] || code,
              }))}
              placeholder={d.audienceLocationPlaceholder}
              inputCls={inputCls}
            />
          </div>
          {/* Language */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M12 22l5-10 5 10"/><path d="M14 18h6"/></svg>
                {d.audienceLanguage}
              </span>
            </label>
            <MultiSelectFilter
              value={cdbFilterFor('mainLanguage').value}
              onChange={(v) => updateCdbFilter('mainLanguage', { op: 'in', value: v })}
              options={CREATORDB_LANGUAGE_OPTIONS.map(([value, langLabel]) => ({
                value,
                label: langLabel,
              }))}
              placeholder={d.audienceLanguagePlaceholder}
              inputCls={inputCls}
            />
          </div>
          {/* Audience age */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {d.audienceAge}
              </span>
            </label>
            <MultiSelectFilter
              value={cdbFilterFor('audienceAge').value}
              onChange={(v) => updateCdbFilter('audienceAge', { op: 'in', value: v })}
              options={['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((age) => ({
                value: age,
                label: age,
              }))}
              placeholder={d.anyOption}
              inputCls={inputCls}
            />
          </div>
          {/* Gender composition */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
                {d.audienceGender}
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
                      {d.genderFemaleShort} {isActive ? `${femalePct}%+` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        updateCdbFilter('audienceFemaleRatio', { value: '' })
                        updateCdbFilter('audienceGender', { value: '' })
                      }}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      {isActive ? d.genderReset : d.genderAny}
                    </button>
                    <span style={{ color: isActive ? '#3b82f6' : undefined }}>
                      {isActive ? `${100 - femalePct}%+` : ''} {d.genderMaleShort}
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
                <option value="">{d.anyOption}</option>
                <option value="female">{m.mostlyFemale}</option>
                <option value="male">{m.mostlyMale}</option>
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
            <span className="text-xs font-semibold text-gray-800">{d.creatorSection}</span>
            <span className="ml-2 text-[10px] text-gray-400">{d.creatorDesc}</span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${openFilterSections.creator ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {openFilterSections.creator && (
        <div className="px-3 pb-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Platform */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                {m.platformLabel}
              </span>
            </label>
            <select value={platform} onChange={e => setPlatform(e.target.value)} className={`w-full ${inputCls}`}>
              <option value="auto">
                {zh ? '按活动设置' : 'From campaign'}{(() => {
                  const p = (campaign.platforms[0]?.platform.name || '').toLowerCase()
                  const label: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }
                  return label[p] ? ` (${label[p]})` : ''
                })()}
              </option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          {/* Creator's country */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {d.creatorCountry}
              </span>
            </label>
            <MultiSelectFilter
              value={creatorCountry}
              onChange={setCreatorCountry}
              options={COUNTRY_FILTER_OPTIONS.map(({ code, key }) => ({
                value: code,
                label: (t.signupBusiness.countries as Record<string, string>)[key] || code,
              }))}
              placeholder={d.creatorCountryPlaceholder}
              inputCls={inputCls}
            />
          </div>
          {/* Verified account */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {d.verifiedAccount}
              </span>
            </label>
            <select
              value={cdbFilterFor('isAccountVerified').value}
              onChange={(e) => updateCdbFilter('isAccountVerified', { value: e.target.value })}
              className={`w-full ${inputCls}`}
            >
              <option value="">{d.anyOption}</option>
              <option value="true">{d.verifiedYes}</option>
              <option value="false">{d.verifiedNo}</option>
            </select>
          </div>
          {/* Hashtags */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-400">#</span>
                {d.hashtags}
              </span>
            </label>
            <DebouncedInput
              type="text"
              onCommit={(v) => updateCdbFilter('hashtags', { op: 'in', value: v })}
              placeholder={d.hashtagsPlaceholder}
              className={`w-full ${inputCls}`}
            />
          </div>
          {/* Niches */}
          <NicheAutocomplete
            platform={platform}
            value={cdbFilterFor('niches').value}
            onChange={nicheOnChange}
            labelCls={labelCls}
            inputCls={inputCls}
            zh={zh}
          />
          {/* Followers / subscribers */}
          <div className="col-span-2 lg:col-span-2">
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {d.followersLabel}
              </span>
            </label>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
              {minFollowers === 'custom' || (minFollowers && !['' ,'1000','5000','10000','25000','50000','100000','250000','500000','1000000'].includes(minFollowers)) ? (
                <input
                  type="number"
                  min={0}
                  placeholder={d.minFollowersPlaceholder}
                  autoFocus={minFollowers === 'custom'}
                  value={minFollowers === 'custom' ? '' : minFollowers}
                  onChange={(e) => {
                    setMinFollowers(e.target.value)
                    setFollowerTierMode('custom')
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (!v || Number(v) <= 0) setMinFollowers('')
                  }}
                  className={`w-full ${inputCls}`}
                />
              ) : (
                <select
                  value={minFollowers}
                  onChange={(e) => { setMinFollowers(e.target.value); setFollowerTierMode('custom') }}
                  className={`w-full ${inputCls}`}
                >
                  <option value="">{d.anyOption}</option>
                  <option value="custom">{d.customOption}</option>
                  {[1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000].map((n) => (
                    <option key={n} value={String(n)}>{n.toLocaleString()}</option>
                  ))}
                </select>
              )}
              </div>
              <span className="text-gray-400 font-medium text-sm flex-shrink-0">–</span>
              <div className="flex-1 min-w-0">
              {maxFollowers === 'custom' || (maxFollowers && !['','5000','10000','25000','50000','100000','250000','500000','1000000','5000000','10000000'].includes(maxFollowers)) ? (
                <input
                  type="number"
                  min={0}
                  placeholder={d.maxFollowersPlaceholder}
                  autoFocus={maxFollowers === 'custom'}
                  value={maxFollowers === 'custom' ? '' : maxFollowers}
                  onChange={(e) => {
                    setMaxFollowers(e.target.value)
                    setFollowerTierMode('custom')
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (!v || Number(v) <= 0) setMaxFollowers('')
                  }}
                  className={`w-full ${inputCls}`}
                />
              ) : (
                <select
                  value={maxFollowers}
                  onChange={(e) => { setMaxFollowers(e.target.value); setFollowerTierMode('custom') }}
                  className={`w-full ${inputCls}`}
                >
                  <option value="">{d.anyOption}</option>
                  <option value="custom">{d.customOption}</option>
                  {[5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000, 10000000].map((n) => (
                    <option key={n} value={String(n)}>{n.toLocaleString()}</option>
                  ))}
                </select>
              )}
              </div>
            </div>
          </div>
          {/* Last active */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {d.lastActive}
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
              <option value="">{d.anyOption}</option>
              <option value="90">{d.last3months}</option>
              <option value="180">{d.last6months}</option>
              <option value="365">{d.last1year}</option>
              <option value="-365">{d.over1year}</option>
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
            <span className="text-xs font-semibold text-gray-800">{d.performanceSection}</span>
            <span className="ml-2 text-[10px] text-gray-400">{d.performanceDesc}</span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${openFilterSections.performance ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {openFilterSections.performance && (
        <div className="px-3 pb-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Average short views */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {d.avgViews}
              </span>
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={cdbFilterFor('shortAvgViews').value}
                onChange={(e) => updateCdbFilter('shortAvgViews', { op: '>', value: e.target.value })}
                placeholder={d.avgViewsPlaceholder}
                className={`min-w-0 flex-1 ${inputCls}`}
              />
              <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{d.avgViewsSuffix}</span>
            </div>
          </div>
          {/* Average engagement rate */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                {d.avgEngagement}
              </span>
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min={0}
                value={cdbFilterFor('shortEngagementRate').value}
                onChange={(e) => updateCdbFilter('shortEngagementRate', { op: '>', value: e.target.value })}
                placeholder={d.avgEngagementPlaceholder}
                className={`min-w-0 flex-1 ${inputCls}`}
              />
              <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">≥ %</span>
            </div>
          </div>
          {/* Followers growth (30d) */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                {d.followerGrowth}
              </span>
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={cdbFilterFor('followerGrowth30d').value}
                onChange={(e) => updateCdbFilter('followerGrowth30d', { op: '>', value: e.target.value })}
                placeholder={d.followerGrowthPlaceholder}
                className={`min-w-0 flex-1 ${inputCls}`}
              />
              <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{d.followerGrowthSuffix}</span>
            </div>
          </div>
          {/* Content count (30d) */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                {d.postsIn30d}
              </span>
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={cdbFilterFor('contentsIn30Days').value}
                onChange={(e) => updateCdbFilter('contentsIn30Days', { op: '>', value: e.target.value })}
                placeholder={d.postsIn30dPlaceholder}
                className={`min-w-0 flex-1 ${inputCls}`}
              />
              <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{d.postsIn30dSuffix}</span>
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
      <div data-tour="campaign-detail-content" className="grid xl:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
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
          <div><p className="text-xs text-[#7f8bb1]">{m.status}</p><span className="inline-flex mt-1 px-3 py-1 rounded-full bg-slate-100 text-xs font-semibold capitalize">{directStatusLabel(campaign.status)}</span></div>
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
            <div className="flex gap-2"><div className="workspace-glass-control flex-1 flex items-center gap-3 px-4 py-3">{icon(searchIcon, 'w-4 h-4')}<input value={query} onChange={e => setQuery(e.target.value)} className="bg-transparent outline-none w-full" placeholder={d.searchByNamePlaceholder}/></div><button className="px-6 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold">{d.searchButton}</button></div>
            <div className="space-y-2 mt-3">
              {filterSections}
              <button type="button" onClick={() => { setQuery(''); setPlatform('auto'); setCreatorCountry(''); setMinFollowers(''); setMaxFollowers(''); setCdbFilters([]); setCreators([]); setAllCreators([]); setMatched(false); setSearchPage(0); setSearchHasMore(false); setSearchTaskId(null); setSelectedForOutreach(new Set()); try { sessionStorage.removeItem(searchStateKey) } catch {} }} className="px-3 py-1 text-sm text-[#65739e]">{d.clearAll}</button>
            </div>
          </form>
          )}
          {error && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          {!matched && (
            <section data-tour="ai-match-section" className="workspace-glass-card rounded-3xl px-6 py-8 text-center">
              <h3 className="font-bold text-xl">{m.aiMatchTitle}</h3>
              <p className="text-sm text-[#7180ad] mt-1.5 max-w-lg mx-auto">{m.aiMatchDesc}</p>
              <form
                className="mt-5 mx-auto max-w-xl"
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
                {filterSections}
              </div>
              <button
                type="button"
                onClick={aiMatch}
                disabled={aiMatching}
                data-tour="ai-match-button"
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
          {/* Selection bar for bulk outreach */}
          {selectedForOutreach.size > 0 && (
            <div data-tour="bulk-outreach-bar" className="mb-3 flex items-center justify-between gap-3 p-3 rounded-2xl bg-primary-50/70 border border-primary-200/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex -space-x-2 flex-shrink-0">
                  {getSelectedCreatorObjects().slice(0, 4).map((c, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-white border-2 border-primary-100 overflow-hidden flex-shrink-0">
                      <CreatorAvatar url={c.avatar_url} name={c.display_name || c.handle || '?'} size="w-full h-full" textSize="text-xs" />
                    </div>
                  ))}
                </div>
                <span className="text-sm font-semibold text-primary-800">
                  {selectedForOutreach.size} {zh ? '位达人已选择' : `creator${selectedForOutreach.size > 1 ? 's' : ''} selected`}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedForOutreach(new Set())}
                  className="text-xs text-primary-500 hover:text-primary-700 font-medium"
                >
                  {zh ? '清除' : 'Clear'}
                </button>
              </div>
              {outreachPrice != null && (
                <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full flex-shrink-0">
                  ✦ {outreachPrice * selectedForOutreach.size} {zh ? '积分' : 'credits'}
                </span>
              )}
              <button
                type="button"
                onClick={openBulkOutreach}
                className="px-5 py-2 rounded-full bg-primary-600 text-white text-sm font-semibold shadow-sm hover:bg-primary-700 transition flex-shrink-0"
              >
                {zh ? '批量联系' : 'Send Outreach'}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mb-3"><b>{loading ? m.findingCreators : m.creatorsForYou.replace('{count}', String(creators.length))}{searchPage > 0 && ` · ${m.pageNum.replace('{n}', String(searchPage + 1))}`}</b><span className="text-sm text-[#7180ad]">{m.sortBy}<b>{m.relevance}</b></span></div>
          <div className={`space-y-3 transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
            {creators.map((c, cIdx) => {
              const handle = (c.handle || '').replace(/^@/, '').toLowerCase()
              const creatorKey = handle ? `${c.platform}:${handle}` : null
              return (
              <div key={c.id} className="workspace-glass-card rounded-2xl p-5">
                {/* Top section: avatar + info + platform link */}
                <div className="flex gap-4" {...(cIdx === 0 ? { 'data-tour': 'campaign-creator-card-info' } : {})}>
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
                              title={d.resultsCopyHandle}
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
                    {/* Bio (from search result or bioMap) */}
                    {(() => {
                      const bio = c.bio || (creatorKey ? bioMap[creatorKey] : null)
                      return bio ? <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">{bio}</p> : null
                    })()}
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
                    <span className="text-lg font-bold text-gray-900">{c.follower_count != null ? new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(c.follower_count) : '—'}</span>
                    <span className="text-sm text-gray-400">{d.followers}</span>
                  </div>
                  <div className="flex items-center gap-2.5" {...(cIdx === 0 ? { 'data-tour': 'campaign-creator-card-actions' } : {})}>
                    <button
                      type="button"
                      onClick={() => openCreator(c)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-400 to-slate-400 text-white rounded-full text-sm font-semibold hover:from-indigo-500 hover:to-slate-500 transition shadow-sm"
                      {...(cIdx === 0 ? { 'data-tour': 'campaign-creator-view-profile' } : {})}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      {d.resultsViewProfile}
                    </button>
                    <button
                      type="button"
                      disabled={queuedIds.has(c.id)}
                      onClick={() => toggleSelectForOutreach(c)}
                      {...(cIdx === 0 ? { 'data-tour': 'creator-contact-button' } : {})}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition disabled:opacity-50 ${
                        isSelectedForOutreach(c)
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                      }`}
                    >
                      {isSelectedForOutreach(c) ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      )}
                      {queuedIds.has(c.id) ? m.added : isSelectedForOutreach(c) ? (zh ? '已选择' : 'Selected') : d.resultsContact}
                    </button>
                    {/* Save / Bookmark */}
                    {(() => {
                      const h = (c.handle || '').replace(/^@/, '').toLowerCase()
                      const k = h ? `${c.platform}:${h}` : ''
                      const isSaved = k ? savedKeys.has(k) : false
                      return k ? (
                        <button
                          type="button"
                          onClick={() => toggleSaveCreator(c)}
                          disabled={savingKey === k}
                          {...(cIdx === 0 ? { 'data-tour': 'creator-save-button' } : {})}
                          className={`w-11 h-11 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                            isSaved
                              ? 'bg-amber-50 text-amber-500'
                              : 'bg-[#f5f3f0] text-[#2a2f3e] hover:text-amber-500 hover:bg-amber-50'
                          }`}
                          title={isSaved ? (zh ? '取消收藏' : 'Remove from Saved') : (zh ? '收藏' : 'Save Creator')}
                        >
                          <svg className="w-5 h-5" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>
              )
            })}
          </div>
          {/* Pagination */}
          {(searchPage > 0 || searchHasMore) && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goToPage(searchPage - 1)}
                  disabled={searchPage === 0 || loading}
                  className="px-5 py-2.5 bg-white/55 text-gray-700 rounded-full text-sm font-semibold hover:bg-white/75 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← {m.prevPage}
                </button>
                <span className="min-w-20 text-center text-sm font-medium text-gray-500">
                  {m.pageNum.replace('{n}', String(searchPage + 1))}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(searchPage + 1)}
                  disabled={!searchHasMore || loading}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-full text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {m.nextPageBtn} →
                </button>
              </div>
              {searchHasMore && searchPrice != null && (
                <p className="text-xs text-gray-400">
                  {zh ? `翻页将扣除 ${searchPrice} 积分` : `Next page costs ${searchPrice} credits`}
                </p>
              )}
            </div>
          )}
          </>)}
        </>
      </div>

      <aside className="workspace-glass-card rounded-3xl p-5 xl:sticky xl:top-5">
        <div className="flex justify-between items-center"><h2 className="text-xl font-bold">{m.outreachQueue} <span className="text-sm border border-white rounded-full px-2 py-1 ml-1">{queue.length}</span></h2><span>⌃</span></div>
        <p className="text-sm text-[#7180ad] mt-1">{m.queueDesc}</p>
        <div className="space-y-4 mt-6 max-h-[430px] overflow-auto pr-1">{queue.length === 0 && <div className="py-10 text-center text-sm text-[#7b87aa]">{m.queueEmpty}</div>}{queue.map(q => <div key={q.id} className="flex items-center gap-3"><CreatorAvatar url={q.avatarUrl} name={q.displayName || q.handle || 'Creator'} size="w-10 h-10" textSize="text-xs" /><div className="min-w-0 flex-1"><b className="block truncate text-sm">{q.displayName || q.handle || 'Creator'}</b><p className="text-xs text-[#7e89aa] truncate">@{q.handle?.replace(/^@/, '')}</p></div><span className={`text-[10px] whitespace-nowrap px-2.5 py-1.5 rounded-full ${STATUS_STYLE[q.status] || STATUS_STYLE.SHORTLISTED}`}>{(zh ? STATUS_LABEL[q.status]?.zh : STATUS_LABEL[q.status]?.en) || q.status.replaceAll('_',' ').toLowerCase()}</span>{q.status === 'SHORTLISTED' && <button onClick={() => removeCreator(q.id)} className="text-[#7180ad]">×</button>}</div>)}</div>
        <div className="mt-6 bg-indigo-50/60 rounded-2xl p-4 text-sm"><b>ⓘ &nbsp;{m.aboutOutreach}</b><p className="text-xs text-[#6775a0] mt-2">{m.aboutOutreachDesc}</p></div>
      </aside>
    </div>

    {selected && (
      <CreatorDetailModal
        creator={selected as any}
        detail={detail}
        detailLoading={detailLoading}
        detailError={detailError}
        detailBlocked={detailBlocked}
        featureUnlocks={featureUnlocks}
        featureUnlocked={featureUnlocked}
        featureLoading={featureLoading}
        featureError={featureError}
        featureConfirm={featureConfirm}
        onClose={closeCreatorDetail}
        onUnlockFeature={unlockFeature}
        onUnlockAudienceBundle={unlockAudienceBundle}
        onPromptUnlock={promptUnlock}
        onDismissConfirm={dismissConfirm}
        onDismissFeatureError={() => {}}
        onOpenRelated={(creator) => openCreator(creator as any)}
        savedKeys={savedKeys}
        onToggleSave={(creator) => toggleSaveCreator(creator as any)}
        onOpenContact={(creator) => {
          const c = (creator || selected) as any
          if (c) toggleSelectForOutreach(c)
          closeCreatorDetail()
          setOutreachError(null)
        }}
        nicheMap={nicheMap}
        zh={zh}
        locale={locale}
        t={t}
      />
    )}

    {outreachModalOpen && createPortal(
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        onClick={() => !outreachSending && setOutreachModalOpen(false)}
      >
        <div data-tour="outreach-message-editor" className="rounded-3xl shadow-2xl max-w-lg w-full p-7" style={{ backgroundColor: '#ffffff' }} onClick={(e) => e.stopPropagation()}>
          {outreachSent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl">✓</div>
              <h3 className="text-lg font-bold text-gray-900 mt-4">{m.addedToOutreachQueue}</h3>
              <p className="text-sm text-gray-500 mt-1.5">
                {zh ? `${getSelectedCreatorObjects().length || ''} 位达人触达已发送，Overseed 团队将代您联系` : 'Outreach sent! The Overseed team will reach out on your behalf.'}
              </p>
              <button onClick={() => setOutreachModalOpen(false)} className="mt-6 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition">
                {m.done}
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-gray-900">
                {zh ? `联系 ${selectedForOutreach.size} 位达人` : `Contact ${selectedForOutreach.size} Creator${selectedForOutreach.size > 1 ? 's' : ''}`}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{m.outreachDeliveredBy}</p>

              {/* Selected creators preview */}
              <div className="flex flex-wrap gap-2 mt-3">
                {getSelectedCreatorObjects().map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-700">
                    <CreatorAvatar url={c.avatar_url} name={c.display_name || c.handle || '?'} size="w-5 h-5" textSize="text-[8px]" />
                    {c.display_name || `@${c.handle}`}
                    <button type="button" onClick={() => toggleSelectForOutreach(c)} className="text-gray-400 hover:text-gray-600">×</button>
                  </span>
                ))}
              </div>

              <textarea
                value={outreachMsg}
                onChange={(e) => setOutreachMsg(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder={m.writeMsgPlaceholder}
                className="mt-4 w-full px-4 py-3 rounded-xl text-sm focus:outline-none resize-none"
                style={{ border: '1px solid #e5e7eb' }}
              />
              <p className="text-right text-[11px] text-gray-400 mt-1">{outreachMsg.length}/2000</p>

              <div className="mt-2">
                {outreachFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {outreachFiles.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="flex items-center gap-2 pl-1.5 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-600">
                        {f.type.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={URL.createObjectURL(f)} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">PDF</span>
                        )}
                        <span className="max-w-[140px] truncate">{f.name}</span>
                        <button onClick={() => setOutreachFiles(outreachFiles.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600" aria-label="Remove">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 cursor-pointer">
                  <span className="text-base leading-none">＋</span> {m.addPhotosOrFiles}
                  <input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={(e) => { addOutreachFiles(e.target.files); e.target.value = '' }} />
                </label>
                <span className="ml-2 text-[11px] text-gray-400">{m.filesHint}</span>
              </div>

              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input type="checkbox" checked={rememberMsg} onChange={(e) => setRememberMsg(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-gray-600">{m.rememberMsg}</span>
              </label>

              {outreachError && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-700">{outreachError}</div>
              )}

              {outreachPrice != null && (
                <div className="mt-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2">
                  <span>✦</span>
                  <span>{zh
                    ? `将扣除 ${outreachPrice * selectedForOutreach.size} 积分（每位达人 ${outreachPrice} 积分 × ${selectedForOutreach.size} 位）`
                    : `${outreachPrice * selectedForOutreach.size} credits will be deducted (${outreachPrice} per creator × ${selectedForOutreach.size})`
                  }</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-4">
                <button onClick={() => setOutreachModalOpen(false)} disabled={outreachSending} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition disabled:opacity-50">
                  {m.cancelBtn}
                </button>
                <button onClick={sendOutreach} disabled={outreachSending || outreachMsg.trim().length < 10 || selectedForOutreach.size === 0} className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-rose-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  {outreachSending ? m.sendingMsg : `${m.sendMessage} (${selectedForOutreach.size})`}
                  {!outreachSending && outreachPrice != null && (
                    <span className="font-normal ml-1">· {outreachPrice * selectedForOutreach.size} {zh ? '积分' : 'credits'}</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>,
    document.body)}
  </div>
}
