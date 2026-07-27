'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import RoleShell from '@/components/workspace/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// My Plan per spec: current-usage strip, Free vs Pro pricing cards with the
// current plan marked, and a Buy Image Credits card. Credit consumption is
// explained in the View Details modal; users see percentages, not raw
// credit balances.

interface UsageItem {
  key: string
  used: number | null
  limit: number | null
  enabled?: boolean
}

const IMAGE_PACKS = [
  { price: '¥29', credits: '240', images: '≈ 60' },
  { price: '¥99', credits: '880', images: '≈ 220' },
  { price: '¥199', credits: '2,000', images: '≈ 500' },
]

function FeatureRow({
  label,
  value,
  caption,
  highlight,
}: {
  label: string
  value: string
  caption?: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-b-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-right">
        <span className={`block text-sm font-bold ${highlight ? 'text-primary-600' : 'text-gray-900'}`}>{value}</span>
        {caption && <span className="block text-[11px] text-gray-400">{caption}</span>}
      </span>
    </div>
  )
}

export default function MyPlanPage() {
  const { data: session } = useSession()
  const { t } = useLanguage()
  const m = t.myPlan
  const planLabels: Record<string, string> = {
    translation: t.brand.dashboard.plan.translation,
    campaignsPerDay: t.brand.dashboard.plan.campaignsPerDay,
    activeCampaigns: t.brand.dashboard.plan.activeCampaigns,
    conversationsPerDay: t.brand.dashboard.plan.conversationsPerDay,
    teamSeats: t.brand.dashboard.plan.teamSeats,
    aiChat: t.brand.dashboard.plan.aiChat,
    aiImage: m.usageAiImage,
  }

  const tier = (session?.user as any)?.subscriptionTier || 'FREE'
  const isPro = tier === 'PRO'
  const [usage, setUsage] = useState<UsageItem[] | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/plan/usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.items && setUsage(data.items))
      .catch(() => {})
  }, [session?.user])

  // Usage strip entries (translation is unlimited → skipped, like the mockup)
  const usageStrip = (usage || []).filter((i) => i.key !== 'translation')

  const usageDisplay = (item: UsageItem) => {
    if (item.key === 'aiChat' && item.used != null && item.limit) {
      // Percentage only — raw credit numbers are not shown to users
      return `${Math.min(100, Math.round((item.used / item.limit) * 100))}%`
    }
    if (item.used == null || item.limit == null) return '—'
    return `${item.used} / ${item.limit}`
  }

  const usagePct = (item: UsageItem) => {
    if (item.used == null || !item.limit) return 0
    return Math.min(100, Math.round((item.used / item.limit) * 100))
  }

  return (
    <RoleShell>
      <div className="max-w-6xl mx-auto pt-6 pb-8">
        {/* Header + usage strip */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{m.title}</h1>
            <p className="text-gray-500 mt-1 max-w-xs">{m.subtitle}</p>
          </div>

          {session?.user && usageStrip.length > 0 && (
            <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">{m.currentUsage}</p>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {usageStrip.map((item) => (
                  <div key={item.key} className="min-w-[90px]">
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{usageDisplay(item)}</p>
                    <p className="text-[11px] text-gray-400">{planLabels[item.key] || item.key}</p>
                    <div className="mt-1.5 h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${usagePct(item)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Free plan */}
          <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{m.free}</p>
                {!isPro && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-semibold">
                    {m.currentPlan}
                  </span>
                )}
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-5">
              {m.freePrice} <span className="text-sm font-normal text-gray-400">{m.perMonth}</span>
            </p>

            <div className="mt-5 border-t border-gray-100">
              <FeatureRow label={m.serviceFee} value="8.00%" />
              <FeatureRow label={m.campaignsPerDay} value="2" caption={m.notAccumulated} />
              <FeatureRow label={m.liveCampaigns} value="5" />
              <FeatureRow label={m.translation} value={m.unlimited} caption={m.fairUse} />
              <FeatureRow label={m.conversationsPerDay} value="10" />
              <FeatureRow label={m.communicate} value={m.unlimited} />
              <FeatureRow label={m.teamSeats} value="1" />
              <FeatureRow label={m.aiChatCredits} value={m.notAvailable} />
              <FeatureRow label={m.aiImageCredits} value={m.notAvailable} />
            </div>

            <p className="mt-4 text-xs text-gray-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {m.upgradeHint}
            </p>
          </div>

          {/* Pro plan */}
          <div className="bg-white/90 backdrop-blur rounded-3xl shadow-md ring-1 ring-primary-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{m.pro}</p>
                {isPro && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-semibold">
                    {m.currentPlan}
                  </span>
                )}
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-5">
              {m.monthlyPrice} <span className="text-sm font-normal text-gray-400">{m.perMonth}</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {m.yearlyPrice} <span className="text-gray-400">{m.perYear}</span>{' '}
              <span className="ml-1 px-2 py-0.5 bg-pink-50 text-pink-500 rounded-full text-[11px] font-semibold">{m.yearlySave}</span>
            </p>

            <div className="mt-5 border-t border-gray-100">
              <FeatureRow label={m.serviceFee} value="5.00%" highlight />
              <FeatureRow label={m.campaignsPerDay} value="5" caption={`${m.accumulated} · ${m.dailyCap}`} highlight />
              <FeatureRow label={m.liveCampaigns} value="50" />
              <FeatureRow label={m.translation} value={m.unlimited} caption={m.fairUse} />
              <FeatureRow label={m.conversationsPerDay} value="50" />
              <FeatureRow label={m.communicate} value={m.unlimited} />
              <FeatureRow label={m.teamSeats} value="1" />
              <FeatureRow label={m.aiChatCredits} value={m.included} caption={m.basicUsage} />
              <FeatureRow label={m.aiImageCredits} value={m.imagePerMonth} />
            </div>

            {!isPro && (
              <Link
                href="/dashboard/upgrade"
                className="mt-6 block text-center px-6 py-3 rounded-2xl text-white text-sm font-bold bg-gradient-to-r from-pink-500 to-fuchsia-500 shadow-md hover:opacity-95 transition"
              >
                {m.upgradeToPro}
              </Link>
            )}
          </div>

          {/* Buy image credits */}
          <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6 lg:mt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900">{m.buyImageCredits}</p>
                <p className="text-[11px] text-gray-400">
                  {m.creditsNeverExpire} · {m.limitedOffer}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {IMAGE_PACKS.map((pack) => (
                <div key={pack.price} className="flex items-center gap-4 bg-white rounded-2xl shadow-sm px-4 py-3">
                  <span className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-900 flex-shrink-0">
                    {pack.price}
                  </span>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-gray-900 leading-tight">{pack.credits}</p>
                    <p className="text-[11px] text-gray-400">{m.credits}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-700">{pack.images}</p>
                    <p className="text-[11px] text-gray-400">{m.standardImages}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowDetails(true)}
              className="mt-4 w-full px-4 py-2.5 bg-white border border-pink-200 text-pink-600 rounded-2xl text-sm font-semibold hover:bg-pink-50 transition"
            >
              {m.viewDetails}
            </button>
          </div>
        </div>
      </div>

      {/* Credit-consumption details */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDetails(false)}>
          <div data-solid className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900">{m.creditUsageTitle}</h3>
              <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-gray-700" aria-label={m.close}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-5">{m.creditUsageNote}</p>

            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{m.chatSection}</p>
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{m.standardModel}</p>
                  <p className="text-[11px] text-gray-400">{m.standardModelList}</p>
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap">1 {m.creditsUnit}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{m.advancedModel}</p>
                  <p className="text-[11px] text-gray-400">{m.advancedModelList}</p>
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap">3 {m.creditsUnit}</span>
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{m.imageSection}</p>
            <div className="space-y-2">
              {[
                { label: m.standardImage, cost: '4' },
                { label: m.imageEdit, cost: '6' },
                { label: m.highQualityImage, cost: '20' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 gap-4">
                  <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{row.cost} {m.creditsUnit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </RoleShell>
  )
}
