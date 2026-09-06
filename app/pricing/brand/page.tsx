'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import RoleShell from '@/components/workspace/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { perCreditYuan, formatPackName } from '@/lib/pricing-display'

interface UsageItem {
  key: string
  used: number | null
  limit: number | null
  extra?: number
  enabled?: boolean
}

interface PlanRow {
  tier: string
  priceMonthly: number
  priceAnnual: number
  baseCredits: number
  bonusCredits: number
}

interface PackRow {
  id: string
  priceCents: number
  baseCredits: number
  bonusCredits: number
  freeUserEligible: boolean
}

interface PricingConfig {
  plans: PlanRow[]
  packs: PackRow[]
  prices: Record<string, number>
}

const TIER_ORDER = ['FREE', 'CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO']

const TIER_META: Record<string, { ring: boolean }> = {
  FREE: { ring: false },
  CAMPAIGN_PLUS: { ring: false },
  OUTREACH_PLUS: { ring: false },
  PRO: { ring: true },
}

// Discovery quotas per tier (unchanged from before)
// Metered features shown on plan cards, in display order. Gated features
// render "—" on tiers that can't use them (mirrors lib/metering.ts).
const METERED_FEATURES = [
  'chat_standard',
  'chat_advanced',
  'image',
  'discovery_search',
  'profile_view',
  'outreach',
  'analytics',
] as const

const FEATURE_TIER_GATES: Record<string, string[]> = {
  outreach: ['OUTREACH_PLUS', 'PRO'],
  analytics: ['PRO'],
}

// Feature key → i18n key for computeEquivalents equivalents display
const EQUIV_LABEL_KEY: Record<string, string> = {
  chat_standard: 'creditFeatureChatStandard',
  chat_advanced: 'creditFeatureChatAdvanced',
  image: 'creditFeatureImage',
  discovery_search: 'creditFeatureDiscoverySearch',
  profile_view: 'creditFeatureProfileView',
  outreach: 'creditFeatureOutreach',
  analytics: 'creditFeatureAnalytics',
}

export default function MyPlanPage() {
  const { data: session } = useSession()
  const { locale, t } = useLanguage()
  const m = t.myPlan

  const tier = (session?.user as any)?.subscriptionTier || 'FREE'
  const [usage, setUsage] = useState<UsageItem[] | null>(null)
  const [annual, setAnnual] = useState(false)
  const [loadingTier, setLoadingTier] = useState<string | null>(null)
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const plansRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/plan/usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.items && setUsage(data.items))
      .catch(() => {})
  }, [session?.user])

  useEffect(() => {
    fetch('/api/pricing/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setConfig(data))
      .catch(() => {})
  }, [])

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
      return item.used != null && item.limit != null ? `${item.used} / ${item.limit}` : '—'
    }
    if (item.used == null || item.limit == null) return '—'
    return `${item.used} / ${item.limit}`
  }

  const usagePct = (item: UsageItem) => {
    if (item.used == null || !item.limit) return 0
    return Math.min(100, Math.round((item.used / item.limit) * 100))
  }

  // Sorted plans in display order
  const sortedPlans = config
    ? (TIER_ORDER.map((id) => config.plans.find((p) => p.tier === id)).filter(Boolean) as PlanRow[])
    : []

  const prices = config?.prices || {}

  // Tier name from i18n
  const tierName = (tierId: string) => {
    const names: Record<string, string> = {
      FREE: m.free,
      CAMPAIGN_PLUS: m.campaignPlus,
      OUTREACH_PLUS: m.outreachPlus,
      PRO: m.pro,
    }
    return names[tierId] || tierId
  }

  const tierBestFor = (tierId: string) => {
    const map: Record<string, string> = {
      FREE: m.bestForFree,
      CAMPAIGN_PLUS: m.bestForCampaignPlus,
      OUTREACH_PLUS: m.bestForOutreachPlus,
      PRO: m.bestForPro,
    }
    return map[tierId] || ''
  }

  // Price display helpers
  const centsToYuan = (cents: number) => {
    const y = cents / 100
    if (y % 1 === 0) return `¥${y}`
    // Strip trailing zeros
    return `¥${y.toFixed(2).replace(/\.?0+$/, '')}`
  }

  const annualMonthlyEquiv = (plan: PlanRow) => {
    const y = plan.priceAnnual / 100 / 12
    return `¥${Math.round(y)}`
  }

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

  const handleBuyPack = async (packId: string) => {
    setLoadingTier(`pack-${packId}`)
    setUpgradeError(null)
    try {
      const res = await fetch('/api/stripe/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packId }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else if (res.status === 409) {
        setUpgradeError(packId)
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

  // Credit cost table — built from config prices; null cost = free
  const creditCostGroups = [
    {
      title: m.creditGroupAi,
      rows: [
        { label: m.creditCostChatStandard, cost: prices['chat_standard'] ?? null },
        { label: m.creditCostChatAdvanced, cost: prices['chat_advanced'] ?? null },
        { label: m.creditCostImage, cost: prices['image'] ?? null },
        { label: m.creditCostTranslation, cost: null as number | null },
        { label: m.creditCostDocExport, cost: null as number | null },
      ],
    },
    {
      title: m.creditGroupCreatorData,
      rows: [
        { label: m.creditCostSearchExtra, cost: prices['discovery_search'] ?? null },
        { label: m.creditCostProfileView, cost: prices['profile_view'] ?? null },
        { label: m.creditCostAnalytics, cost: prices['analytics'] ?? null },
      ],
    },
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
        <div ref={plansRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {sortedPlans.map((plan) => {
            const meta = TIER_META[plan.tier] || { ring: false }
            const isCurrent = tier === plan.tier
            const isLoading = loadingTier === plan.tier
            const total = plan.baseCredits + plan.bonusCredits

            // Price line
            let displayPrice: string
            let monthlyNote: string | null = null
            if (plan.tier === 'FREE') {
              displayPrice = '¥0'
            } else if (annual) {
              displayPrice = annualMonthlyEquiv(plan)
              monthlyNote = `${centsToYuan(plan.priceAnnual)}${m.perYear} · ${m.billedAnnually}`
            } else {
              displayPrice = centsToYuan(plan.priceMonthly)
            }

            return (
              <div
                key={plan.tier}
                className={`workspace-glass-card rounded-3xl p-5 flex flex-col ${meta.ring ? 'ring-2 ring-primary-200' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-base font-bold text-gray-900">{tierName(plan.tier)}</p>
                  {isCurrent && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-semibold">
                      {m.currentPlan}
                    </span>
                  )}
                </div>

                {/* Price */}
                <p className="text-2xl font-bold text-gray-900">
                  {displayPrice} <span className="text-xs font-normal text-gray-400">{m.perMonth}</span>
                </p>
                {annual && plan.tier !== 'FREE' && (
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <p className="text-[11px] text-gray-400">{monthlyNote}</p>
                    <span className="px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded-full text-[10px] font-semibold">{m.annualSaveBadge}</span>
                  </div>
                )}

                <p className="text-[11px] text-gray-500 mt-2 mb-3 flex-shrink-0">{tierBestFor(plan.tier)}</p>

                {/* Credits block */}
                <div className="bg-primary-50 rounded-2xl px-3 py-2 mb-3">
                  {plan.tier === 'FREE' ? (
                    <p className="text-sm font-bold text-primary-700">
                      {plan.baseCredits} credits{locale === 'zh' ? '/月' : '/mo'}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-primary-700">
                      {total} credits{locale === 'zh' ? '/月' : '/mo'}{' '}
                      <span className="font-normal text-[11px] text-primary-500">
                        ({plan.baseCredits} +{' '}
                        <span className="font-semibold text-pink-500">{plan.bonusCredits} {locale === 'zh' ? '加赠' : 'bonus'}</span>)
                      </span>
                    </p>
                  )}
                </div>

                {/* Max uses per feature (whole allowance spent on one feature) */}
                <div className="flex-1 border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    {m.maxUsesPerMonth}
                  </p>
                  <div className="space-y-2 text-sm">
                    {METERED_FEATURES.map((key) => {
                      const price = config?.prices?.[key]
                      if (!price || price <= 0) return null
                      const gate = FEATURE_TIER_GATES[key]
                      const allowed = !gate || gate.includes(plan.tier)
                      const count = Math.floor(total / price)
                      const labelKey = EQUIV_LABEL_KEY[key]
                      const label = labelKey ? (m as Record<string, string>)[labelKey] ?? key : key
                      return (
                        <Row
                          key={key}
                          label={label}
                          value={allowed && count > 0 ? `×${count}${m.perMonth}` : '—'}
                        />
                      )
                    })}
                    <Row label={m.translation} value={m.unlimited} />
                  </div>
                </div>

                {plan.tier !== 'FREE' && !isCurrent && (
                  <button
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={!!isLoading}
                    className="mt-5 w-full py-2.5 rounded-2xl text-white text-sm font-bold bg-gradient-to-r from-pink-500 to-fuchsia-500 shadow hover:opacity-95 transition disabled:opacity-50"
                  >
                    {isLoading ? m.redirecting : m.upgradeTo.replace('{tier}', tierName(plan.tier))}
                  </button>
                )}
                {plan.tier !== 'FREE' && isCurrent && (
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
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{m.creditCostsTitle}</p>
                <p className="text-[11px] text-gray-400">{m.creditCostsNote}</p>
              </div>
              <HowCreditsWorkPopover m={m as Record<string, string>} />
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
                          {row.cost == null || row.cost === 0 ? (
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
            <div className="flex items-center gap-3 mb-2">
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

            {/* Nudge line */}
            <p className="text-[11px] text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 mb-4">{m.packNudge}</p>

            <div className="space-y-3">
              {(config?.packs || []).map((pack) => {
                const totalCredits = pack.baseCredits + pack.bonusCredits
                const isPackLoading = loadingTier === `pack-${pack.id}`
                const perCredit = perCreditYuan(pack.priceCents, totalCredits)
                const packLabel = formatPackName(pack.priceCents, totalCredits)
                const priceStr = packLabel.split(' /')[0]
                return (
                  <div key={pack.id}>
                    <div className="flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-3">
                      <div className="flex-shrink-0 min-w-[52px]">
                        <p className="text-base font-bold text-gray-900">{priceStr}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">
                          {pack.bonusCredits > 0
                            ? m.packBonus
                                .replace('{base}', String(pack.baseCredits))
                                .replace('{bonus}', String(pack.bonusCredits))
                            : `${pack.baseCredits} credits`}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {m.packPerCredit.replace('{v}', perCredit)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleBuyPack(pack.id)}
                        disabled={!!isPackLoading}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-600 text-xs font-bold hover:bg-primary-100 transition disabled:opacity-50"
                      >
                        {isPackLoading ? '...' : m.buy}
                      </button>
                    </div>
                    {upgradeError === pack.id && (
                      <div className="mt-1.5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-800">
                        <span className="flex-1">{m.upgradeRequired}</span>
                        <button
                          onClick={() => {
                            setUpgradeError(null)
                            plansRef.current?.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className="font-bold underline whitespace-nowrap"
                        >
                          {m.upgradeRequiredCta}
                        </button>
                      </div>
                    )}
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

// "How credits work" info popover
function HowCreditsWorkPopover({ m }: { m: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition flex items-center justify-center text-xs font-bold"
        aria-label={m.howCreditsWorkTitle}
        title={m.howCreditsWorkTitle}
      >
        ?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 w-64 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 text-[12px] text-gray-700 space-y-2">
            <p className="font-bold text-gray-900 mb-1">{m.howCreditsWorkTitle}</p>
            <p>• {m.howCreditsWork1}</p>
            <p>• {m.howCreditsWork2}</p>
            <p>• {m.howCreditsWork3}</p>
          </div>
        </>
      )}
    </div>
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

