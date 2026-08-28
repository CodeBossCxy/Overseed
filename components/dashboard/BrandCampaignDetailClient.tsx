'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type Creator = {
  id: string; platform: string; handle: string | null; display_name: string | null
  bio: string | null; country: string | null; follower_count: number | null
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
  const { locale } = useLanguage()
  const router = useRouter()
  const [campaign, setCampaign] = useState(initialCampaign)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
        <h3 className="font-bold text-lg">Delete this campaign?</h3>
        <p className="text-sm text-[#59678f] mt-2">This will permanently delete the campaign and all related data. This cannot be undone.</p>
        {canCancel && (
          <p className="text-sm text-[#59678f] mt-2">You can also cancel the campaign instead — it stays in your pipeline with its history, but stops accepting applications.</p>
        )}
        <p className="text-sm font-semibold mt-3 truncate">{campaign.title}</p>
        <div className="flex flex-wrap justify-end gap-2 mt-6">
          <button onClick={() => setShowDelete(false)} disabled={deleting} className="px-4 py-2 text-sm font-medium text-[#59678f] hover:text-[#17255f] rounded-xl transition disabled:opacity-50">
            Keep campaign
          </button>
          {canCancel && (
            <button onClick={() => removeCampaign('cancel')} disabled={deleting} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50">
              Cancel campaign
            </button>
          )}
          <button onClick={() => removeCampaign('delete')} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50">
            {deleting ? '…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  )
  const [tab, setTab] = useState<'detail' | 'direct'>('detail')
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('youtube')
  const [source, setSource] = useState<'kol' | 'club'>('kol')
  const [country, setCountry] = useState('')
  const [minFollowers, setMinFollowers] = useState('')
  const [creators, setCreators] = useState<Creator[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [queueBusy, setQueueBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Creator | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadQueue = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaign.id}/outreach`)
    if (res.ok) setQueue((await res.json()).queue || [])
  }, [campaign.id])

  const discover = useCallback(async (search = '') => {
    setLoading(true); setError('')
    const qs = new URLSearchParams({ limit: source === 'club' ? '10' : '50' })
    if (search.trim()) {
      qs.set('q', search.trim()); qs.set(source === 'club' ? 'platform' : 'platforms', platform)
      if (source === 'kol') qs.set('topics', search.trim())
    } else {
      qs.set('platform', platform); qs.set('sort', 'followers')
    }
    if (country) qs.set('country', country.toUpperCase())
    if (minFollowers) qs.set('min_followers', minFollowers)
    try {
      const endpoint = source === 'club' ? 'club-search' : (search.trim() ? 'search' : 'creators')
      const res = await fetch(`/api/discovery/${endpoint}?${qs}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || 'Creator discovery is temporarily unavailable.')
      setCreators(data?.results || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [country, minFollowers, platform, source])

  useEffect(() => { discover(); loadQueue() }, []) // eslint-disable-line react-hooks/exhaustive-deps
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
  const budget = campaign.paymentMin ? `$${Number(campaign.paymentMin).toLocaleString()}${campaign.paymentMax ? ` – $${Number(campaign.paymentMax).toLocaleString()}` : '+'}` : campaign.giftDescription || 'Negotiable'
  const cover = campaign.images?.[0]

  const campaignTabs = <div className="flex gap-2 mb-5 p-1.5 w-fit rounded-2xl bg-white/35 border border-white/50">
    <button onClick={() => setTab('detail')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'detail' ? 'bg-white/80 shadow-sm text-[#17255f]' : 'text-[#7180ad]'}`}>Campaign Detail</button>
    <button onClick={() => setTab('direct')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'direct' ? 'bg-white/80 shadow-sm text-[#17255f]' : 'text-[#7180ad]'}`}>Direct Outreach</button>
  </div>

  if (tab === 'detail') {
    const category = campaign.categories.map(c => c.category.name).join(' & ') || 'Campaign'
    const platforms = campaign.platforms.map(p => p.platform.name).join(', ') || 'All platforms'
    const remaining = Math.max(0, campaign.totalSlots - campaign.filledSlots)
    const progress = campaign.totalSlots ? Math.min(100, (campaign.filledSlots / campaign.totalSlots) * 100) : 0
    const requirements = [
      ...(campaign.followerRequirements || []).map(r => `Minimum ${compact(r.minFollowers)} ${r.platform.name} followers${r.minEngagementRate ? ` · ${Number(r.minEngagementRate)}% engagement` : ''}`),
      campaign.hashtagsRequired ? `Required hashtags: ${campaign.hashtagsRequired}` : null,
      campaign.mentionsRequired ? `Required mentions: ${campaign.mentionsRequired}` : null,
    ].filter(Boolean) as string[]
    const statusLabel = campaign.status.toLowerCase().replaceAll('_', ' ')
    return <div className="campaign-manage max-w-[1500px] mx-auto workspace-page-tight pb-8 text-[#17255f]">
      <div className="flex items-center gap-2 text-sm text-[#6272a4] mb-5"><Link href="/dashboard/brand/campaigns">Campaign Pipeline</Link><span>›</span><b className="text-[#17255f]">{campaign.title}</b></div>
      {campaignTabs}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
        <div className="min-w-0 space-y-4">
          <header>
            <h1 className="text-4xl font-bold tracking-tight">{campaign.title}</h1>
            <p className="text-[#6876a1] mt-1">Manage and track your campaign performance.</p>
            <div className="flex flex-wrap gap-5 items-center mt-5 text-sm">
              <span className="px-4 py-2 rounded-full bg-violet-50 text-violet-700 font-semibold">✦ &nbsp;{category}</span>
              <span>▣ &nbsp; Posted {new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span>▣ &nbsp; Deadline {campaign.deadline ? new Date(campaign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible'}</span>
              <span className="px-4 py-2 rounded-full bg-violet-100 text-violet-700 font-semibold capitalize">● &nbsp;{statusLabel}</span>
            </div>
          </header>

          <div className="h-72 md:h-[360px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#f3e4d9] to-[#ead4c5]">{cover ? <img src={cover} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex flex-col items-center justify-center text-[#947f79]"><span className="text-7xl">✦</span><span className="mt-3">Campaign cover</span></div>}</div>

          <section className="workspace-glass-card rounded-3xl p-6">
            <h2 className="text-xl font-bold">About This Campaign</h2>
            <p className="text-sm leading-6 text-[#59678f] mt-2 whitespace-pre-line">{campaign.description || 'No campaign description has been added yet.'}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6 pt-5 border-t border-white/60 text-sm">
              <div><p className="text-[#7884a8]">Platforms</p><b>{platforms}</b></div>
              <div><p className="text-[#7884a8]">Creator Type</p><b>{category} Creators</b></div>
              <div><p className="text-[#7884a8]">Campaign Period</p><b>{campaign.campaignStartDate ? new Date(campaign.campaignStartDate).toLocaleDateString() : 'Flexible'}</b></div>
              <div><p className="text-[#7884a8]">Compensation</p><b>{budget}</b></div>
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="workspace-glass-card rounded-3xl p-6"><h2 className="text-xl font-bold mb-4">Requirements</h2>{requirements.length ? <ul className="space-y-3 text-sm text-[#59678f]">{requirements.map(r => <li key={r} className="flex gap-2"><span className="text-violet-500">●</span>{r}</li>)}</ul> : <p className="text-sm text-[#7884a8]">No additional creator requirements.</p>}</section>
            <section className="workspace-glass-card rounded-3xl p-6"><h2 className="text-xl font-bold mb-4">Deliverables</h2><div className="flex gap-3"><span className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">▣</span><div><b>{campaign.contentType ? campaign.contentType.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()) : 'Campaign content'}</b><p className="text-sm text-[#66739a] mt-1 whitespace-pre-line">{campaign.contentGuidelines || 'Final deliverables will be confirmed through Overseed.'}</p></div></div></section>
          </div>

          <section className="workspace-glass-card rounded-3xl p-6 flex gap-5"><span className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">▣</span><div className="grid md:grid-cols-3 gap-6 flex-1 text-sm"><div><p className="text-[#7884a8]">Application Window</p><b>{campaign.deadline ? `Until ${new Date(campaign.deadline).toLocaleDateString()}` : 'Open-ended'}</b></div><div><p className="text-[#7884a8]">Content Due</p><b>{campaign.campaignEndDate ? new Date(campaign.campaignEndDate).toLocaleDateString() : 'To be confirmed'}</b></div><div><p className="text-[#7884a8]">Notes</p><b>{campaign.hashtagsRequired || 'Managed through Overseed'}</b></div></div></section>
        </div>

        <aside className="workspace-glass-card rounded-3xl p-7 xl:sticky xl:top-5">
          <div className="flex justify-between"><b>Status</b><span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold capitalize">● &nbsp;{statusLabel}</span></div>
          <div className="mt-7"><p className="text-sm text-[#7180ad]">Compensation</p><div className="flex justify-between items-end mt-2"><b className="text-2xl capitalize">{campaign.compensationType.toLowerCase().replaceAll('_',' ')}</b>{campaign.giftValue && <div className="text-right"><p className="text-xs text-[#7180ad]">Gift value</p><b className="text-xl">${Number(campaign.giftValue).toLocaleString()}</b></div>}</div></div>
          <div className="border-t border-white/70 mt-6 pt-6 space-y-5"><div className="flex justify-between"><span>Applications</span><b>{stats.total}</b></div><div><div className="flex justify-between"><span>Spots Filled</span><b>{campaign.filledSlots} / {campaign.totalSlots}</b></div><div className="h-2 bg-slate-200/70 rounded-full mt-3"><div className="h-full bg-blue-500 rounded-full" style={{width:`${progress}%`}}/></div><p className="text-xs text-[#7884a8] mt-2">{remaining} spots remaining</p></div><div className="flex justify-between border-t border-white/70 pt-5"><span>Views</span><b>{campaign.viewCount}</b></div></div>
          <div className="space-y-3 mt-7"><Link href={`/dashboard/brand/campaigns/${campaign.id}/applications`} className="block text-center py-4 rounded-xl bg-blue-600 text-white font-semibold">View Applications</Link><Link href={`/dashboard/brand/campaigns/${campaign.id}/edit`} className="block text-center py-4 rounded-xl border border-white bg-white/25 font-semibold">Edit Campaign</Link><button type="button" onClick={() => setShowDelete(true)} className="block w-full text-center py-4 rounded-xl border border-red-200 bg-red-50/60 text-red-600 font-semibold hover:bg-red-100 transition">Delete Campaign</button></div>
          <div className="border-t border-white/70 mt-7 pt-6"><p className="text-xs text-[#7884a8]">Campaign owner</p><div className="flex gap-3 items-center mt-3"><span className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center font-bold overflow-hidden">{campaign.brand?.logoUrl ? <img src={campaign.brand.logoUrl} alt="" className="w-full h-full object-cover"/> : (campaign.brand?.companyName || 'B').slice(0, 2).toUpperCase()}</span><div><b>{campaign.brand?.companyName || 'Brand'}</b><p className="text-xs text-[#7884a8]">Brand Account</p></div></div></div>
        </aside>
      </div>
      {deleteModal}
    </div>
  }

  return <div className="campaign-manage max-w-[1500px] mx-auto workspace-page-tight pb-8 text-[#17255f]">
    <div className="mb-5">
      <h1 className="text-3xl font-bold tracking-tight">Campaign Pipeline</h1>
      <div className="flex items-center gap-2 mt-2 text-sm text-[#6272a4]">
        <Link href="/dashboard/brand/campaigns">Campaign Pipeline</Link><span>›</span><span>{campaign.title}</span><span>›</span><b className="text-[#17255f]">Manage Campaign</b>
      </div>
    </div>

    {campaignTabs}
    <section className="workspace-glass-card rounded-3xl p-4 md:p-5 mb-4 flex flex-col md:flex-row md:items-center gap-5">
      <div className="w-full md:w-40 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-[#f2e9dd] to-[#d9c4ae]">{cover ? <img src={cover} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl">✦</div>}</div>
      <div className="flex-1">
        <h2 className="text-xl font-bold">{campaign.title}</h2>
        <p className="text-sm text-[#7180ad] mt-1">{campaign.categories.map(c => c.category.name).join(', ') || 'Lifestyle'} &nbsp;·&nbsp; {campaign.platforms.map(p => p.platform.name).join(', ') || 'All platforms'}</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-7 mt-4 max-w-2xl">
          <div><p className="text-xs text-[#7f8bb1]">Budget</p><b>{budget}</b></div>
          <div><p className="text-xs text-[#7f8bb1]">Deadline</p><b>{campaign.deadline ? new Date(campaign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible'}</b></div>
          <div><p className="text-xs text-[#7f8bb1]">Status</p><span className="inline-flex mt-1 px-3 py-1 rounded-md bg-slate-100 text-xs font-semibold capitalize">{campaign.status.toLowerCase().replace('_', ' ')}</span></div>
        </div>
      </div>
      <Link href={`/dashboard/brand/campaigns/${campaign.id}/edit`} className="rounded-2xl border border-white/80 bg-white/40 px-6 py-3 font-semibold text-sm">View Campaign Details &nbsp;→</Link>
    </section>

    <div className="grid xl:grid-cols-[minmax(0,1fr)_390px] gap-4 items-start">
      <div className="min-w-0">
        <>
          <section className="workspace-glass-card rounded-3xl p-5 mb-4">
            <div className="flex gap-4 items-center"><div className="w-12 h-12 rounded-2xl bg-white/70 text-indigo-600 flex items-center justify-center">{icon(sparkle)}</div><div className="flex-1"><b>Contact details are managed by Overseed.</b><p className="text-sm text-[#7180ad] mt-1">Shortlist creators here. Overseed handles invitations, replies, and next steps on your behalf.</p></div><span className="hidden md:block text-sm font-semibold">Learn how it works &nbsp;→</span></div>
            <div className="mt-5 grid md:grid-cols-4 gap-2 bg-white/25 rounded-2xl p-3 text-sm">{[['Shortlist','Find & add creators'],['Overseed Outreach','We contact them'],['Creator Response','They reply to Overseed'],['Collaboration','Agree, brief & create']].map(([a,b], i) => <div key={a} className="flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-white/75 flex items-center justify-center text-indigo-500">{i+1}</span><div><b>{a}</b><p className="text-xs text-[#7d88aa]">{b}</p></div>{i<3 && <span className="ml-auto hidden md:block">→</span>}</div>)}</div>
          </section>

          <form onSubmit={e => { e.preventDefault(); discover(query) }} className="mb-4">
            <div className="flex gap-2"><div className="workspace-glass-control flex-1 flex items-center gap-3 px-4 py-3">{icon(searchIcon, 'w-4 h-4')}<input value={query} onChange={e => setQuery(e.target.value)} className="bg-transparent outline-none w-full" placeholder="Search by name, handle, niche or keyword…"/></div><button className="px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold">Search</button></div>
            <div className="flex flex-wrap gap-2 mt-3">
              <select value={source} onChange={e => setSource(e.target.value as any)} className="workspace-glass-control px-3 py-2 text-sm"><option value="kol">Creator database</option><option value="club">Extended network</option></select>
              <select value={platform} onChange={e => setPlatform(e.target.value)} className="workspace-glass-control px-3 py-2 text-sm"><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select>
              <input value={country} onChange={e => setCountry(e.target.value)} maxLength={2} placeholder="Country" className="workspace-glass-control w-28 px-3 py-2 text-sm uppercase"/>
              <input type="number" value={minFollowers} onChange={e => setMinFollowers(e.target.value)} placeholder="Min followers" className="workspace-glass-control w-36 px-3 py-2 text-sm"/>
              <button type="button" onClick={() => { setQuery(''); setCountry(''); setMinFollowers(''); discover('') }} className="px-3 text-sm text-[#65739e]">Clear all</button>
            </div>
          </form>
          {error && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <div className="flex items-center justify-between mb-3"><b>{loading ? 'Finding creators…' : `${creators.length} creators found`}</b><span className="text-sm text-[#7180ad]">Sort by: <b>Relevance</b></span></div>
          <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {creators.map(c => <article key={c.id} className="workspace-glass-card rounded-3xl p-5 min-h-64 flex flex-col">
              <div className="flex gap-3 items-center">{avatar(c)}<div className="min-w-0"><button onClick={() => openCreator(c)} className="font-bold truncate block max-w-full text-left hover:text-indigo-600">{c.display_name || c.handle || 'Creator'} <span className="text-indigo-500">●</span></button><p className="text-xs text-[#7581a5] truncate">@{c.handle?.replace(/^@/, '') || 'creator'}</p><span className="text-xs mt-1 inline-block px-2 py-0.5 rounded bg-white/50">{PLATFORM_LABEL[c.platform] || c.platform}</span></div></div>
              <div className="grid grid-cols-2 gap-4 mt-5"><div><b className="text-xl">{compact(c.follower_count)}</b><p className="text-xs text-[#7d88aa]">Followers</p></div><div><b className="text-xl">{c.engagement_rate == null ? '—' : `${Number(c.engagement_rate).toFixed(1)}%`}</b><p className="text-xs text-[#7d88aa]">Eng. rate</p></div></div>
              <div className="flex flex-wrap gap-1 mt-4">{c.niche_tags.slice(0,3).map(t => <span key={t} className="text-xs bg-white/50 rounded-full px-2.5 py-1">{t}</span>)}</div>
              <div className="flex gap-2 mt-auto pt-5"><button onClick={() => openCreator(c)} className="flex-1 py-2 rounded-xl border border-white bg-white/25 text-sm font-semibold">View profile</button><button disabled={queuedIds.has(c.id) || queueBusy} onClick={() => addCreator(c)} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white text-sm font-semibold disabled:opacity-50">{queuedIds.has(c.id) ? 'Added' : '+ Add to campaign'}</button></div>
            </article>)}
          </div>
        </>
      </div>

      <aside className="workspace-glass-card rounded-3xl p-5 xl:sticky xl:top-5">
        <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Outreach Queue <span className="text-sm border border-white rounded-lg px-2 py-1 ml-1">{queue.length}</span></h2><span>⌃</span></div>
        <p className="text-sm text-[#7180ad] mt-1">Creators you&apos;ve added to this campaign</p>
        <div className="space-y-4 mt-6 max-h-[430px] overflow-auto pr-1">{queue.length === 0 && <div className="py-10 text-center text-sm text-[#7b87aa]">Add creators to build your outreach queue.</div>}{queue.map(q => <div key={q.id} className="flex items-center gap-3">{avatar(q, 'w-10 h-10')}<div className="min-w-0 flex-1"><b className="block truncate text-sm">{q.displayName || q.handle || 'Creator'}</b><p className="text-xs text-[#7e89aa] truncate">@{q.handle?.replace(/^@/, '')}</p></div><span className={`text-[10px] whitespace-nowrap px-2.5 py-1.5 rounded-lg ${STATUS_STYLE[q.status] || STATUS_STYLE.SHORTLISTED}`}>{q.status.replaceAll('_',' ').toLowerCase()}</span>{q.status === 'SHORTLISTED' && <button onClick={() => removeCreator(q.id)} className="text-[#7180ad]">×</button>}</div>)}</div>
        <div className="mt-6 bg-indigo-50/60 rounded-2xl p-4 text-sm"><b>ⓘ &nbsp;About outreach</b><p className="text-xs text-[#6775a0] mt-2">Overseed will contact creators on your behalf. You&apos;ll be notified when they respond.</p></div>
        <button disabled={!queue.some(q => q.status === 'SHORTLISTED') || queueBusy} onClick={requestOutreach} className="w-full mt-5 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold disabled:opacity-50">✈ &nbsp; Request Overseed Outreach</button>
        <p className="text-center text-xs text-[#7d88aa] mt-3">You can review and edit your queue before sending.</p>
      </aside>
    </div>

    {selected && <div className="fixed inset-0 z-50 bg-[#18204b]/35 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}><div className="bg-[#fbfbff] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-auto" onClick={e => e.stopPropagation()}>
      <div className="p-7 flex justify-between"><div className="flex gap-5">{avatar(selected, 'w-24 h-24')}<div><h2 className="text-2xl font-bold">{selected.display_name || selected.handle} <span className="text-indigo-500">●</span></h2><p className="text-[#7180ad]">@{selected.handle?.replace(/^@/,'')}</p><p className="text-sm mt-2">{PLATFORM_LABEL[selected.platform]} {selected.country && ` · ${selected.country}`}</p></div></div><button onClick={() => setSelected(null)} className="text-2xl self-start">×</button></div>
      <div className="px-7 grid grid-cols-2 md:grid-cols-4 gap-3">{[['Followers',compact(detail?.total_followers ?? selected.follower_count)],['Engagement',selected.engagement_rate == null ? '—' : `${Number(selected.engagement_rate).toFixed(1)}%`],['Country',detail?.location || selected.country || '—'],['Match score',selected.score == null ? '—' : `${Math.round(selected.score)}%`]].map(([k,v]) => <div key={k} className="border border-slate-100 rounded-2xl p-4"><b className="text-xl">{v}</b><p className="text-xs text-[#7d88aa] mt-1">{k}</p></div>)}</div>
      <div className="p-7"><h3 className="font-bold">About</h3><p className="text-sm leading-6 text-[#5f6c95] mt-2">{detailLoading ? 'Loading creator profile…' : detail?.bio || selected.bio || 'Creator profile details are available through Overseed.'}</p><div className="flex flex-wrap gap-2 mt-4">{(detail?.niche || selected.niche_tags).slice(0,8).map((t:string) => <span key={t} className="bg-indigo-50 text-indigo-700 rounded-full px-3 py-1 text-xs">{t}</span>)}</div></div>
      <div className="border-t border-slate-100 p-5 flex items-center gap-3 justify-between"><div className="text-xs text-[#7180ad]">🛡 Business contact is managed by Overseed.<br/>Contact details are never shared directly.</div><button disabled={queuedIds.has(selected.id) || queueBusy} onClick={() => addCreator(selected)} className="px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold disabled:opacity-50">{queuedIds.has(selected.id) ? 'Added to outreach queue' : '+ Add to Outreach Queue'}</button></div>
    </div></div>}
  </div>
}
