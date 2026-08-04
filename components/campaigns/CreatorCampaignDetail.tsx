'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type Props = {
  campaign: any
  isOwner?: boolean
  hasApplied?: boolean
  isSaved?: boolean
  isAuthenticated?: boolean
  userType?: string | null
  subscriptionTier?: string | null
}

const compact = (value: number) => new Intl.NumberFormat('en-US', {
  notation: 'compact', maximumFractionDigits: 1,
}).format(value)

const pretty = (value?: string | null) => value
  ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  : 'Campaign content'

export default function CreatorCampaignDetail({
  campaign, isOwner = false, hasApplied = false, isSaved = false,
  isAuthenticated = false, userType, subscriptionTier,
}: Props) {
  const { t } = useLanguage()
  const [saved, setSaved] = useState(isSaved)
  const [saveBusy, setSaveBusy] = useState(false)
  const spotsLeft = Math.max(0, campaign.totalSlots - campaign.filledSlots)
  const progress = campaign.totalSlots ? Math.min(100, (campaign.filledSlots / campaign.totalSlots) * 100) : 0
  const isDeadlinePassed = Boolean(campaign.deadline && new Date(campaign.deadline) < new Date())
  const category = campaign.categories.map((item: any) => item.category.name).join(' & ') || 'Campaign'
  const platforms = campaign.platforms.map((item: any) => item.platform.name).join(', ') || 'All platforms'
  const cover = campaign.images?.[0] || campaign.media?.find((item: any) => item.mediaType !== 'video')?.mediaUrl
  const budget = campaign.paymentMin
    ? `$${Number(campaign.paymentMin).toLocaleString()}${campaign.paymentMax ? ` – $${Number(campaign.paymentMax).toLocaleString()}` : '+'}`
    : campaign.giftDescription || pretty(campaign.compensationType)
  const requirements = [
    ...(campaign.followerRequirements || []).map((requirement: any) =>
      `Minimum ${compact(requirement.minFollowers)} ${requirement.platform.name} followers${requirement.minEngagementRate ? ` · ${Number(requirement.minEngagementRate)}% engagement` : ''}`),
    campaign.hashtagsRequired ? `Required hashtags: ${campaign.hashtagsRequired}` : null,
    campaign.mentionsRequired ? `Required mentions: ${campaign.mentionsRequired}` : null,
  ].filter(Boolean) as string[]

  const toggleSave = async () => {
    setSaveBusy(true)
    const next = !saved
    setSaved(next)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/save`, { method: next ? 'POST' : 'DELETE' })
      if (!response.ok) setSaved(!next)
    } catch {
      setSaved(!next)
    } finally {
      setSaveBusy(false)
    }
  }

  const primaryAction = () => {
    if (isOwner) return <Link href={`/dashboard/brand/campaigns/${campaign.id}`} className="block rounded-xl bg-blue-600 py-4 text-center font-semibold text-white">Manage Campaign</Link>
    if (userType === 'BRAND') return <p className="py-3 text-center text-sm text-[#7180ad]">{t.campaign.onlyCreatorsCanApply}</p>
    if (isDeadlinePassed) return <p className="py-3 text-center font-semibold text-red-600">{t.campaign.deadlinePassed}</p>
    if (spotsLeft === 0) return <p className="py-3 text-center font-semibold text-orange-600">{t.campaign.allSpotsFilled}</p>
    if (hasApplied) return <button disabled className="w-full rounded-xl bg-slate-200 py-4 font-semibold text-slate-500">{t.campaign.alreadyApplied}</button>
    if (!isAuthenticated) return <Link href="/auth/signin" className="block rounded-xl bg-blue-600 py-4 text-center font-semibold text-white">{t.campaign.signInToApply}</Link>
    if (subscriptionTier === 'FREE') return <Link href="/dashboard/upgrade" className="block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-center font-semibold text-white">{t.campaign.upgradeToProToApply}</Link>
    return <Link href={`/campaign/${campaign.id}/apply`} className="block rounded-xl bg-blue-600 py-4 text-center font-semibold text-white">{t.campaign.applyNow}</Link>
  }

  return <div className="text-[#17255f]">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <main className="min-w-0 space-y-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{campaign.title}</h1>
          <p className="mt-1 text-[#6876a1]">Review the campaign details and apply to collaborate.</p>
          <div className="mt-5 flex flex-wrap items-center gap-5 text-sm">
            <span className="rounded-full bg-violet-50 px-4 py-2 font-semibold text-violet-700">✦ &nbsp;{category}</span>
            <span>▣ &nbsp; Posted {new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>▣ &nbsp; Deadline {campaign.deadline ? new Date(campaign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible'}</span>
            <span className="rounded-full bg-violet-100 px-4 py-2 font-semibold text-violet-700">● &nbsp;Open</span>
          </div>
        </header>

        <div className="h-72 overflow-hidden rounded-3xl bg-gradient-to-br from-[#f3e4d9] to-[#ead4c5] md:h-[360px]">
          {cover ? <Image src={cover} alt={campaign.title} width={1200} height={560} priority className="h-full w-full object-cover" /> : <div className="flex h-full w-full flex-col items-center justify-center text-[#947f79]"><span className="text-7xl">✦</span><span className="mt-3">Campaign cover</span></div>}
        </div>

        <section className="workspace-glass-card rounded-3xl p-6">
          <h2 className="text-xl font-bold">About This Campaign</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#59678f]">{campaign.description || 'No campaign description has been added yet.'}</p>
          <div className="mt-6 grid gap-5 border-t border-white/60 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[#7884a8]">Platforms</p><b>{platforms}</b></div>
            <div><p className="text-[#7884a8]">Creator Type</p><b>{category} Creators</b></div>
            <div><p className="text-[#7884a8]">Campaign Period</p><b>{campaign.campaignStartDate ? new Date(campaign.campaignStartDate).toLocaleDateString() : 'Flexible'}</b></div>
            <div><p className="text-[#7884a8]">Compensation</p><b>{budget}</b></div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="workspace-glass-card rounded-3xl p-6">
            <h2 className="mb-4 text-xl font-bold">Requirements</h2>
            {requirements.length ? <ul className="space-y-3 text-sm text-[#59678f]">{requirements.map(item => <li key={item} className="flex gap-2"><span className="text-violet-500">●</span>{item}</li>)}</ul> : <p className="text-sm text-[#7884a8]">No additional creator requirements.</p>}
          </section>
          <section className="workspace-glass-card rounded-3xl p-6">
            <h2 className="mb-4 text-xl font-bold">Deliverables</h2>
            <div className="flex gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">▣</span><div><b>{pretty(campaign.contentType)}</b><p className="mt-1 whitespace-pre-line text-sm text-[#66739a]">{campaign.contentGuidelines || 'Final deliverables will be confirmed through Overseed.'}</p></div></div>
          </section>
        </div>

        <section className="workspace-glass-card flex gap-5 rounded-3xl p-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">▣</span>
          <div className="grid flex-1 gap-6 text-sm md:grid-cols-3">
            <div><p className="text-[#7884a8]">Application Window</p><b>{campaign.deadline ? `Until ${new Date(campaign.deadline).toLocaleDateString()}` : 'Open-ended'}</b></div>
            <div><p className="text-[#7884a8]">Content Due</p><b>{campaign.campaignEndDate ? new Date(campaign.campaignEndDate).toLocaleDateString() : 'To be confirmed'}</b></div>
            <div><p className="text-[#7884a8]">Notes</p><b>{campaign.hashtagsRequired || 'Managed through Overseed'}</b></div>
          </div>
        </section>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm text-amber-800">
          {t.brand.campaigns.antiFraud} <Link href="/contact" className="font-semibold underline">{t.brand.campaigns.reportNow}</Link>
        </div>
      </main>

      <aside className="workspace-glass-card rounded-3xl p-7 xl:sticky xl:top-5">
        <div className="flex justify-between"><b>Status</b><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">● &nbsp;Open</span></div>
        <div className="mt-7"><p className="text-sm text-[#7180ad]">Compensation</p><div className="mt-2 flex items-end justify-between"><b className="text-2xl">{pretty(campaign.compensationType)}</b>{campaign.giftValue && <div className="text-right"><p className="text-xs text-[#7180ad]">Gift value</p><b className="text-xl">${Number(campaign.giftValue).toLocaleString()}</b></div>}</div></div>
        <div className="mt-6 space-y-5 border-t border-white/70 pt-6">
          <div className="flex justify-between"><span>Applications</span><b>{campaign._count.applications}</b></div>
          <div><div className="flex justify-between"><span>Spots Filled</span><b>{campaign.filledSlots} / {campaign.totalSlots}</b></div><div className="mt-3 h-2 rounded-full bg-slate-200/70"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-[#7884a8]">{spotsLeft} spots remaining</p></div>
          <div className="flex justify-between border-t border-white/70 pt-5"><span>Views</span><b>{campaign.viewCount}</b></div>
        </div>
        <div className="mt-7 space-y-3">{primaryAction()}{!isOwner && isAuthenticated && <button onClick={toggleSave} disabled={saveBusy} className={`w-full rounded-xl border py-4 font-semibold transition disabled:opacity-50 ${saved ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-white bg-white/25'}`}>{saved ? '♥ Saved Campaign' : '♡ Save Campaign'}</button>}</div>
        <div className="mt-7 border-t border-white/70 pt-6">
          <p className="text-xs text-[#7884a8]">Posted by</p>
          <Link href={`/brand/${campaign.brand.id}`} className="mt-3 flex items-center gap-3 rounded-xl p-1 transition hover:bg-white/30">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white/70 font-bold">{campaign.brand.logoUrl ? <Image src={campaign.brand.logoUrl} alt="" width={44} height={44} className="h-full w-full object-cover" /> : campaign.brand.companyName?.[0] || 'B'}</span>
            <div><b>{campaign.brand.companyName || 'Anonymous Brand'} {campaign.brand.isVerified && <span className="text-blue-500">●</span>}</b><p className="text-xs text-[#7884a8]">Brand Account</p></div>
          </Link>
        </div>
        <Link href="/contact" className="mt-6 block border-t border-white/70 pt-5 text-sm text-red-600">{t.campaign.reportCampaign}</Link>
      </aside>
    </div>
  </div>
}
