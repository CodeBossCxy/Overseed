'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { PlatformIcon } from './CampaignRowCard'

type Props = {
  campaign: any
  isOwner?: boolean
  hasApplied?: boolean
  isSaved?: boolean
  isAuthenticated?: boolean
  userType?: string | null
  subscriptionTier?: string | null
}

const URGENT_WINDOW_DAYS = 14

const compact = (value: number) => new Intl.NumberFormat('en-US', {
  notation: 'compact', maximumFractionDigits: 1,
}).format(value)

const pretty = (value?: string | null) => value
  ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  : 'Campaign content'

const shortDate = (value?: string | Date | null) => value
  ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : null

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
  const isUrgent = Boolean(campaign.deadline && !isDeadlinePassed
    && new Date(campaign.deadline).getTime() - Date.now() <= URGENT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const category = campaign.categories.map((item: any) => item.category.name).join(' & ') || 'Campaign'
  const cover = campaign.images?.[0] || campaign.media?.find((item: any) => item.mediaType !== 'video')?.mediaUrl
  const budget = campaign.paymentMin
    ? `$${Number(campaign.paymentMin).toLocaleString()}${campaign.paymentMax ? ` – $${Number(campaign.paymentMax).toLocaleString()}` : '+'}`
    : campaign.giftDescription || pretty(campaign.compensationType)
  const isPaid = Boolean(campaign.paymentMin)
  const location = (campaign.brand.countries || []).join(', ') || 'Worldwide'
  const minFollowers = (campaign.followerRequirements || [])
    .map((requirement: any) => Number(requirement.minFollowers))
    .filter(Boolean)
    .sort((a: number, b: number) => a - b)[0]

  const deliverables = [
    pretty(campaign.contentType),
    campaign.wordCountMin ? `Word count ${campaign.wordCountMin}${campaign.wordCountMax ? ` – ${campaign.wordCountMax}` : '+'}` : null,
    ...(campaign.followerRequirements || []).map((requirement: any) =>
      `Minimum ${compact(requirement.minFollowers)} ${requirement.platform.name} followers${requirement.minEngagementRate ? ` · ${Number(requirement.minEngagementRate)}% engagement` : ''}`),
  ].filter(Boolean) as string[]
  const guidelines = (campaign.contentGuidelines || '')
    .split(/\n+/)
    .map((line: string) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
  const dos = [
    campaign.mentionsRequired ? `Do tag ${campaign.mentionsRequired}` : null,
    campaign.hashtagsRequired ? `Do use ${campaign.hashtagsRequired}` : null,
    campaign.requiresProductPurchase
      ? `Product purchase required${campaign.isProductReimbursed ? ' (reimbursed)' : ''}${campaign.productPurchaseAmount ? ` · ~$${Number(campaign.productPurchaseAmount).toLocaleString()}` : ''}`
      : null,
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

  const canSave = !isOwner && isAuthenticated && userType !== 'BRAND' && userType !== 'ADMIN'

  const primaryAction = () => {
    if (isOwner) return <Link href={`/dashboard/brand/campaigns/${campaign.id}`} className="block rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 py-4 text-center font-semibold text-white">Manage Campaign</Link>
    if (userType === 'BRAND' || userType === 'ADMIN') return <p className="py-3 text-center text-sm text-[#7180ad]">{t.campaign.onlyCreatorsCanApply}</p>
    if (isDeadlinePassed) return <p className="py-3 text-center font-semibold text-red-600">{t.campaign.deadlinePassed}</p>
    if (spotsLeft === 0) return <p className="py-3 text-center font-semibold text-orange-600">{t.campaign.allSpotsFilled}</p>
    if (hasApplied) return <button disabled className="w-full rounded-xl bg-slate-200 py-4 font-semibold text-slate-500">{t.campaign.alreadyApplied}</button>
    if (!isAuthenticated) return <Link href="/auth/signin" className="block rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 py-4 text-center font-semibold text-white">{t.campaign.signInToApply}</Link>
    if (subscriptionTier === 'FREE') return <Link href="/dashboard/upgrade" className="block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-center font-semibold text-white">{t.campaign.upgradeToProToApply}</Link>
    return <Link href={`/campaign/${campaign.id}/apply`} className="block rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 py-4 text-center font-semibold text-white">✈ &nbsp;{t.campaign.applyNow}</Link>
  }

  return <div className="text-[#17255f]">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0 space-y-4">
        {/* Hero card */}
        <section className="workspace-glass-card rounded-3xl p-6">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="relative h-64 w-full shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#f3e4d9] to-[#ead4c5] md:h-72 md:w-72">
              {cover
                ? <Image src={cover} alt={campaign.title} width={600} height={600} priority className="h-full w-full object-cover" />
                : <div className="flex h-full w-full flex-col items-center justify-center text-[#947f79]"><span className="text-6xl">✦</span><span className="mt-3">Campaign cover</span></div>}
              {canSave && (
                <button onClick={toggleSave} disabled={saveBusy} aria-label={saved ? 'Unsave campaign' : 'Save campaign'}
                  className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur transition disabled:opacity-50 ${saved ? 'text-rose-500' : 'text-[#7180ad] hover:text-rose-500'}`}>
                  {saved ? '♥' : '♡'}
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-4 py-1.5 text-sm font-semibold text-violet-700">{category}</span>
                {isUrgent && <span className="rounded-full bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-600">Urgent</span>}
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                {campaign.title} {campaign.brand.isVerified && <span className="align-middle text-lg text-blue-500">✔︎</span>}
              </h2>
              <Link href={`/brand/${campaign.brand.id}`} className="mt-1 inline-block font-semibold text-blue-600 hover:underline">
                {campaign.brand.companyName || 'Anonymous Brand'}
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#59678f]">
                <span>◎ &nbsp;{location}</span>
                <span>▣ &nbsp;Posted {shortDate(campaign.createdAt)}</span>
                <span className={campaign.deadline ? 'font-semibold text-red-600' : ''}>▣ &nbsp;{campaign.deadline ? `Due ${shortDate(campaign.deadline)}` : 'Flexible deadline'}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#59678f]">
                <span>◉ &nbsp;{campaign.viewCount} Views</span>
                <span className="border-l border-[#c8d0e6] pl-5">◫ &nbsp;{spotsLeft} Spots Left</span>
              </div>
              <div className="mt-5 grid gap-5 border-t border-white/60 pt-5 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-[#7884a8]">Platforms</p>
                  <div className="mt-2 flex items-center gap-2">
                    {campaign.platforms.length
                      ? campaign.platforms.map((item: any) => <PlatformIcon key={item.platformId || item.platform.name} name={item.platform.name} />)
                      : <b>All platforms</b>}
                  </div>
                </div>
                <div>
                  <p className="text-[#7884a8]">Follower Requirement</p>
                  <b className="mt-2 inline-block">{minFollowers ? `Min. ${compact(minFollowers)} followers` : 'Open to all'}</b>
                </div>
                <div>
                  <p className="text-[#7884a8]">Compensation</p>
                  <b className="mt-2 inline-block">{pretty(campaign.compensationType)}{isPaid ? ` · ${budget}` : ''}</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="workspace-glass-card rounded-3xl p-6">
          <h2 className="text-xl font-bold">About This Campaign</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#59678f]">{campaign.description || 'No campaign description has been added yet.'}</p>
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm text-amber-800">
            🛡 &nbsp;{t.brand.campaigns.antiFraud} <Link href="/contact" className="font-semibold underline">{t.brand.campaigns.reportNow}</Link>
          </div>
        </section>

        {/* Requirements */}
        <section className="workspace-glass-card rounded-3xl p-6">
          <h2 className="mb-5 text-xl font-bold">Requirements</h2>
          <div className="grid gap-6 text-sm md:grid-cols-3">
            <div>
              <p className="flex items-center gap-2 font-semibold"><span className="text-violet-500">▣</span>Deliverables / Content Requirements</p>
              {deliverables.length
                ? <ul className="mt-3 space-y-2 text-[#59678f]">{deliverables.map(item => <li key={item} className="flex gap-2"><span className="text-violet-500">●</span>{item}</li>)}</ul>
                : <p className="mt-3 text-[#7884a8]">Final deliverables will be confirmed through Overseed.</p>}
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold"><span className="text-violet-500">✈</span>Content Guidelines</p>
              {guidelines.length
                ? <ul className="mt-3 space-y-2 text-[#59678f]">{guidelines.map((item: string) => <li key={item} className="flex gap-2"><span className="text-violet-500">●</span>{item}</li>)}</ul>
                : <p className="mt-3 text-[#7884a8]">Follow the brand&apos;s creative direction shared after selection.</p>}
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold"><span className="text-violet-500">✓</span>Do&apos;s &amp; Don&apos;ts</p>
              {dos.length
                ? <ul className="mt-3 space-y-2 text-[#59678f]">{dos.map(item => <li key={item} className="flex gap-2"><span className="font-bold text-emerald-500">✓</span>{item}</li>)}</ul>
                : <p className="mt-3 text-[#7884a8]">Follow the brand&apos;s content guidelines and platform policies.</p>}
            </div>
          </div>
        </section>

        {/* Info tiles */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['◎', 'Location', location, null],
            ['▤', 'Category', category, null],
            ['◫', 'Spots Left', `${spotsLeft} Spots Left`, `Out of ${campaign.totalSlots}`],
            ['▣', 'Campaign Period', campaign.campaignStartDate
              ? `${shortDate(campaign.campaignStartDate)}${campaign.campaignEndDate ? ` – ${shortDate(campaign.campaignEndDate)}` : ''}`
              : 'Flexible', null],
          ].map(([icon, label, primary, secondary]) => (
            <section key={label as string} className="workspace-glass-card flex items-start gap-3 rounded-3xl p-5 text-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">{icon}</span>
              <div className="min-w-0">
                <p className="font-semibold">{label}</p>
                <p className="mt-1 text-[#59678f]">{primary}</p>
                {secondary && <p className="text-[#7884a8]">{secondary}</p>}
              </div>
            </section>
          ))}
        </div>
      </div>

      <aside className="workspace-glass-card rounded-3xl p-7 xl:sticky xl:top-5">
        <div className="flex items-center justify-between">
          <b>Compensation</b>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>{isPaid ? 'Paid' : pretty(campaign.compensationType)}</span>
        </div>
        <b className="mt-3 block text-3xl tracking-tight">{budget}</b>
        <p className="mt-1 text-sm text-[#7180ad]">{pretty(campaign.compensationType)}{campaign.giftValue ? ` · Gift value $${Number(campaign.giftValue).toLocaleString()}` : ''}</p>
        <div className="mt-6 space-y-5 border-t border-white/70 pt-6 text-sm">
          <div className="flex justify-between"><span>Applications</span><b>{campaign._count.applications}</b></div>
          <div>
            <div className="flex justify-between"><span>Spots Filled</span><b>{campaign.filledSlots} / {campaign.totalSlots}</b></div>
            <div className="mt-3 h-2 rounded-full bg-slate-200/70"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="flex justify-between"><span>Spots Remaining</span><b>{spotsLeft}</b></div>
          <div className="flex justify-between"><span>Views</span><b>{campaign.viewCount}</b></div>
        </div>
        <div className="mt-7 space-y-3">
          {primaryAction()}
          {canSave && <button onClick={toggleSave} disabled={saveBusy} className={`w-full rounded-xl border py-4 font-semibold transition disabled:opacity-50 ${saved ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-white bg-white/25'}`}>{saved ? '♥ Saved Campaign' : '♡ Save Campaign'}</button>}
        </div>
        {!isOwner && userType !== 'BRAND' && userType !== 'ADMIN' && (
          <div className="mt-6 space-y-4 rounded-2xl bg-white/35 p-4 text-sm">
            <div className="flex gap-3"><span className="text-violet-600">⛉</span><div><b>Save this campaign</b><p className="mt-0.5 text-xs text-[#6775a0]">We&apos;ll add this to your Saved Campaigns for easy access anytime.</p></div></div>
            <div className="flex gap-3"><span className="text-violet-600">✈</span><div><b>Apply to this campaign</b><p className="mt-0.5 text-xs text-[#6775a0]">We&apos;ll add this to your Applications &amp; Collaborations and share your info with the brand.</p></div></div>
          </div>
        )}
        <Link href="/contact" className="mt-6 block text-sm font-semibold text-blue-600 hover:underline">{t.campaign.reportCampaign}</Link>
        <div className="mt-6 border-t border-white/70 pt-6">
          <p className="text-xs text-[#7884a8]">Posted by</p>
          <Link href={`/brand/${campaign.brand.id}`} className="mt-3 flex items-center gap-3 rounded-xl p-1 transition hover:bg-white/30">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white/70 font-bold">{campaign.brand.logoUrl ? <Image src={campaign.brand.logoUrl} alt="" width={44} height={44} className="h-full w-full object-cover" /> : campaign.brand.companyName?.[0] || 'B'}</span>
            <div className="min-w-0 flex-1"><b>{campaign.brand.companyName || 'Anonymous Brand'} {campaign.brand.isVerified && <span className="text-blue-500">✔︎</span>}</b><p className="text-xs text-[#7884a8]">{location}</p></div>
            <span className="text-[#7884a8]">›</span>
          </Link>
        </div>
      </aside>
    </div>
  </div>
}
