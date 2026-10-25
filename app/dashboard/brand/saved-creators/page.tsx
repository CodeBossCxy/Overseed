'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { PlatformIcon } from '@/components/campaigns/CampaignRowCard'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import UGCTranslateToggle from '@/components/UGCTranslateToggle'
import CreatorAvatar from '@/components/ui/CreatorAvatar'
import CreatorDetailModal, { useCreatorDetail, type DiscoveredCreator } from '@/components/discovery/CreatorDetailModal'

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
  const { t, locale, isUGCTranslated } = useLanguage()
  const s = t.brand.savedCreators
  const zh = locale === 'zh'

  const [saved, setSaved] = useState<any[]>([])
  const [discoverySaved, setDiscoverySaved] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Brand-defined subfolders; '' = All
  const [folders, setFolders] = useState<{ id: string; name: string; count: number }[]>([])
  const [activeFolder, setActiveFolder] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderBusy, setFolderBusy] = useState(false)
  const [folderError, setFolderError] = useState('')
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('')
  const [country, setCountry] = useState('')
  const [category, setCategory] = useState('')
  const [minFollowers, setMinFollowers] = useState('')
  const [sort, setSort] = useState<'recent' | 'followers'>('recent')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set())
  const [bulkOutreachOpen, setBulkOutreachOpen] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')
  const [bulkFiles, setBulkFiles] = useState<File[]>([])
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkSent, setBulkSent] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // Contacted creators — for "Manage Collaboration" button state
  const [contactedKeys, setContactedKeys] = useState<Set<string>>(new Set())
  useEffect(() => {
    fetch('/api/discovery/contacted-keys')
      .then((res) => (res.ok ? res.json() : { keys: {} }))
      .then((data) => {
        if (data.keys && typeof data.keys === 'object') {
          setContactedKeys(new Set(Object.keys(data.keys)))
        }
      })
      .catch(() => {})
  }, [])

  // Creator detail modal (same as discover page)
  const {
    detailFor,
    detail,
    detailLoading,
    detailError,
    detailBlocked,
    featureUnlocks,
    featureUnlocked,
    featureLoading,
    featureError,
    featureConfirm,
    openDetail: openDetailHook,
    closeDetail,
    unlockFeature,
    unlockAudienceBundle,
    promptUnlock,
    dismissConfirm,
  } = useCreatorDetail()

  const openCreatorProfile = (row: any) => {
    const creator: DiscoveredCreator = {
      id: row._id,
      platform: row.platforms?.[0] || row.discoveryPlatform || 'instagram',
      handle: row.handle || row.discoveryHandle || null,
      display_name: row.name || null,
      bio: row.bio || null,
      country: row.country || null,
      follower_count: row.followers || null,
      engagement_rate: row.engagement || null,
      niche_tags: row.niche ? [row.niche] : [],
      profile_url: row.profileUrl || null,
      avatar_url: row.avatarUrl || null,
      score: null,
    }
    openDetailHook(creator)
  }

  useEffect(() => {
    setLoading(true)
    const url = isUGCTranslated ? `/api/saved-creators?lang=${locale}` : '/api/saved-creators'
    Promise.all([
      fetch(url).then((res) => (res.ok ? res.json() : { saved: [] })),
      fetch('/api/saved-creators/discovery').then((res) => (res.ok ? res.json() : { saved: [] })),
    ])
      .then(([data, disc]) => {
        setSaved(data.saved || [])
        setDiscoverySaved(disc.saved || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isUGCTranslated, locale])

  const loadFolders = () =>
    fetch('/api/saved-creators/folders')
      .then((res) => (res.ok ? res.json() : { folders: [] }))
      .then((data) => setFolders(data.folders || []))
      .catch(() => {})
  useEffect(() => { loadFolders() }, [])

  const createFolder = async () => {
    const name = folderName.trim()
    if (!name || folderBusy) return
    setFolderBusy(true); setFolderError('')
    try {
      const res = await fetch('/api/saved-creators/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || 'Could not create folder')
      setFolders((prev) => [...prev, data.folder])
      setActiveFolder(data.folder.id)
      setFolderName(''); setCreatingFolder(false); setPage(1)
    } catch (e: any) {
      setFolderError(e.message)
    } finally {
      setFolderBusy(false)
    }
  }

  const renameFolder = async (id: string) => {
    const current = folders.find((f) => f.id === id)
    const name = window.prompt(s.folderNamePlaceholder, current?.name || '')?.trim()
    if (!name || name === current?.name) return
    const res = await fetch('/api/saved-creators/folders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    })
    if (res.ok) setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)))
    else setFolderError((await res.json().catch(() => null))?.message || 'Rename failed')
  }

  const deleteFolder = async (id: string) => {
    if (!window.confirm(s.deleteFolderConfirm)) return
    const res = await fetch(`/api/saved-creators/folders?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      setFolders((prev) => prev.filter((f) => f.id !== id))
      setSaved((prev) => prev.map((row) => (row.folderId === id ? { ...row, folderId: null } : row)))
      if (activeFolder === id) setActiveFolder('')
    }
  }

  const moveToFolder = async (influencerId: string, folderId: string) => {
    setBusyId(influencerId)
    try {
      const res = await fetch('/api/saved-creators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId, folderId: folderId || null }),
      })
      if (res.ok) {
        setSaved((prev) => prev.map((row) => (row.influencerId === influencerId ? { ...row, folderId: folderId || null } : row)))
        loadFolders()
      }
    } finally {
      setBusyId(null)
    }
  }

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
    discoverySaved.forEach((row) => row.platform && set.add(row.platform))
    return [...set].sort()
  }, [saved, discoverySaved])

  const countries = useMemo(() => {
    const set = new Set<string>()
    saved.forEach((row) => row.influencer?.locationCountry && set.add(row.influencer.locationCountry))
    return [...set].sort()
  }, [saved])

  const categories = useMemo(() => {
    const set = new Set<string>()
    saved.forEach((row) => row.influencer?.primaryNiche && set.add(row.influencer.primaryNiche))
    discoverySaved.forEach((row) => (row.nicheTags || []).forEach((n: string) => set.add(n)))
    return [...set].sort()
  }, [saved, discoverySaved])

  const hasFilters = !!(query || platform || country || category || minFollowers)

  const visible = useMemo(() => {
    // Normalize platform-registered saves
    const registered = saved.map((row) => ({
      _type: 'registered' as const,
      _id: row.influencerId,
      name: row.influencer?.displayName || row.influencer?.user?.name || 'Creator',
      handle: row.influencer?.socialAccounts?.[0]?.username || null,
      avatarUrl: row.influencer?.avatarUrl || row.influencer?.user?.image || null,
      followers: maxFollowers(row.influencer),
      engagement: topEngagement(row.influencer),
      country: row.influencer?.locationCountry || null,
      niche: row.influencer?.primaryNiche || null,
      platforms: (row.influencer?.socialAccounts || []).map((a: any) => a.platform?.name).filter(Boolean),
      bio: row.influencer?.bio || null,
      isVerified: row.influencer?.isVerified || false,
      savedAt: row.savedAt,
      folderId: row.folderId || null,
      profileUrl: `/influencer/${row.influencerId}`,
      influencerId: row.influencerId,
      // discovery-specific fields (null for registered)
      discoveryId: null as string | null,
      discoveryPlatform: null as string | null,
      discoveryHandle: null as string | null,
    }))

    // Normalize discovery saves
    const discovery = discoverySaved.map((row) => ({
      _type: 'discovery' as const,
      _id: row.id,
      name: row.displayName || row.handle || 'Creator',
      handle: row.handle,
      avatarUrl: row.avatarUrl || null,
      followers: row.followerCount || 0,
      engagement: row.engagementRate != null ? Number(row.engagementRate) : null,
      country: null as string | null,
      niche: row.nicheTags?.[0] || null,
      platforms: [row.platform],
      bio: null as string | null,
      isVerified: false,
      savedAt: row.savedAt,
      folderId: row.folderId || null,
      profileUrl: row.handle ? (
        row.platform === 'instagram' ? `https://www.instagram.com/${row.handle}/` :
        row.platform === 'tiktok' ? `https://www.tiktok.com/@${row.handle}` :
        row.platform === 'youtube' ? `https://www.youtube.com/@${row.handle}` :
        null
      ) : null,
      influencerId: null as string | null,
      discoveryId: row.id,
      discoveryPlatform: row.platform,
      discoveryHandle: row.handle,
    }))

    let list = [...registered, ...discovery]
    if (activeFolder) list = list.filter((row) => row.folderId === activeFolder)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((row) =>
        row.name?.toLowerCase().includes(q) ||
        row.handle?.toLowerCase().includes(q)
      )
    }
    if (platform) {
      list = list.filter((row) => row.platforms.includes(platform))
    }
    if (country) list = list.filter((row) => row.country === country)
    if (category) list = list.filter((row) => row.niche === category)
    if (minFollowers) list = list.filter((row) => row.followers >= Number(minFollowers))
    if (sort === 'followers') {
      list.sort((a, b) => b.followers - a.followers)
    } else {
      list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    }
    return list
  }, [saved, discoverySaved, activeFolder, query, platform, country, category, minFollowers, sort])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const unsave = async (influencerId: string) => {
    setBusyId(influencerId)
    try {
      const res = await fetch(`/api/saved-creators?influencerId=${influencerId}`, { method: 'DELETE' })
      if (res.ok) {
        setSaved((prev) => prev.filter((row) => row.influencerId !== influencerId))
        loadFolders()
      }
    } finally {
      setBusyId(null)
    }
  }

  const unsaveDiscovery = async (id: string, platform: string, handle: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/saved-creators/discovery?platform=${encodeURIComponent(platform)}&handle=${encodeURIComponent(handle)}`, { method: 'DELETE' })
      if (res.ok) {
        setDiscoverySaved((prev) => prev.filter((row) => row.id !== id))
        loadFolders()
      }
    } finally {
      setBusyId(null)
    }
  }

  const toggleSelectCreator = (id: string) => {
    setSelectedCreators(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getSelectedCreatorObjects = () => {
    return visible.filter(row => selectedCreators.has(row._id))
  }

  const sendBulkOutreach = async () => {
    if (bulkSending || selectedCreators.size === 0) return
    setBulkSending(true)
    setBulkError(null)
    try {
      const creators = getSelectedCreatorObjects().map(c => ({
        platform: c.platforms[0] || 'unknown',
        handle: c.handle || c.name,
        displayName: c.name,
        avatarUrl: c.avatarUrl || '',
        followerCount: c.followers || 0,
        engagementRate: c.engagement || 0,
        country: c.country || '',
        nicheTags: c.niche ? [c.niche] : [],
        bio: c.bio || '',
        profileUrl: c.profileUrl || '',
      }))
      const res = await fetch('/api/outreach/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Outreach to ${creators.length} creators`,
          briefMessage: bulkMsg.trim(),
          platform: creators[0]?.platform || 'unknown',
          creators,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to send outreach')
      }
      setBulkSent(true)
      setSelectedCreators(new Set())
      setTimeout(() => { setBulkOutreachOpen(false); setBulkSent(false); setBulkMsg(''); setBulkFiles([]) }, 2000)
    } catch (e: any) {
      setBulkError(e.message)
    } finally {
      setBulkSending(false)
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
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              {s.title} › {s.breadcrumb}
            </p>
            <h1 className="text-3xl font-bold text-gray-900">{s.title}</h1>
            <p className="text-gray-500 mt-1">{s.subtitle}</p>
          </div>
          <UGCTranslateToggle isLoading={loading} />
        </div>

        {/* Folders */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setActiveFolder(''); setPage(1) }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              activeFolder === '' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'bg-white/45 text-gray-600 hover:bg-white/70'
            }`}
          >
            {s.all} <span className="text-gray-400 font-normal">({saved.length + discoverySaved.length})</span>
          </button>
          {folders.map((f) => (
            <span key={f.id} className="inline-flex items-center">
              <button
                onClick={() => { setActiveFolder(f.id); setPage(1) }}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  activeFolder === f.id ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'bg-white/45 text-gray-600 hover:bg-white/70'
                }`}
              >
                📁 {f.name} <span className="text-gray-400 font-normal">({f.count})</span>
              </button>
              {activeFolder === f.id && (
                <span className="ml-1 flex gap-0.5">
                  <button onClick={() => renameFolder(f.id)} title={s.renameFolder} className="px-1.5 py-1 text-xs text-gray-400 hover:text-gray-700 transition">✎</button>
                  <button onClick={() => deleteFolder(f.id)} title={s.deleteFolder} className="px-1.5 py-1 text-xs text-gray-400 hover:text-red-500 transition">🗑</button>
                </span>
              )}
            </span>
          ))}
          {creatingFolder ? (
            <span className="inline-flex items-center gap-1.5">
              <input
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setFolderName(''); setFolderError('') } }}
                maxLength={40}
                placeholder={s.folderNamePlaceholder}
                className="px-3 py-1.5 workspace-glass-control text-sm focus:outline-none w-40"
              />
              <button onClick={createFolder} disabled={folderBusy || !folderName.trim()} className="px-3 py-1.5 rounded-full text-sm font-semibold bg-primary-600 text-white disabled:opacity-50">{s.createFolder}</button>
              <button onClick={() => { setCreatingFolder(false); setFolderName(''); setFolderError('') }} className="px-2 py-1.5 text-sm text-gray-500">{s.folderCancel}</button>
            </span>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold text-primary-600 bg-white/45 hover:bg-white/70 transition"
            >
              + {s.newFolder}
            </button>
          )}
          {folderError && <span className="text-xs text-red-600">{folderError}</span>}
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

        {/* Bulk selection bar */}
        {selectedCreators.size > 0 && (
          <div className="mb-4 workspace-glass-card rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {selectedCreators.size} {zh ? '位创作者已选择 — 准备批量联系' : `creator${selectedCreators.size > 1 ? 's' : ''} selected — ready for bulk outreach`}
              </span>
              <button
                onClick={() => setSelectedCreators(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700 transition"
              >
                {zh ? '清除' : 'Clear'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {getSelectedCreatorObjects().slice(0, 3).map(c => (
                  <CreatorAvatar key={c._id} url={c.avatarUrl} name={c.name} size="w-8 h-8" textSize="text-xs" className="ring-2 ring-white" />
                ))}
              </div>
              <span className="text-sm text-gray-500">{selectedCreators.size} {zh ? '已选' : 'selected'}</span>
              <button
                onClick={() => setBulkOutreachOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {zh ? '批量联系' : 'Bulk Contact'} ↗
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="workspace-glass-card rounded-2xl p-10 text-center text-gray-400 text-sm">…</div>
        ) : saved.length === 0 && discoverySaved.length === 0 ? (
          <div className="workspace-glass-card rounded-2xl p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">{s.empty}</p>
            <p className="text-gray-400">{s.emptyDesc}</p>
          </div>
        ) : paged.length === 0 ? (
          <div className="workspace-glass-card rounded-2xl p-10 text-center text-gray-500">{s.noMatches}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paged.map((row) => {
              const platformName = row.platforms[0] || row.discoveryPlatform || 'instagram'
              const profileUrl = row.profileUrl || (row.handle ? (
                platformName === 'instagram' ? `https://www.instagram.com/${row.handle}/` :
                platformName === 'tiktok' ? `https://www.tiktok.com/@${row.handle}` :
                platformName === 'youtube' ? `https://www.youtube.com/@${row.handle}` : null
              ) : null)
              const PLATFORM_LABELS: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' }
              return (
              <div key={row._id} className={`workspace-glass-card rounded-2xl p-5 transition-colors ${selectedCreators.has(row._id) ? 'ring-2 ring-primary-400 bg-primary-50/30' : ''}`}>
                {/* Top section: avatar + info + platform link */}
                <div className="flex gap-4">
                  {/* Avatar with gradient ring */}
                  <div className="flex-shrink-0">
                    <div className="w-[80px] h-[80px] rounded-full p-[3px] bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600">
                      <div className="w-full h-full rounded-full bg-white p-[2px]">
                        <div className="w-full h-full rounded-full bg-gray-100 overflow-hidden">
                          <CreatorAvatar url={row.avatarUrl} name={row.name} size="w-full h-full" textSize="text-xl" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Name, handle, badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-extrabold text-lg text-gray-900 truncate leading-tight uppercase tracking-wide">
                          {row.name}
                        </p>
                        {row.handle && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-sm text-gray-400">@{row.handle}</p>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(row.handle || '')}
                              className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Open on Platform link */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {profileUrl && (
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                          >
                            <PlatformIcon name={platformName} />
                            {zh ? `在${PLATFORM_LABELS[platformName] || platformName}上查看` : `Open on ${PLATFORM_LABELS[platformName] || platformName}`}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                            </svg>
                          </a>
                        )}
                        <span className="text-[10px] text-gray-400">{savedAgo(row.savedAt)}</span>
                      </div>
                    </div>
                    {/* Bio */}
                    {row.bio && <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">{row.bio}</p>}
                    {/* Niche tags */}
                    {row.niche && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                          {t.categoryNames[row.niche] || row.niche}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom row: followers + actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100/80">
                  {/* Followers */}
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    <span className="text-lg font-bold text-gray-900">{row.followers ? compact(row.followers) : '—'}</span>
                    <span className="text-sm text-gray-400">{s.followers}</span>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => openCreatorProfile(row)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-400 to-slate-400 text-white rounded-full text-xs font-semibold hover:from-indigo-500 hover:to-slate-500 transition shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      {s.viewProfile}
                    </button>
                    {(() => {
                      const contactKey = row.handle ? `${row.platforms[0] || row.discoveryPlatform || 'instagram'}:${row.handle}` : null
                      const isContacted = contactKey ? contactedKeys.has(contactKey) : false
                      if (isContacted) {
                        return (
                          <button
                            type="button"
                            onClick={() => openCreatorProfile(row)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {zh ? '管理合作' : 'Manage'}
                          </button>
                        )
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => toggleSelectCreator(row._id)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition ${
                            selectedCreators.has(row._id)
                              ? 'bg-primary-50 border border-primary-300 text-primary-700'
                              : 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                          }`}
                        >
                          {selectedCreators.has(row._id) ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              {zh ? '已添加联系' : 'Added'}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                              {zh ? '联系' : 'Contact'}
                            </>
                          )}
                        </button>
                      )
                    })()}
                    <button
                      type="button"
                      onClick={() => row._type === 'discovery' ? unsaveDiscovery(row._id, row.discoveryPlatform!, row.discoveryHandle!) : unsave(row._id)}
                      disabled={busyId === row._id}
                      className="w-9 h-9 flex items-center justify-center rounded-full border bg-amber-50 border-amber-200 text-amber-600 transition flex-shrink-0 disabled:opacity-50"
                      title={s.savedState}
                    >
                      <svg className="w-5 h-5" fill="currentColor" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                      </svg>
                    </button>
                  </div>
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
      {/* Bulk outreach modal */}
      {bulkOutreachOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !bulkSending && setBulkOutreachOpen(false)}>
          <div data-solid className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ backgroundColor: 'white' }} onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {zh ? `批量联系 ${selectedCreators.size} 位创作者` : `Bulk Contact ${selectedCreators.size} Creator${selectedCreators.size > 1 ? 's' : ''}`}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {zh ? '发送统一的联系消息给所有选中的创作者' : 'Send a unified outreach message to all selected creators'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {bulkSent ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-900">{zh ? '联系请求已发送！' : 'Outreach sent!'}</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={bulkMsg}
                    onChange={e => setBulkMsg(e.target.value)}
                    maxLength={2000}
                    rows={5}
                    placeholder={zh ? '输入您的联系消息...' : 'Write your outreach message...'}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{bulkMsg.length}/2000</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={e => setBulkFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
                      />
                      <span className="text-primary-600 hover:text-primary-700 font-medium">
                        + {zh ? '添加附件' : 'Attach files'}
                      </span>
                    </label>
                  </div>
                  {bulkFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {bulkFiles.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                          {f.name}
                          <button onClick={() => setBulkFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
                </>
              )}
            </div>
            {!bulkSent && (
              <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => setBulkOutreachOpen(false)}
                  disabled={bulkSending}
                  className="px-5 py-2 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
                >
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={sendBulkOutreach}
                  disabled={bulkSending || !bulkMsg.trim()}
                  className="px-6 py-2 rounded-full bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 transition disabled:opacity-50 shadow-sm"
                >
                  {bulkSending ? (zh ? '发送中...' : 'Sending...') : (zh ? '发送联系请求' : 'Send Outreach')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Creator detail popup (same as discover page) */}
      {detailFor && (
        <CreatorDetailModal
          creator={detailFor}
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          detailBlocked={detailBlocked}
          featureUnlocks={featureUnlocks}
          featureUnlocked={featureUnlocked}
          featureLoading={featureLoading}
          featureError={featureError}
          featureConfirm={featureConfirm}
          onClose={closeDetail}
          onUnlockFeature={unlockFeature}
          onUnlockAudienceBundle={unlockAudienceBundle}
          onPromptUnlock={promptUnlock}
          onDismissConfirm={dismissConfirm}
          onDismissFeatureError={() => {}}
          onOpenRelated={(creator) => openDetailHook(creator)}
          savedKeys={new Set()}
          onToggleSave={() => {}}
          onOpenContact={() => {}}
          nicheMap={{}}
          zh={locale === 'zh'}
          locale={locale}
          t={t}
        />
      )}
    </BrandWorkspaceLayout>
  )
}
