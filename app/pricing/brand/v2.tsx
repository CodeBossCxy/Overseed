'use client'

// TEMP (beta) V2 of the brand pricing page: credit costs per feature, the
// beta 900-credit grant notice, and the 新手任务 starter-task checklist.
// The full pricing page lives untouched in ./v1.tsx — reachable via the
// "View full pricing" button, or swap ./page.tsx back to './v1'.

import { useState, useEffect } from 'react'
import RoleShell from '@/components/workspace/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDateTime } from '@/lib/i18n/formatDate'
import CreditHistoryPanel from '@/components/credits/CreditHistoryPanel'
import V1 from './v1'

interface Goal {
  count: number
  target: number
}

interface BetaChallenge {
  goals: {
    feedback: Goal
    legit: Goal
    launch: Goal
    outreach: Goal
    connect: Goal
  }
  completedCount: number
  deadline: string | null
  withinWindow: boolean
  reward450Granted: boolean
  reward900Granted: boolean
  firstCollab: { achieved: boolean; granted: boolean }
}

interface Balance {
  subscription: number
  purchased: number
  total: number
  nextExpiry: { at: string; credits: number } | null
  cycleCredits: number
}

const BETA_FREE_CREDITS = 900

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  chat: 'M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8z',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 17l.9 2.1L22 20l-2.1.9L19 23l-.9-2.1L16 20l2.1-.9L19 17z',
  image: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z',
  check: 'M20 6L9 17l-5-5',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
}

function CreditBadge({ value, unit }: { value: number | null | undefined; unit: string }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-[#7B9FE0] text-white text-xs font-bold whitespace-nowrap">
      {value != null ? `${value} ${unit}` : '—'}
    </span>
  )
}

export default function BrandPricingBetaPage() {
  const { t, locale } = useLanguage()
  const m = t.myPlan as Record<string, string>
  const b = t.pricing.beta

  const [showFull, setShowFull] = useState(false)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [challenge, setChallenge] = useState<BetaChallenge | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)

  useEffect(() => {
    fetch('/api/pricing/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.prices && setPrices(data.prices))
      .catch(() => {})
    fetch('/api/starter-tasks')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.goals && setChallenge(data))
      .catch(() => {})
    fetch('/api/credits/balance')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && typeof data.total === 'number' && setBalance(data))
      .catch(() => {})
  }, [])

  if (showFull) {
    return (
      <>
        <V1 />
        <button
          onClick={() => setShowFull(false)}
          className="fixed bottom-6 left-6 z-50 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-lg hover:bg-gray-800 transition"
        >
          {b.backToBeta}
        </button>
      </>
    )
  }

  const freeTotal = balance?.cycleCredits || BETA_FREE_CREDITS
  const pct = balance ? Math.max(0, Math.min(100, Math.round((balance.total / freeTotal) * 100))) : 0

  const dbFeatures = [
    {
      icon: ICONS.search,
      label: m.creditFeatureDiscoverySearch || 'Discovery Search',
      hint: b.hintDiscoverySearch,
      price: prices.discovery_search,
    },
    {
      icon: ICONS.profile,
      label: m.creditFeatureProfileOutreach || 'Creator Profile / Outreach',
      hint: b.hintProfileOutreach,
      price: prices.profile_view,
    },
  ]

  const aiFeatures = [
    { icon: ICONS.chat, label: m.creditFeatureChatStandard || 'AI Chat Standard', price: prices.chat_standard },
    { icon: ICONS.sparkles, label: m.creditFeatureChatAdvanced || 'AI Chat Advanced', price: prices.chat_advanced },
    { icon: ICONS.image, label: m.creditFeatureImage || 'AI Image', price: prices.image },
  ]

  const goalDefs = challenge
    ? [
        {
          label: b.goal1Label,
          hint: b.goal1Hint,
          ...challenge.goals.feedback,
        },
        {
          label: b.goal2Label,
          hint: b.goal2Hint,
          ...challenge.goals.legit,
        },
        {
          label: b.goal3Label,
          hint: b.goal3Hint,
          ...challenge.goals.launch,
        },
        {
          label: b.goal4Label,
          hint: b.goal4Hint,
          ...challenge.goals.outreach,
        },
        {
          label: b.goal5Label,
          hint: b.goal5Hint,
          ...challenge.goals.connect,
        },
      ]
    : []

  const unit = m.creditsUnit || 'cr'

  return (
    <RoleShell>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest text-[#7B9FE0] uppercase">
            {b.myPlanLabel}
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-1">
            {b.pageTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {b.pageSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ---- Main column ---- */}
          <div className="lg:col-span-2 space-y-6">
            {/* Beta hero banner */}
            <div className="rounded-3xl bg-gradient-to-r from-[#8BA7E8] to-[#7B9FE0] text-white overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="p-7 md:border-r md:border-white/20">
                  <p className="text-xl font-bold">
                    🎉 {b.heroTitle}
                  </p>
                  <p className="text-sm mt-2 text-white/85 leading-relaxed">
                    {b.heroBody}
                  </p>
                  <a
                    href="/dashboard/brand/campaigns"
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#5A7FD1] text-sm font-bold hover:bg-[#EDF2FC] transition"
                  >
                    {b.createCampaign}
                    <Icon d={ICONS.arrowRight} className="w-4 h-4" />
                  </a>
                </div>
                <div className="p-7">
                  <p className="text-sm font-medium text-white/85">
                    {b.availableCredits}
                  </p>
                  <p className="text-5xl font-extrabold mt-1 tabular-nums">
                    {balance ? balance.total : '—'}
                  </p>
                  <p className="text-xs text-white/75 mt-1">
                    {b.ofNFreeCredits.replace('{n}', String(freeTotal))}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-white/25 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-300 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {balance?.nextExpiry && (
                    <p className="text-xs text-white/75 mt-2">
                      {b.creditsExpireOn.replace('{d}', formatDateTime(balance.nextExpiry.at, locale))}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing & credit usage */}
            <div className="bg-white rounded-3xl shadow-sm p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {b.sectionTitle}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {b.sectionSubtitle}
                  </p>
                </div>
                <button
                  onClick={() => setShowFull(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#7B9FE0] text-white text-sm font-semibold hover:bg-[#6D93DB] transition"
                >
                  {b.viewFullPricing}
                  <Icon d={ICONS.arrowRight} className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-5 grid sm:grid-cols-3 gap-3">
                {dbFeatures.map((f) => (
                  <div key={f.label} className="relative rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                    <div className="w-10 h-10 rounded-xl bg-[#E8EEFB] text-[#7B9FE0] flex items-center justify-center mb-3">
                      <Icon d={f.icon} />
                    </div>
                    <p className="text-sm font-bold text-gray-900">{f.label}</p>
                    {f.hint && <p className="text-xs text-gray-400 mt-0.5 leading-snug">{f.hint}</p>}
                    <div className="mt-3">
                      <CreditBadge value={f.price} unit={unit} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Credit history — the panel brings its own title/subtitle */}
            <CreditHistoryPanel />
          </div>

          {/* ---- Sidebar ---- */}
          <div className="space-y-6">
            {/* Beta Challenge */}
            <div className="bg-white rounded-3xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-gray-900">{b.betaChallengeTitle}</h2>
                  <span
                    className="text-gray-300"
                    title={b.betaChallengeTooltip}
                  >
                    <Icon d={ICONS.info} className="w-4 h-4" />
                  </span>
                </div>
                {challenge && (
                  <span className="text-xs font-bold text-gray-500">{challenge.completedCount} / 5</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3 leading-snug">
                {b.betaChallengeSubtitle}
                {challenge?.deadline && (
                  <> {b.betaDeadline.replace('{d}', formatDateTime(challenge.deadline, locale))}</>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    challenge?.reward450Granted ? 'bg-green-100 text-green-700' : 'bg-[#E8EEFB] text-[#5A7FD1]'
                  }`}
                >
                  {challenge?.reward450Granted ? '✓ ' : ''}
                  {b.reward3of5}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    challenge?.reward900Granted ? 'bg-green-100 text-green-700' : 'bg-[#E8EEFB] text-[#5A7FD1]'
                  }`}
                >
                  {challenge?.reward900Granted ? '✓ ' : ''}
                  {b.rewardAll5}
                </span>
              </div>

              {!challenge ? (
                <div className="space-y-4 animate-pulse">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {goalDefs.map((task) => {
                    const done = task.count >= task.target
                    const barPct = Math.min(100, Math.round((task.count / task.target) * 100))
                    return (
                      <div key={task.label} className="flex gap-3">
                        <span
                          className={`mt-0.5 w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                            done
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-[#C9D7F4] text-[#C9D7F4]'
                          }`}
                        >
                          <Icon d={ICONS.check} className="w-3.5 h-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-sm font-bold ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {task.label}
                            </p>
                            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                              {Math.min(task.count, task.target)} / {task.target}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-snug">{task.hint}</p>
                          <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-[#7B9FE0]'}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {challenge && !challenge.withinWindow && !challenge.reward900Granted && (
                <p className="mt-4 text-xs text-amber-600">
                  {b.challengeEnded}
                </p>
              )}
            </div>

            {/* First Collaboration Bonus */}
            <div className="bg-white rounded-3xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">
                  {b.firstCollabTitle}
                </h2>
                {challenge?.firstCollab.granted ? (
                  <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                    {b.firstCollabGranted}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-[#E8EEFB] text-[#5A7FD1] text-xs font-bold">
                    +100
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 leading-snug">
                {b.firstCollabBody}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-snug">
                {b.firstCollabNote}
              </p>
            </div>

            {/* AI features */}
            <div className="bg-white rounded-3xl shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900">{b.aiFeaturesTitle}</h2>
              <p className="text-xs text-gray-500 mt-1 mb-4 leading-snug">
                {b.aiFeaturesSubtitle}
              </p>
              <div className="space-y-2.5">
                {aiFeatures.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#E8EEFB] text-[#7B9FE0] flex items-center justify-center">
                        <Icon d={f.icon} className="w-4.5 h-4.5" />
                      </div>
                      <p className="text-sm font-bold text-gray-900">{f.label}</p>
                    </div>
                    <CreditBadge value={f.price} unit={unit} />
                  </div>
                ))}
              </div>
            </div>

            {/* Need more credits */}
            <div className="rounded-3xl bg-gradient-to-br from-[#EDF2FC] to-[#DCE7F8] p-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-500 flex items-center justify-center">
                  <Icon d={ICONS.bulb} className="w-4.5 h-4.5" />
                </div>
                <p className="text-sm font-bold text-gray-900">{b.needMoreTitle}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2 leading-snug">
                {b.needMoreBody}
              </p>
              <a
                href="/contact"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#7B9FE0] text-white text-sm font-semibold shadow-sm hover:bg-[#6D93DB] transition"
              >
                {b.contactSupport}
                <Icon d={ICONS.arrowRight} className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </RoleShell>
  )
}
