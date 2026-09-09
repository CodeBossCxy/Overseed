'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import { formatNumber } from '@/lib/i18n/formatNumber'
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

const pretty = (value?: string | null, fallback = 'Campaign content') => value
  ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  : fallback

export default function CreatorCampaignDetail({
  campaign, isOwner = false, hasApplied = false, isSaved = false,
  isAuthenticated = false, userType, subscriptionTier,
}: Props) {
  const { t, locale } = useLanguage()
  const [saved, setSaved] = useState(isSaved)
  const [saveBusy, setSaveBusy] = useState(false)
  const spotsLeft = Math.max(0, campaign.totalSlots - campaign.filledSlots)
  const progress = campaign.totalSlots ? Math.min(100, (campaign.filledSlots / campaign.totalSlots) * 100) : 0
  const isDeadlinePassed = Boolean(campaign.deadline && new Date(campaign.deadline) < new Date())
  const isUrgent = Boolean(campaign.deadline && !isDeadlinePassed
    && new Date(campaign.deadline).getTime() - Date.now() <= URGENT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const compensationTypeLabels: Record<string, string> = {
    PAID: t.campaign.paid,
    GIFTED: t.campaign.gifted,
    PAID_PLUS_GIFT: t.campaign.paidPlusGift,
    AFFILIATE: t.campaign.affiliate,
    NEGOTIABLE: t.campaign.negotiable,
  }
  const compensationLabel = campaign.compensationType
    ? compensationTypeLabels[campaign.compensationType] || pretty(campaign.compensationType)
    : t.campaign.campaignContent
  const category = campaign.categories
    .map((item: any) => (t.categoryNames as Record<string, string>)[item.category.name] || item.category.name)
    .join(locale === 'zh' ? '、' : ' & ') || t.campaign.campaignContent
  const cover = campaign.images?.[0] || campaign.media?.find((item: any) => item.mediaType !== 'video')?.mediaUrl
  const budget = campaign.paymentMin
    ? `$${formatNumber(Number(campaign.paymentMin), locale)}${campaign.paymentMax ? ` – $${formatNumber(Number(campaign.paymentMax), locale)}` : '+'}`
    : campaign.giftDescription || compensationLabel
  const isPaid = Boolean(campaign.paymentMin)
  const location = (campaign.brand.countries || []).join(', ') || t.campaign.worldwide
  const minFollowers = (campaign.followerRequirements || [])
    .map((requirement: any) => Number(requirement.minFollowers))
    .filter(Boolean)
    .sort((a: number, b: number) => a - b)[0]

  const deliverables = [
    pretty(campaign.contentType, t.campaign.campaignContent),
    campaign.wordCountMin ? `${t.campaign.wordCount} ${campaign.wordCountMin}${campaign.wordCountMax ? ` – ${campaign.wordCountMax}` : '+'}` : null,
    ...(campaign.followerRequirements || []).map((requirement: any) =>
      `${t.campaign.minFollowersLabel.replace('{n}', compact(requirement.minFollowers))} ${requirement.platform.name}${requirement.minEngagementRate ? ` · ${Number(requirement.minEngagementRate)}% ${t.campaign.engagement}` : ''}`),
  ].filter(Boolean) as string[]
  const guidelines = (campaign.contentGuidelines || '')
    .split(/\n+/)
    .map((line: string) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
  const dos = [
    campaign.mentionsRequired ? `${t.campaign.requiredMentions} ${campaign.mentionsRequired}` : null,
    campaign.hashtagsRequired ? `${t.campaign.requiredHashtags} ${campaign.hashtagsRequired}` : null,
    campaign.requiresProductPurchase
      ? `${t.campaign.requiresProductPurchase}${campaign.isProductReimbursed ? ` ${t.campaign.reimbursed}` : ''}${campaign.productPurchaseAmount ? ` · ~$${formatNumber(Number(campaign.productPurchaseAmount), locale)}` : ''}`
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
    if (isOwner) return <Link href={`/dashboard/brand/campaigns/${campaign.id}`} className="block rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 py-4 text-center font-semibold text-white">{t.campaign.manageCampaignLink}</Link>
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
                : <div className="flex h-full w-full flex-col items-center justify-center text-[#947f79]"><span className="text-6xl">✦</span><span className="mt-3">{t.campaign.campaignCover}</span></div>}
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
                {isUrgent && <span className="rounded-full bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-600">{t.campaignCard.urgent}</span>}
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                {campaign.title} {campaign.brand.isVerified && <span className="align-middle text-lg text-blue-500">✔︎</span>}
              </h2>
              <Link href={`/brand/${campaign.brand.id}`} className="mt-1 inline-block font-semibold text-blue-600 hover:underline">
                {campaign.brand.companyName || t.campaign.anonymousBrand}
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#59678f]">
                <span>◎ &nbsp;{location}</span>
                <span>▣ &nbsp;{t.campaign.posted} {formatDate(campaign.createdAt, locale)}</span>
                <span className={campaign.deadline ? 'font-semibold text-red-600' : ''}>▣ &nbsp;{campaign.deadline ? `${t.campaign.dueLabel} ${formatDate(campaign.deadline, locale)}` : t.campaign.flexibleDeadline}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#59678f]">
                <span>◉ &nbsp;{campaign.viewCount} {t.campaign.views}</span>
                <span className="border-l border-[#c8d0e6] pl-5">◫ &nbsp;{t.campaign.spotsLeftCount.replace('{n}', String(spotsLeft))}</span>
              </div>
              <div className="mt-5 grid gap-5 border-t border-white/60 pt-5 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-[#7884a8]">{t.campaign.platforms}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {campaign.platforms.length
                      ? campaign.platforms.map((item: any) => <PlatformIcon key={item.platformId || item.platform.name} name={item.platform.name} />)
                      : <b>{t.campaign.allPlatforms}</b>}
                  </div>
                </div>
                <div>
                  <p className="text-[#7884a8]">{t.campaign.followerRequirements}</p>
                  <b className="mt-2 inline-block">{minFollowers ? t.campaign.minFollowersLabel.replace('{n}', compact(minFollowers)) : t.campaign.openToAll}</b>
                </div>
                <div>
                  <p className="text-[#7884a8]">{t.campaign.compensation}</p>
                  <b className="mt-2 inline-block">{compensationLabel}{isPaid ? ` · ${budget}` : ''}</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="workspace-glass-card rounded-3xl p-6">
          <h2 className="text-xl font-bold">{t.campaign.aboutThisCampaign}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#59678f]">{campaign.description || t.campaign.noCampaignDescriptionYet}</p>
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm text-amber-800">
            🛡 &nbsp;{t.brand.campaigns.antiFraud} <Link href="/contact" className="font-semibold underline">{t.brand.campaigns.reportNow}</Link>
          </div>
        </section>

        {/* Requirements */}
        <section className="workspace-glass-card rounded-3xl p-6">
          <h2 className="mb-5 text-xl font-bold">{t.campaign.requirements}</h2>
          <div className="grid gap-6 text-sm md:grid-cols-3">
            <div>
              <p className="flex items-center gap-2 font-semibold"><span className="text-violet-500">▣</span>{t.campaign.deliverablesRequirements}</p>
              {deliverables.length
                ? <ul className="mt-3 space-y-2 text-[#59678f]">{deliverables.map(item => <li key={item} className="flex gap-2"><span className="text-violet-500">●</span>{item}</li>)}</ul>
                : <p className="mt-3 text-[#7884a8]">{t.campaign.finalDeliverablesNote}</p>}
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold"><span className="text-violet-500">✈</span>{t.campaign.contentGuidelines}</p>
              {guidelines.length
                ? <ul className="mt-3 space-y-2 text-[#59678f]">{guidelines.map((item: string) => <li key={item} className="flex gap-2"><span className="text-violet-500">●</span>{item}</li>)}</ul>
                : <p className="mt-3 text-[#7884a8]">{t.campaign.creativeDirectionNote}</p>}
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold"><span className="text-violet-500">✓</span>{t.campaign.dosAndDonts}</p>
              {dos.length
                ? <ul className="mt-3 space-y-2 text-[#59678f]">{dos.map(item => <li key={item} className="flex gap-2"><span className="font-bold text-emerald-500">✓</span>{item}</li>)}</ul>
                : <p className="mt-3 text-[#7884a8]">{t.campaign.contentPoliciesNote}</p>}
            </div>
          </div>
        </section>

        {/* Info tiles */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['◎', t.campaign.locationLabel, location, null],
            ['▤', t.campaign.categoryLabel, category, null],
            ['◫', t.campaign.spotsLeftLabel, t.campaign.spotsLeftCount.replace('{n}', String(spotsLeft)), t.campaign.outOf.replace('{n}', String(campaign.totalSlots))],
            ['▣', t.campaign.campaignPeriodLabel, campaign.campaignStartDate
              ? `${formatDate(campaign.campaignStartDate, locale)}${campaign.campaignEndDate ? ` – ${formatDate(campaign.campaignEndDate, locale)}` : ''}`
              : t.campaign.flexible, null],
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
          <b>{t.campaign.compensation}</b>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>{isPaid ? t.campaign.paid : compensationLabel}</span>
        </div>
        <b className="mt-3 block text-3xl tracking-tight">{budget}</b>
        <p className="mt-1 text-sm text-[#7180ad]">{compensationLabel}{campaign.giftValue ? ` · ${t.campaign.giftValue} $${formatNumber(Number(campaign.giftValue), locale)}` : ''}</p>
        <div className="mt-6 space-y-5 border-t border-white/70 pt-6 text-sm">
          <div className="flex justify-between"><span>{t.campaign.applications}</span><b>{campaign._count.applications}</b></div>
          <div>
            <div className="flex justify-between"><span>{t.campaign.spotsFilled}</span><b>{campaign.filledSlots} / {campaign.totalSlots}</b></div>
            <div className="mt-3 h-2 rounded-full bg-slate-200/70"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="flex justify-between"><span>{t.campaign.spotsRemainingLabel}</span><b>{spotsLeft}</b></div>
          <div className="flex justify-between"><span>{t.campaign.views}</span><b>{campaign.viewCount}</b></div>
        </div>
        <div className="mt-7 space-y-3">
          {primaryAction()}
          {canSave && <button onClick={toggleSave} disabled={saveBusy} className={`w-full rounded-xl border py-4 font-semibold transition disabled:opacity-50 ${saved ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-white bg-white/25'}`}>{saved ? `♥ ${t.campaign.savedCampaignBtn}` : `♡ ${t.campaign.saveCampaignBtn}`}</button>}
        </div>
        {!isOwner && userType !== 'BRAND' && userType !== 'ADMIN' && (
          <div className="mt-6 space-y-4 rounded-2xl bg-white/35 p-4 text-sm">
            <div className="flex gap-3"><span className="text-violet-600">⛉</span><div><b>{t.campaign.saveCampaignHint}</b><p className="mt-0.5 text-xs text-[#6775a0]">{t.campaign.saveCampaignHintDesc}</p></div></div>
            <div className="flex gap-3"><span className="text-violet-600">✈</span><div><b>{t.campaign.applyCampaignHint}</b><p className="mt-0.5 text-xs text-[#6775a0]">{t.campaign.applyCampaignHintDesc}</p></div></div>
          </div>
        )}
        <Link href="/contact" className="mt-6 block text-sm font-semibold text-blue-600 hover:underline">{t.campaign.reportCampaign}</Link>
        <div className="mt-6 border-t border-white/70 pt-6">
          <p className="text-xs text-[#7884a8]">{t.campaign.postedBy}</p>
          <Link href={`/brand/${campaign.brand.id}`} className="mt-3 flex items-center gap-3 rounded-xl p-1 transition hover:bg-white/30">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white/70 font-bold">{campaign.brand.logoUrl ? <Image src={campaign.brand.logoUrl} alt="" width={44} height={44} className="h-full w-full object-cover" /> : campaign.brand.companyName?.[0] || 'B'}</span>
            <div className="min-w-0 flex-1"><b>{campaign.brand.companyName || t.campaign.anonymousBrand} {campaign.brand.isVerified && <span className="text-blue-500">✔︎</span>}</b><p className="text-xs text-[#7884a8]">{location}</p></div>
            <span className="text-[#7884a8]">›</span>
          </Link>
        </div>
      </aside>
    </div>
  </div>
}
