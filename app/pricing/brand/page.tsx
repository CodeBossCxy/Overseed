'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import RoleShell from '@/components/workspace/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface UsageItem {
  key: string
  used: number | null
  limit: number | null
  extra?: number
  enabled?: boolean
}

interface TierColumn {
  id: 'FREE' | 'CAMPAIGN_PLUS' | 'OUTREACH_PLUS' | 'PRO'
  name: string
  price: string
  yearlyPrice: string
  bestFor: string
  serviceFee: string
  campaignsPerDay: string
  activeCampaigns: string
  conversationsPerDay: string
  discoverySearches: string
  advancedAnalytics: string
  managedOutreach: string
  aiCredits: string
  accent: string
  ring: boolean
}

export default function MyPlanPage() {
  const { data: session } = useSession()
  const { t } = useLanguage()
  const m = t.myPlan

  const tier = (session?.user as any)?.subscriptionTier || 'FREE'
  const [usage, setUsage] = useState<UsageItem[] | null>(null)
  const [annual, setAnnual] = useState(false)
  const [loadingTier, setLoadingTier] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/plan/usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.items && setUsage(data.items))
      .catch(() => {})
  }, [session?.user])

  const usageLabels: Record<string, string> = {
    translation: m.translation,
    campaignsPerDay: m.campaignsPerDay,
    activeCampaigns: m.liveCampaigns,
    conversationsPerDay: m.conversationsPerDay,
    teamSeats: m.teamSeats,
    aiCredits: m.aiCreditsLabel,
    discoverySearches: m.discoverySearches,
    advancedAnalytics: m.advancedAnalytics,
    managedOutreach: m.managedOutreach,
  }

  const usageStrip = (usage || []).filter((i) => i.key !== 'translation')

  const usageDisplay = (item: UsageItem) => {
    if (item.key === 'aiCredits') {
      const base = item.used != null && item.limit != null ? `${item.used} / ${item.limit}` : '—'
      return base
    }
    if (item.used == null || item.limit == null) return '—'
    return `${item.used} / ${item.limit}`
  }

  const usagePct = (item: UsageItem) => {
    if (item.used == null || !item.limit) return 0
    return Math.min(100, Math.round((item.used / item.limit) * 100))
  }

  const tiers: TierColumn[] = [
    {
      id: 'FREE',
      name: m.free,
      price: '¥0',
      yearlyPrice: '¥0',
      bestFor: m.bestForFree,
      serviceFee: '8%',
      campaignsPerDay: `1 (${m.notAccumulated})`,
      activeCampaigns: '1',
      conversationsPerDay: '10',
      discoverySearches: '5',
      advancedAnalytics: '—',
      managedOutreach: '—',
      aiCredits: '20',
      accent: 'sky',
      ring: false,
    },
    {
      id: 'CAMPAIGN_PLUS',
      name: m.campaignPlus,
      price: '¥69',
      yearlyPrice: '¥690',
      bestFor: m.bestForCampaignPlus,
      serviceFee: '5%',
      campaignsPerDay: `5 (${m.accumulated})`,
      activeCampaigns: '50',
      conversationsPerDay: '50',
      discoverySearches: '50',
      advancedAnalytics: '1',
      managedOutreach: '5',
      aiCredits: '100',
      accent: 'violet',
      ring: false,
    },
    {
      id: 'OUTREACH_PLUS',
      name: m.outreachPlus,
      price: '¥109',
      yearlyPrice: '¥1,090',
      bestFor: m.bestForOutreachPlus,
      serviceFee: '5%',
      campaignsPerDay: `5 (${m.accumulated})`,
      activeCampaigns: '10',
      conversationsPerDay: '20',
      discoverySearches: '80',
      advancedAnalytics: '3',
      managedOutreach: '15',
      aiCredits: '100',
      accent: 'indigo',
      ring: false,
    },
    {
      id: 'PRO',
      name: m.pro,
      price: '¥199',
      yearlyPrice: '¥1,990',
      bestFor: m.bestForPro,
      serviceFee: '5%',
      campaignsPerDay: `10 (${m.accumulated})`,
      activeCampaigns: '80',
      conversationsPerDay: '50',
      discoverySearches: '150',
      advancedAnalytics: '6',
      managedOutreach: '30',
      aiCredits: '250',
      accent: 'pink',
      ring: true,
    },
  ]

  const handleSubscribe = async (tierId: string) => {
    setLoadingTier(tierId)
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierId, interval: annual ? 'year' : 'month' }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else {
        const data = await res.json()
        alert(data.error || t.errors.somethingWrong)
      }
    } catch {
      alert(t.errors.somethingWrong)
    } finally {
      setLoadingTier(null)
    }
  }

  const handleBuyPack = async (pack: string) => {
    setLoadingTier(`pack-${pack}`)
    try {
      const res = await fetch('/api/stripe/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else {
        const data = await res.json()
        alert(data.error || t.errors.somethingWrong)
      }
    } catch {
      alert(t.errors.somethingWrong)
    } finally {
      setLoadingTier(null)
    }
  }

  const creditCostGroups = [
    {
      title: m.creditGroupAi,
      rows: [
        { label: m.creditCostChatStandard, cost: '1' },
        { label: m.creditCostChatAdvanced, cost: '3' },
        { label: m.creditCostImage, cost: '4' },
        { label: m.creditCostTranslation, cost: m.creditCostFree },
        { label: m.creditCostDocExport, cost: m.creditCostFree },
      ],
    },
    {
      title: m.creditGroupCreatorData,
      rows: [
        { label: m.creditCostSearchExtra, cost: '6' },
        { label: m.creditCostProfileView, cost: '12' },
        { label: m.creditCostAnalytics, cost: '45' },
      ],
    },
  ]

  const creditPacks = [
    { id: 'mini', name: m.packMini, price: '¥9.9', credits: '60', anchor: m.packMiniAnchor },
    { id: 'starter', name: m.packStarter, price: '¥29', credits: '240', anchor: m.packStarterAnchor },
    { id: 'standard', name: m.packStandard, price: '¥99', credits: '880', anchor: m.packStandardAnchor },
    { id: 'pro', name: m.packPro, price: '¥199', credits: '1,800', anchor: m.packProAnchor },
  ]

  return (
    <RoleShell>
      <div className="max-w-6xl mx-auto workspace-page-tight pb-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{m.title}</h1>
            <p className="text-gray-500 mt-1 max-w-xs">{m.subtitle}</p>
          </div>

          {/* Usage strip */}
          {session?.user && usageStrip.length > 0 && (
            <div className="workspace-glass-toolbar rounded-2xl px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">{m.currentUsage}</p>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {usageStrip.map((item) => (
                  <div key={item.key} className="min-w-[90px]">
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{usageDisplay(item)}</p>
                    {item.key === 'aiCredits' && item.extra != null && item.extra > 0 && (
                      <p className="text-[11px] text-primary-500 font-semibold">+{item.extra} {m.purchased}</p>
                    )}
                    <p className="text-[11px] text-gray-400">{usageLabels[item.key] || item.key}</p>
                    <div className="mt-1.5 h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${usagePct(item)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Annual toggle */}
        <div className="flex items-center gap-3 mb-6">
          <span className={`text-sm font-semibold ${!annual ? 'text-gray-900' : 'text-gray-400'}`}>{m.monthly}</span>
          <button
            onClick={() => setAnnual((v) => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-primary-500' : 'bg-gray-200'}`}
            aria-pressed={annual}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6' : ''}`} />
          </button>
          <span className={`text-sm font-semibold ${annual ? 'text-gray-900' : 'text-gray-400'}`}>{m.annual}</span>
          <span className="px-2.5 py-0.5 bg-pink-50 text-pink-600 rounded-full text-[11px] font-semibold">{m.annualSaveTag}</span>
        </div>

        {/* 4-column plan grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {tiers.map((tc) => {
            const isCurrent = tier === tc.id
            const isLoading = loadingTier === tc.id
            const displayPrice = annual && tc.id !== 'FREE' ? tc.yearlyPrice : tc.price
            const priceLabel = annual && tc.id !== 'FREE' ? m.perYear : m.perMonth
            return (
              <div
                key={tc.id}
                className={`workspace-glass-card rounded-3xl p-5 flex flex-col ${tc.ring ? 'ring-2 ring-primary-200' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-base font-bold text-gray-900">{tc.name}</p>
                  {isCurrent && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-semibold">
                      {m.currentPlan}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {displayPrice} <span className="text-xs font-normal text-gray-400">{priceLabel}</span>
                </p>
                {annual && tc.id !== 'FREE' && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{tc.price}{m.perMonth} {m.billedAnnually}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-2 mb-4 flex-shrink-0">{tc.bestFor}</p>

                <div className="flex-1 space-y-2 text-sm border-t border-gray-100 pt-3">
                  <Row label={m.serviceFee} value={tc.serviceFee} />
                  <Row label={m.campaignsPerDay} value={tc.campaignsPerDay} />
                  <Row label={m.liveCampaigns} value={tc.activeCampaigns} />
                  <Row label={m.conversationsPerDay} value={tc.conversationsPerDay} />
                  <Row label={m.translation} value={m.unlimited} />
                  <Row label={m.teamSeats} value="1" />
                  <Row
                    label={m.discoverySearches}
                    value={`${tc.discoverySearches}${m.perMonth} · ${m.searchOverflow.replace('{n}', '6')}`}
                  />
                  <Row label={m.advancedAnalytics} value={tc.advancedAnalytics === '—' ? '—' : `${tc.advancedAnalytics}${m.perMonth}`} />
                  <Row label={m.managedOutreach} value={tc.managedOutreach === '—' ? '—' : `${tc.managedOutreach}${m.perMonth}`} />
                  <Row label={m.aiCreditsLabel} value={`${tc.aiCredits}${m.perMonth}`} highlight />
                </div>

                {tc.id !== 'FREE' && !isCurrent && (
                  <button
                    onClick={() => handleSubscribe(tc.id)}
                    disabled={!!isLoading}
                    className="mt-5 w-full py-2.5 rounded-2xl text-white text-sm font-bold bg-gradient-to-r from-pink-500 to-fuchsia-500 shadow hover:opacity-95 transition disabled:opacity-50"
                  >
                    {isLoading ? m.redirecting : m.upgradeTo.replace('{tier}', tc.name)}
                  </button>
                )}
                {tc.id !== 'FREE' && isCurrent && (
                  <div className="mt-5 w-full py-2.5 rounded-2xl bg-gray-50 text-center text-sm font-semibold text-gray-400">
                    {m.currentPlan}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Shared-credits explainer */}
        <p className="text-xs text-gray-500 bg-white/60 rounded-2xl px-4 py-3 mb-8 -mt-4">
          {m.sharedCreditsExplainer}
        </p>

        {/* Bottom row: credit costs + credit packs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credit costs */}
          <div className="workspace-glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 7h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900">{m.creditCostsTitle}</p>
                <p className="text-[11px] text-gray-400">{m.creditCostsNote}</p>
              </div>
            </div>
            <div className="space-y-4">
              {creditCostGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{group.title}</p>
                  <div className="space-y-2">
                    {group.rows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-2.5 gap-4">
                        <p className="text-sm text-gray-700">{row.label}</p>
                        <span className="text-sm font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
                          {row.cost === m.creditCostFree ? (
                            <span className="text-emerald-600">{m.creditCostFree}</span>
                          ) : (
                            <>{row.cost} {m.creditsUnit}</>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Credit packs */}
          <div className="workspace-glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900">{m.buyCreditsTitle}</p>
                <p className="text-[11px] text-gray-400">{m.buyCreditsNote}</p>
              </div>
            </div>
            <div className="space-y-3">
              {creditPacks.map((pack) => {
                const isPackLoading = loadingTier === `pack-${pack.id}`
                return (
                  <div key={pack.id} className="flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-3">
                    <div className="flex-shrink-0 text-center min-w-[48px]">
                      <p className="text-base font-bold text-gray-900">{pack.price}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{pack.credits} {m.credits}</p>
                      <p className="text-[11px] text-gray-400 truncate">{pack.anchor}</p>
                    </div>
                    <button
                      onClick={() => handleBuyPack(pack.id)}
                      disabled={!!isPackLoading}
                      className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-600 text-xs font-bold hover:bg-primary-100 transition disabled:opacity-50"
                    >
                      {isPackLoading ? '...' : m.buy}
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">{m.purchasedCreditsNote}</p>
          </div>
        </div>
      </div>
    </RoleShell>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-gray-50 last:border-b-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className={`text-[12px] font-semibold text-right ${highlight ? 'text-primary-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}
