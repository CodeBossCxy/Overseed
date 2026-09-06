'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import RoleShell from '@/components/workspace/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { perCreditYuan, formatPackName } from '@/lib/pricing-display'

interface PlanRow {
  tier: string
  priceMonthly: number
  priceAnnual: number
  baseCredits: number
  bonusCredits: number
  compareAtMonthly: number
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

const TIER_META: Record<string, { ring: boolean; popular: boolean }> = {
  FREE: { ring: false, popular: false },
  CAMPAIGN_PLUS: { ring: false, popular: false },
  OUTREACH_PLUS: { ring: true, popular: true },
  PRO: { ring: false, popular: false },
}

const METERED_FEATURES = [
  'chat_standard',
  'chat_advanced',
  'image',
  'discovery_search',
  'profile_view',
  'analytics',
] as const

const FEATURE_TIER_GATES: Record<string, string[]> = {
  outreach: ['CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO'],
  analytics: ['CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO'],
}

const EQUIV_LABEL_KEY: Record<string, string> = {
  chat_standard: 'creditFeatureChatStandard',
  chat_advanced: 'creditFeatureChatAdvanced',
  image: 'creditFeatureImage',
  discovery_search: 'creditFeatureDiscoverySearch',
  profile_view: 'creditFeatureProfileOutreach',
  analytics: 'creditFeatureAnalytics',
}

// Features in CREATOR DATABASE section
const CREATOR_DB_FEATURES = ['discovery_search', 'profile_view', 'analytics'] as const
// Features in AI FEATURES section
const AI_FEATURES = ['chat_standard', 'chat_advanced', 'image'] as const

export default function MyPlanPage() {
  const { data: session } = useSession()
  const { locale, t } = useLanguage()
  const m = t.myPlan

  const tier = (session?.user as any)?.subscriptionTier || 'FREE'
  const [annual, setAnnual] = useState(false)
  const [loadingTier, setLoadingTier] = useState<string | null>(null)
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const plansRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/pricing/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setConfig(data))
      .catch(() => {})
  }, [])

  const sortedPlans = config
    ? (TIER_ORDER.map((id) => config.plans.find((p) => p.tier === id)).filter(Boolean) as PlanRow[])
    : []

  const prices = config?.prices || {}

  const mm = m as Record<string, string>

  // Highlighted column = the user's current plan; visitors (or unknown
  // tiers) see the Most Popular plan highlighted instead.
  const highlightTier = TIER_ORDER.includes(tier) && session?.user ? tier : 'OUTREACH_PLUS'

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

  const centsToYuan = (cents: number) => {
    const y = cents / 100
    if (y % 1 === 0) return `¥${y}`
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

  const creditEquiv = (plan: PlanRow, key: typeof METERED_FEATURES[number]) => {
    const total = plan.baseCredits + plan.bonusCredits
    const price = prices[key]
    if (!price || price <= 0) return '—'
    const gate = FEATURE_TIER_GATES[key]
    const allowed = !gate || gate.includes(plan.tier)
    if (!allowed) return '—'
    if (key === 'discovery_search') {
      const pages = Math.floor(total / price)
      const creators = pages * 10
      if (creators <= 0) return '—'
      return mm.upToNCreators.replace('{n}', creators.toLocaleString())
    }
    if (key === 'profile_view' || key === 'analytics') {
      const n = Math.floor(total / price)
      if (n <= 0) return '—'
      return mm.upToNCreators.replace('{n}', n.toLocaleString())
    }
    const n = Math.floor(total / price)
    if (n <= 0) return '—'
    return mm.upToN.replace('{n}', n.toLocaleString())
  }

  const campaignSignupRows = [
    {
      label: m.campaignsPerDay,
      tooltip: undefined as string | undefined,
      values: {
        FREE: mm.campaignsPerDayFreeValue,
        CAMPAIGN_PLUS: mm.campaignsPerDayPaidValue,
        OUTREACH_PLUS: mm.campaignsPerDayPaidValue,
        PRO: mm.campaignsPerDayProValue,
      } as Record<string, string>,
    },
    {
      label: mm.activeCampaigns,
      tooltip: undefined as string | undefined,
      values: { FREE: '1', CAMPAIGN_PLUS: '50', OUTREACH_PLUS: '50', PRO: '80' } as Record<string, string>,
    },
    {
      label: mm.creatorApplications,
      tooltip: undefined as string | undefined,
      values: { FREE: m.unlimited, CAMPAIGN_PLUS: m.unlimited, OUTREACH_PLUS: m.unlimited, PRO: m.unlimited } as Record<string, string>,
    },
    {
      label: mm.newConversationsPerDay,
      tooltip: undefined as string | undefined,
      values: { FREE: '10', CAMPAIGN_PLUS: '50', OUTREACH_PLUS: '20', PRO: '50' } as Record<string, string>,
    },
    {
      label: mm.messagingRow,
      tooltip: undefined as string | undefined,
      values: { FREE: m.unlimited, CAMPAIGN_PLUS: m.unlimited, OUTREACH_PLUS: m.unlimited, PRO: m.unlimited } as Record<string, string>,
    },
    {
      label: mm.successfulCollabFee,
      tooltip: undefined as string | undefined,
      // Launch offer: regular fee struck through, promo fee shown.
      values: {
        FREE: '8%',
        CAMPAIGN_PLUS: (
          <>
            <s className="text-gray-400 font-normal mr-1">6%</s>
            {mm.launchOfferPct.replace('{n}', '3')}
          </>
        ),
        OUTREACH_PLUS: (
          <>
            <s className="text-gray-400 font-normal mr-1">6%</s>
            {mm.launchOfferPct.replace('{n}', '3')}
          </>
        ),
        PRO: (
          <>
            <s className="text-gray-400 font-normal mr-1">5%</s>
            {mm.launchOfferFree}
          </>
        ),
      } as Record<string, React.ReactNode>,
    },
  ]

  // Index of OUTREACH_PLUS in sortedPlans (for column highlight)
  const outreachPlusColIndex = sortedPlans.findIndex((p) => p.tier === 'OUTREACH_PLUS')

  return (
    <RoleShell>
      <div className="max-w-6xl mx-auto workspace-page-tight pb-8">
        {/* 1. Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{m.title}</h1>
          <p className="text-gray-500 mt-1 max-w-lg">{m.subtitle}</p>
        </div>

        {/* 2. Annual/monthly toggle */}
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

        {/* 3. Unified comparison matrix */}
        <div ref={plansRef} className="workspace-glass-card rounded-3xl overflow-hidden mb-6">
          <div className="overflow-x-auto" style={{ minWidth: 700 }}>
            <div
              className="grid"
              style={{ gridTemplateColumns: 'minmax(160px,1.3fr) repeat(4,minmax(140px,1fr))' }}
            >

              {/* ── ROW 1: column headers (plan cards) ── */}
              {/* empty label cell */}
              <div className="p-5" />

              {sortedPlans.map((plan, colIdx) => {
                const meta = TIER_META[plan.tier] || { ring: false, popular: false }
                const isCurrent = tier === plan.tier
                const isLoading = loadingTier === plan.tier
                const total = plan.baseCredits + plan.bonusCredits
                const isHighlight = plan.tier === highlightTier

                let displayPrice: string
                let compareAtDisplay: string | null = null
                let monthlyNote: string | null = null
                if (plan.tier === 'FREE') {
                  displayPrice = '¥0'
                } else if (annual) {
                  displayPrice = annualMonthlyEquiv(plan)
                  monthlyNote = `${centsToYuan(plan.priceAnnual)}${m.perYear} · ${m.billedAnnually}`
                  if (plan.compareAtMonthly > 0) {
                    compareAtDisplay = `¥${Math.round(plan.compareAtMonthly * 10 / 100 / 12)}`
                  }
                } else {
                  displayPrice = centsToYuan(plan.priceMonthly)
                  if (plan.compareAtMonthly > 0) {
                    compareAtDisplay = centsToYuan(plan.compareAtMonthly)
                  }
                }

                return (
                  <div
                    key={plan.tier}
                    className={`relative p-5 pt-8 flex flex-col border-l border-gray-100 ${isHighlight ? 'bg-violet-50/50 rounded-tr-3xl' : ''}`}
                  >
                    {/* Most Popular badge — inside the cell (the card wrapper
                        has overflow-hidden, so it can't hang above the edge) */}
                    {meta.popular && (
                      <span className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-violet-600 text-white rounded-full text-[10px] font-semibold whitespace-nowrap shadow z-10">
                        {mm.mostPopular}
                      </span>
                    )}

                    {/* ring outline for popular column */}
                    {isHighlight && (
                      <div className="absolute inset-0 rounded-tr-3xl ring-2 ring-violet-300 pointer-events-none" />
                    )}

                    {/* Tier name + current badge */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-base font-bold text-gray-900">{tierName(plan.tier)}</p>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-semibold">
                          {m.currentPlan}
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {compareAtDisplay && (
                        <span className="text-sm font-normal text-gray-400 line-through">{compareAtDisplay}</span>
                      )}
                      <p className="text-2xl font-bold text-gray-900">
                        {displayPrice} <span className="text-xs font-normal text-gray-400">{m.perMonth}</span>
                      </p>
                    </div>
                    {annual && plan.tier !== 'FREE' && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <p className="text-[11px] text-gray-400">{monthlyNote}</p>
                        <span className="px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded-full text-[10px] font-semibold">{m.annualSaveBadge}</span>
                      </div>
                    )}

                    {/* Best-for */}
                    <p className="text-xs text-gray-500 mt-2 mb-3">{tierBestFor(plan.tier)}</p>

                    {/* Credits pill */}
                    {plan.tier === 'FREE' ? (
                      <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 mb-4 self-start">
                        <span className="text-sm font-bold text-blue-700">
                          {plan.baseCredits} credits{locale === 'zh' ? '/月' : '/mo'}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-50 mb-4 self-start">
                        <span className="text-sm font-bold text-amber-700">
                          {plan.baseCredits}{' '}
                          <span className="font-semibold text-amber-500">
                            + {plan.bonusCredits} {locale === 'zh' ? '加赠' : 'bonus'}
                          </span>
                          {' '}= {total} credits{locale === 'zh' ? '/月' : '/mo'}
                        </span>
                      </div>
                    )}

                    {/* CTA */}
                    {plan.tier === 'FREE' ? (
                      isCurrent ? (
                        <div className="mt-auto w-full py-2.5 rounded-2xl bg-gray-50 text-center text-sm font-semibold text-gray-400">
                          {m.currentPlan}
                        </div>
                      ) : (
                        <a
                          href="/auth/signup"
                          className="mt-auto w-full py-2.5 rounded-2xl border border-gray-200 text-center text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
                        >
                          {mm.getStarted}
                        </a>
                      )
                    ) : isCurrent ? (
                      <div className="mt-auto w-full py-2.5 rounded-2xl bg-gray-50 text-center text-sm font-semibold text-gray-400">
                        {m.currentPlan}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan.tier)}
                        disabled={!!isLoading}
                        className="mt-auto w-full py-2.5 rounded-2xl text-white text-sm font-bold bg-gradient-to-r from-pink-500 to-fuchsia-500 shadow hover:opacity-95 transition disabled:opacity-50"
                      >
                        {isLoading ? m.redirecting : m.upgradeTo.replace('{tier}', tierName(plan.tier))}
                      </button>
                    )}
                  </div>
                )
              })}

              {/* ── SECTION DIVIDER: CAMPAIGNS ── */}
              <MatrixSectionDivider
                label={mm.campaignSignupsTitle.toUpperCase()}
                tooltip={mm.campaignSignupsNote}
                colCount={sortedPlans.length}
              />

              {/* Campaign rows + platform fee row */}
              {campaignSignupRows.map((row, rowIdx) => {
                const isLast = rowIdx === campaignSignupRows.length - 1
                return (
                  <MatrixRow
                    key={row.label}
                    label={row.label}
                    plans={sortedPlans}
                    getValue={(p) => row.values[p.tier] ?? '—'}
                    isLast={isLast}
                    highlightTier={highlightTier}
                    isFeeRow={row.label === mm.successfulCollabFee}
                  />
                )
              })}

              {/* ── SECTION DIVIDER: CREATOR DATABASE ── */}
              <MatrixSectionDivider
                label={mm.creatorDbSectionTitle.toUpperCase()}
                colCount={sortedPlans.length}
              />

              {/* Creator database credit-equiv rows */}
              {CREATOR_DB_FEATURES.map((key, rowIdx) => {
                const price = prices[key]
                if (!price || price <= 0) return null
                const labelKey = EQUIV_LABEL_KEY[key]
                const label = labelKey ? (mm[labelKey] ?? key) : key
                const isLast = rowIdx === CREATOR_DB_FEATURES.length - 1
                const rowNote =
                  key === 'discovery_search'
                    ? mm.discoveryCostNote
                    : key === 'profile_view'
                      ? mm.profileOutreachCostNote
                      : key === 'analytics'
                        ? mm.analyticsCostNote
                        : undefined
                return (
                  <MatrixRow
                    key={key}
                    label={label}
                    plans={sortedPlans}
                    getValue={(p) => creditEquiv(p, key)}
                    isLast={isLast}
                    highlightTier={highlightTier}
                    note={rowNote}
                  />
                )
              })}

              {/* ── SECTION DIVIDER: AI FEATURES ── */}
              <MatrixSectionDivider
                label={mm.aiFeaturesTitle.toUpperCase()}
                colCount={sortedPlans.length}
              />

              {/* AI feature credit-equiv rows */}
              {AI_FEATURES.map((key, rowIdx) => {
                const price = prices[key]
                if (!price || price <= 0) return null
                const labelKey = EQUIV_LABEL_KEY[key]
                const label = labelKey ? (mm[labelKey] ?? key) : key
                const isLast = rowIdx === AI_FEATURES.length - 1
                return (
                  <MatrixRow
                    key={key}
                    label={label}
                    plans={sortedPlans}
                    getValue={(p) => creditEquiv(p, key)}
                    isLast={isLast}
                    highlightTier={highlightTier}
                    isLastSection
                  />
                )
              })}

            </div>
          </div>

          {/* Matrix footer: how-far caption + footnotes */}
          <div className="px-6 py-4 border-t border-gray-100 space-y-1">
            <p className="text-xs text-gray-500">{mm.howFarSubtitle} — {mm.maxUsesCaption}</p>
            <p className="text-xs text-amber-600">{mm.limitedTimeNote}</p>
            <p className="text-xs text-gray-400 italic">{mm.maxUsesFootnote}</p>
          </div>
        </div>

        {/* 4. AI & Creator Data — Credit Costs (two cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: AI Features */}
          <div className="workspace-glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l-4 4v2h2l4-4m0 0L9 11m2 2l4.768-4.768a2 2 0 00-2.828-2.828L9 11" />
                </svg>
              </div>
              <p className="font-bold text-gray-900">{mm.aiFeaturesTitle}</p>
            </div>
            <div className="space-y-2">
              <HoverNoteRow note={mm.chatCostNote} className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-2.5 gap-4">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm text-gray-700">{mm.creditCostChat}</p>
                  <InfoIcon />
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
                  {mm.costApprox
                    .replace('{a}', String(prices['chat_standard'] ?? 1))
                    .replace('{b}', String(prices['chat_advanced'] ?? 3))}
                </span>
              </HoverNoteRow>
              <HoverNoteRow note={mm.imageCostNote} className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-2.5 gap-4">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm text-gray-700">{m.creditCostImage}</p>
                  <InfoIcon />
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
                  {prices['image'] ?? 4} {m.creditsUnit}
                </span>
              </HoverNoteRow>
              <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-2.5 gap-4">
                <p className="text-sm text-gray-700">{m.creditCostTranslation}</p>
                <span className="text-sm font-bold text-emerald-600">{m.creditCostFree}</span>
              </div>
              <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-2.5 gap-4">
                <p className="text-sm text-gray-700">{m.creditCostDocExport}</p>
                <span className="text-sm font-bold text-emerald-600">{m.creditCostFree}</span>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-gray-500 mt-3 px-1">{mm.moreAiSoon}</p>
          </div>

          {/* Right: Overseed Creator Database */}
          <div className="workspace-glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3v10c0 1.657-3.582 3-8 3s-8-1.343-8-3V7z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{mm.creatorDbTitle}</p>
              </div>
              <HowCreditsWorkPopover m={mm} />
            </div>
            <div className="space-y-2">
              <HoverNoteRow note={mm.discoveryCostNote} className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-2.5 gap-4">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700">{m.creditCostSearchExtra.split(' — ')[0]}</p>
                    <p className="text-[11px] text-gray-400">{mm.perSearchUnit}</p>
                  </div>
                  <InfoIcon />
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
                  {prices['discovery_search'] ?? '—'} {m.creditsUnit}
                </span>
              </HoverNoteRow>
              <HoverNoteRow note={mm.profileOutreachCostNote} className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-2.5 gap-4">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700">{mm.creditCostProfileOutreach.split(' — ')[0]}</p>
                    <p className="text-[11px] text-gray-400">{mm.perCreatorUnit}</p>
                  </div>
                  <InfoIcon />
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
                  {prices['profile_view'] ?? '—'} {m.creditsUnit}
                </span>
              </HoverNoteRow>
              <HoverNoteRow note={mm.analyticsCostNote} className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-2.5 gap-4">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700">{m.creditCostAnalytics.split(' — ')[0]}</p>
                    <p className="text-[11px] text-gray-400">{mm.perCreatorUnit}</p>
                  </div>
                  <InfoIcon />
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
                  {prices['analytics'] ?? '—'} {m.creditsUnit}
                </span>
              </HoverNoteRow>
            </div>
          </div>
        </div>

        {/* 5. Need More Credits? — Pack cards */}
        <div className="workspace-glass-card rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900">{mm.needMoreCredits}</p>
              <p className="text-[11px] text-gray-400">{mm.needMoreCreditsCaption}</p>
            </div>
          </div>

          <p className="text-[11px] text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 mb-4 mt-3">{m.packNudge}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {(config?.packs || []).map((pack) => {
              const totalCredits = pack.baseCredits + pack.bonusCredits
              const isPackLoading = loadingTier === `pack-${pack.id}`
              const packLabel = formatPackName(pack.priceCents, totalCredits)
              const priceStr = packLabel.split(' /')[0]
              return (
                <div key={pack.id}>
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-4 flex flex-col gap-1">
                    <p className="text-xl font-bold text-gray-900">{priceStr}</p>
                    {pack.bonusCredits > 0 ? (
                      <p className="text-sm font-semibold text-amber-600">
                        {mm.bonusEquals
                          .replace('{base}', String(pack.baseCredits))
                          .replace('{bonus}', String(pack.bonusCredits))
                          .replace('{total}', String(totalCredits))}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-gray-700">{pack.baseCredits} credits</p>
                    )}
                    <button
                      onClick={() => handleBuyPack(pack.id)}
                      disabled={!!isPackLoading}
                      className="mt-2 w-full py-1.5 rounded-xl bg-primary-50 text-primary-600 text-xs font-bold hover:bg-primary-100 transition disabled:opacity-50"
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
    </RoleShell>
  )
}

// Section divider row spanning all 5 grid columns
function MatrixSectionDivider({
  label,
  tooltip,
  colCount,
}: {
  label: string
  tooltip?: string
  colCount: number
}) {
  return (
    <div
      className="col-span-full flex items-center gap-2 px-5 py-3 bg-gray-50 border-t border-b border-gray-100"
    >
      <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">{label}</span>
      {tooltip && <CreditsInfoTooltip note={tooltip} />}
    </div>
  )
}

// Data row: label cell + one cell per plan
function MatrixRow({
  label,
  plans,
  getValue,
  isLast,
  highlightTier,
  isFeeRow,
  isLastSection,
  note,
}: {
  label: string
  plans: PlanRow[]
  getValue: (p: PlanRow) => React.ReactNode
  isLast?: boolean
  highlightTier?: string
  isFeeRow?: boolean
  isLastSection?: boolean
  /** Hover note: ⓘ next to the label, shown after 2s hover / on click. */
  note?: string
}) {
  return (
    <>
      {/* label cell */}
      {note ? (
        <HoverNoteRow
          note={note}
          className={`px-5 py-3.5 flex items-center gap-1.5 text-sm text-gray-600 ${!isLast ? 'border-b border-gray-100' : ''}`}
        >
          <span>{label}</span>
          <InfoIcon />
        </HoverNoteRow>
      ) : (
        <div
          className={`px-5 py-3.5 flex items-center text-sm text-gray-600 ${!isLast ? 'border-b border-gray-100' : ''}`}
        >
          {label}
        </div>
      )}
      {/* value cells */}
      {plans.map((p) => {
        const isHighlight = p.tier === highlightTier
        const val = getValue(p)
        const isPaid = p.tier !== 'FREE'
        const isFeeNotPaid = isFeeRow && p.tier === 'FREE'

        let textClass = 'text-gray-400'
        if (isFeeRow) {
          textClass = isFeeNotPaid ? 'text-gray-700' : 'font-semibold text-primary-600'
        } else if (isPaid && val !== '—') {
          textClass = 'font-semibold text-primary-600'
        }

        return (
          <div
            key={p.tier}
            className={[
              'px-3 py-3.5 flex items-center justify-center text-sm text-center border-l border-gray-100',
              !isLast ? 'border-b border-gray-100' : '',
              isHighlight ? 'bg-violet-50/50' : '',
              isLastSection && isLast && isHighlight ? 'rounded-br-none' : '',
            ].join(' ')}
          >
            <span className={textClass}>{val}</span>
          </div>
        )
      })}
    </>
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

/** Clear ⓘ glyph (circled info), replacing the old ambiguous text "i" chip. */
function InfoIcon({ className = 'w-3.5 h-3.5 text-gray-400' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`flex-shrink-0 ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9.25" />
      <path strokeLinecap="round" d="M12 11.2v5" />
      <circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

const HOVER_NOTE_DELAY_MS = 2000

function CreditsInfoTooltip({ note }: { note: string }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enter = () => {
    timer.current = setTimeout(() => setOpen(true), HOVER_NOTE_DELAY_MS)
  }
  const leave = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }
  return (
    <div className="relative flex-shrink-0" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-gray-400 hover:text-gray-600 transition flex items-center justify-center"
        aria-label={note}
      >
        <InfoIcon />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            data-solid
            className="absolute left-0 top-6 z-20 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 text-[11px] text-gray-700 whitespace-pre-line"
          >
            {note}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Row wrapper: hovering anywhere on the option for 2s (or clicking it) shows
 * the note, anchored under the row. The inline InfoIcon inside is the visual
 * cue only.
 */
function HoverNoteRow({
  note,
  className = '',
  children,
}: {
  note: string
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enter = () => {
    timer.current = setTimeout(() => setOpen(true), HOVER_NOTE_DELAY_MS)
  }
  const leave = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }
  return (
    <div
      className={`relative cursor-default ${className}`}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onClick={() => setOpen((v) => !v)}
    >
      {children}
      {open && (
        <div
          data-solid
          className="absolute left-3 right-3 top-full mt-1 z-20 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 text-[11px] text-gray-700 whitespace-pre-line"
        >
          {note}
        </div>
      )}
    </div>
  )
}
