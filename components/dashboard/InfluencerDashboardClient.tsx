'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

// Creator dashboard per the July 2026 workspace mockup: welcome header with
// verified chip, 4-step onboarding banner (auto-hides when complete), stat
// cards, recommended campaigns, recent messages, and a This Week card.

interface Setup {
  profile: boolean
  social: boolean
  identity: boolean
  payouts: boolean
}

interface Stats {
  appsInReview: number
  activeCollabs: number
  tasksDue: number
  availableEarnings: number
  savedCampaigns: number
}

interface RecentMessage {
  conversationId: string
  name: string
  avatarUrl: string | null
  snippet: string
  at: string
  unread: boolean
}

interface Props {
  userName: string
  isVerified: boolean
  setup: Setup
  stats: Stats
  recommended: any[]
  recentMessages: RecentMessage[]
  upcomingTask: { collaborationId: string; campaignTitle: string; deadline: string } | null
}

export default function InfluencerDashboardClient({
  userName,
  isVerified,
  setup,
  stats,
  recommended,
  recentMessages,
  upcomingTask,
}: Props) {
  const { t, locale } = useLanguage()
  const d = t.influencer.dashboard
  const handle = `@${userName.replace(/\s+/g, '').toLowerCase()}`

  const steps = [
    { done: setup.profile, label: d.stepProfile },
    { done: setup.social, label: d.stepSocial },
    { done: setup.identity, label: d.stepIdentity },
    { done: setup.payouts, label: d.stepPayouts },
  ]
  const stepHrefs = ['/dashboard/influencer/profile', '/dashboard/influencer/accounts', '/dashboard/influencer/profile', '/dashboard/influencer/payouts']
  const doneCount = steps.filter((s) => s.done).length
  const setupDone = doneCount === steps.length

  const relTime = (iso: string) => {
    const diffMin = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
    const rtf = new Intl.RelativeTimeFormat(locale === 'zh' ? 'zh' : 'en', { numeric: 'always', style: 'narrow' })
    if (diffMin < 60) return rtf.format(-diffMin, 'minute')
    const h = Math.round(diffMin / 60)
    if (h < 24) return rtf.format(-h, 'hour')
    const days = Math.round(h / 24)
    if (days < 30) return rtf.format(-days, 'day')
    return formatDate(iso, locale)
  }

  const money = (n: number) =>
    `$${n.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 0 })}`

  const price = (c: any) => {
    if (c.paymentMin != null || c.paymentMax != null) {
      const v = c.paymentMax ?? c.paymentMin
      return `$${Number(v)}`
    }
    return t.influencer.saved.productOnly
  }

  const statCards = [
    {
      label: d.appsInReview,
      value: String(stats.appsInReview),
      caption: d.inReviewWord,
      dot: 'bg-blue-400',
      href: '/dashboard/influencer/applications',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      label: d.activeCollabs,
      value: String(stats.activeCollabs),
      caption: d.activeWord,
      dot: 'bg-emerald-400',
      href: '/dashboard/influencer/applications',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    },
    {
      label: d.tasksDue,
      value: String(stats.tasksDue),
      caption: d.dueWord,
      dot: 'bg-amber-400',
      href: '/dashboard/influencer/applications',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      label: d.availableEarnings,
      value: money(stats.availableEarnings),
      caption: `${d.savedCount}: ${stats.savedCampaigns}`,
      dot: '',
      href: '/dashboard/influencer/payouts',
      icon: 'M21 12a2 2 0 00-2-2H5a2 2 0 00-2 2m18 0v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6m18 0V9a2 2 0 00-2-2M3 12V9a2 2 0 012-2m0 0V5a2 2 0 012-2h10a2 2 0 012 2v2M7 7h10',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto pt-6 pb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-gray-900">
            {d.welcomeBack} {handle}
          </h1>
          {isVerified && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l2.4 2.4 3.3-.5.5 3.3L20.6 9.6 22 12l-1.4 2.4.6 3.3-3.3.5L15.4 21.6 12 20.2 8.6 21.6 6.1 18.2l-3.3-.5.6-3.3L2 12l1.4-2.4-.5-3.3 3.3.5L8.6 2.4 12 2zm-1.2 12.7l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" />
              </svg>
              {d.verifiedCreator}
            </span>
          )}
        </div>
        <p className="text-gray-500 mt-1">{d.subtitle}</p>
      </div>

      {/* Onboarding banner — hides once all 4 steps are done */}
      {!setupDone && (
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6 mb-6 flex flex-col lg:flex-row lg:items-center gap-8">
          <div className="lg:w-64 flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900">{d.setupTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {doneCount} {d.setupOf}
            </p>
            <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-400 to-indigo-400 transition-all"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <Link key={step.label} href={stepHrefs[i]} className="group">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                      step.done ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'
                    }`}
                  >
                    {step.done ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  {i < steps.length - 1 && <span className="hidden md:block flex-1 border-t border-dashed border-gray-200" />}
                </div>
                <p className="text-sm font-medium text-gray-800 mt-2 leading-snug group-hover:text-primary-700 transition">
                  {step.label}
                </p>
                <p className={`text-xs mt-1 ${step.done ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {step.done ? d.stepDone : d.stepNotStarted}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-5 flex gap-4 hover:bg-white transition"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-50 shadow-sm flex items-center justify-center flex-shrink-0 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">{card.value}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                {card.dot && <span className={`w-1.5 h-1.5 rounded-full ${card.dot}`} />}
                {card.caption}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recommended campaigns */}
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{d.recommended}</h3>
            <Link href="/browse" className="text-xs font-medium text-gray-500 hover:text-primary-700 transition">
              {d.viewAll}
            </Link>
          </div>
          {recommended.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{d.noRecommended}</p>
          ) : (
            <div className="space-y-4">
              {recommended.map((c) => {
                const isPaid = c.paymentMin != null || c.paymentMax != null
                return (
                  <Link key={c.id} href={`/campaign/${c.id}`} className="flex items-center gap-3 group">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                      {c.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold">
                          {c.title?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-700 transition">
                        {c.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 min-w-0">
                        {c.categories?.[0] && (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span className="truncate">
                              {t.categoryNames[c.categories[0].category?.name] || c.categories[0].category?.name}
                            </span>
                            <span className="flex-shrink-0 text-gray-300">·</span>
                          </>
                        )}
                        <span className="flex-shrink-0 whitespace-nowrap font-medium text-gray-500">
                          {isPaid ? `${price(c)} ${t.influencer.saved.flatFee}` : t.influencer.saved.productOnly}
                        </span>
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="flex-shrink-0 text-gray-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition"
                    >
                      →
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent messages */}
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{d.recentMessages}</h3>
            <Link href="/dashboard/messages" className="text-xs font-medium text-gray-500 hover:text-primary-700 transition">
              {d.viewAll}
            </Link>
          </div>
          {recentMessages.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{d.noMessages}</p>
          ) : (
            <div className="space-y-4">
              {recentMessages.map((m) => (
                <Link key={m.conversationId} href="/dashboard/messages" className="flex items-start gap-3 group">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      m.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-700 transition truncate">{m.name}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{m.snippet}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">{relTime(m.at)}</span>
                    {m.unread && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* This week */}
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{d.thisWeek}</h3>
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{d.upcomingTask}</p>
          {upcomingTask ? (
            <Link
              href={`/dashboard/influencer/collaborations/${upcomingTask.collaborationId}`}
              className="flex items-center gap-3 bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 hover:bg-amber-50 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-500 flex-shrink-0">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{d.submitDraft}</p>
                <p className="text-xs text-gray-500 truncate">{upcomingTask.campaignTitle}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-amber-600">{formatDate(upcomingTask.deadline, locale)}</p>
                <p className="text-[11px] text-amber-500">{d.dueWord}</p>
              </div>
            </Link>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">{d.nothingDue}</p>
          )}

          <div className="mt-auto pt-5">
            <div className="bg-indigo-50/60 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2z" />
                </svg>
                {d.quickTip}
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">{d.quickTipText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
