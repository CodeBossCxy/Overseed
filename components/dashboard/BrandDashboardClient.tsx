'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import StatusBadge from '@/components/StatusBadge'
import { deriveVerificationStatus, VERIFICATION_META } from '@/lib/status'

interface Stats {
  liveCampaigns: number
  liveRecent: number
  applicationsToReview: number
  ongoingCollaborations: number
  draftCampaigns: number
}

interface Setup {
  profile: boolean
  verification: boolean
  payment: boolean
  firstCampaign: boolean
}

interface RecentMessage {
  conversationId: string
  name: string
  avatarUrl: string | null
  snippet: string
  at: string
  unread: boolean
}

interface BrandProfile {
  companyName: string | null
  logoUrl: string | null
  brandVerificationStatus?: string | null
  rejectionReason?: string | null
}

interface BrandDashboardClientProps {
  stats: Stats
  setup: Setup
  campaigns: any[]
  recentMessages: RecentMessage[]
  brandProfile: BrandProfile
  userName: string
  subscriptionTier: string
}

function Avatar({ src, name, className }: { src?: string | null; name: string; className: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${className} object-cover`} />
  ) : (
    <div className={`${className} bg-gray-900 text-white flex items-center justify-center font-semibold`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function BrandDashboardClient({
  stats,
  setup,
  campaigns,
  recentMessages,
  brandProfile,
  userName,
  subscriptionTier,
}: BrandDashboardClientProps) {
  const { t, locale } = useLanguage()
  const d = t.brand.dashboard

  const isApproved = brandProfile.brandVerificationStatus === 'APPROVED'
  const isPending = brandProfile.brandVerificationStatus === 'PENDING'
  const isRejected = brandProfile.brandVerificationStatus === 'REJECTED'

  const relTime = (iso: string) => {
    const diffMin = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
    const rtf = new Intl.RelativeTimeFormat(locale === 'zh' ? 'zh' : 'en', {
      numeric: 'always',
      style: 'narrow',
    })
    if (diffMin < 60) return rtf.format(-diffMin, 'minute')
    const h = Math.round(diffMin / 60)
    if (h < 24) return rtf.format(-h, 'hour')
    const days = Math.round(h / 24)
    if (days < 30) return rtf.format(-days, 'day')
    return formatDate(iso, locale)
  }

  // Business verification caption uses the canonical 4-state vocabulary
  // (Not Verified / Under Review / Action Required / Verified).
  const verifState = deriveVerificationStatus(brandProfile.brandVerificationStatus as any, true)
  const verifLabel = (t.status as any)?.verification?.[VERIFICATION_META[verifState].key] ?? verifState

  const steps = [
    { done: setup.profile, title: d.stepProfile, caption: setup.profile ? d.stepCompleted : d.stepNotStarted, href: '/dashboard/brand/profile' },
    { done: setup.verification, title: d.stepVerification, caption: verifLabel, href: '/dashboard/brand/profile' },
    { done: setup.payment, title: d.stepPayment, caption: setup.payment ? d.stepAdded : d.stepNotStarted, href: '/dashboard/brand/profile' },
    { done: setup.firstCampaign, title: d.stepFirstCampaign, caption: setup.firstCampaign ? d.stepCompleted : d.stepNotStarted, href: '/dashboard/brand/campaigns/new' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)
  const nextStep = steps.find((s) => !s.done)
  // Spec: the setup banner only shows while onboarding is incomplete
  const setupDone = doneCount === steps.length

  const statCards = [
    {
      label: d.statLiveCampaigns,
      value: stats.liveCampaigns,
      hint: stats.liveRecent > 0 ? `↑ ${stats.liveRecent} ${d.statFromLastMonth}` : d.viewAll,
      hintClass: stats.liveRecent > 0 ? 'text-emerald-600' : 'text-primary-600',
      href: '/dashboard/brand/campaigns',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    },
    {
      label: d.statApplicationsReview,
      value: stats.applicationsToReview,
      hint: `${d.statViewRespond} ›`,
      hintClass: 'text-primary-600',
      href: '/dashboard/brand/campaigns',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    },
    {
      label: d.statOngoingCollabs,
      value: stats.ongoingCollaborations,
      hint: `${d.statActivePartnerships} ›`,
      hintClass: 'text-primary-600',
      href: '/dashboard/brand/campaigns',
      icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      label: d.statDraftCampaigns,
      value: stats.draftCampaigns,
      hint: `${d.statContinueDrafting} ›`,
      hintClass: 'text-primary-600',
      href: '/dashboard/brand/campaigns',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto pt-6 pb-8">
      {/* Verification Status Banners (canonical vocabulary from lib/status) */}
      {isPending && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-semibold text-amber-800">{d.verifPendingTitle}</h3>
            <p className="text-sm text-amber-700 mt-0.5">{d.verifPendingDesc}</p>
          </div>
        </div>
      )}
      {isRejected && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h3 className="font-semibold text-red-800">{d.verifUnableTitle}</h3>
            {brandProfile.rejectionReason && (
              <p className="text-sm text-red-700 mt-0.5"><strong>{d.reasonLabel}</strong> {brandProfile.rejectionReason}</p>
            )}
            <p className="text-sm text-red-700 mt-1">{d.verifUnableDesc}</p>
            <div className="flex gap-4 mt-2">
              <Link href="/dashboard/brand/profile" className="text-sm font-semibold text-red-700 underline">
                {t.workspace.brandProfile}
              </Link>
              <Link href="/contact" className="text-sm font-semibold text-red-700 underline">
                {d.contactSupport}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {d.welcomeBack} {userName}!
          </h1>
          <p className="text-gray-500 mt-1">{d.title}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {brandProfile.companyName && (
              <span className="text-sm font-semibold text-gray-800">{brandProfile.companyName}</span>
            )}
            {isApproved ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600">
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 2.4 3.3-.5.5 3.3L20.6 9.6 22 12l-1.4 2.4.6 3.3-3.3.5L15.4 21.6 12 20.2 8.6 21.6 6.1 18.2l-3.3-.5.6-3.3L2 12l1.4-2.4-.5-3.3 3.3.5L8.6 2.4 12 2zm-1.2 12.7l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" />
                </svg>
                {d.verifiedBusiness}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                {d.unverifiedBusiness}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-4 py-2 rounded-full text-sm font-bold ${
              subscriptionTier === 'PRO'
                ? 'bg-indigo-100 text-indigo-900'
                : 'bg-white shadow-sm text-gray-600'
            }`}
          >
            {subscriptionTier === 'PRO' ? 'PRO' : d.plan.free}
          </span>
          {isApproved && (
            <Link
              href="/dashboard/brand/campaigns/new"
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-primary-700 transition inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {d.createCampaign}
            </Link>
          )}
        </div>
      </div>

      {/* Hero + setup (setup banner hides itself once onboarding is done) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div
          className={`${setupDone ? 'lg:col-span-3' : 'lg:col-span-2'} relative overflow-hidden rounded-3xl bg-[#091326] bg-cover bg-center text-white p-8 sm:p-10 flex flex-col justify-center min-h-[280px]`}
          style={{ backgroundImage: "url('/home/hero-earth.jpg')" }}
        >
          {/* Left-side scrim keeps the copy readable over the photo */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
          <p className="relative flex items-center gap-2 text-sm text-white/80 mb-3">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2z" />
            </svg>
            {d.heroKicker}
          </p>
          <h2 className="relative text-3xl sm:text-4xl font-bold leading-tight max-w-lg">{d.heroTitle}</h2>
          <p className="relative text-white/70 mt-3 max-w-md text-sm sm:text-base">{d.heroSubtitle}</p>
          {isApproved && (
            <Link
              href="/dashboard/brand/campaigns/new"
              className="relative mt-6 inline-flex items-center gap-2 self-start px-5 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/25 rounded-full text-sm font-semibold transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {d.createCampaign}
            </Link>
          )}
        </div>

        {!setupDone && (
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">{d.setupTitle}</h3>
              <p className="text-xs text-gray-500 mt-1">{d.setupSubtitle}</p>
            </div>
            <span className="px-3 py-1 bg-gray-50 rounded-full text-xs font-semibold text-gray-600 whitespace-nowrap shadow-sm">
              {pct}% {d.setupComplete}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-6 flex-1">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center text-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step.done ? 'bg-gray-200 text-gray-600' : 'bg-white border border-gray-200 text-gray-500 shadow-sm'
                  }`}
                >
                  {step.done ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <p className="text-[11px] font-medium text-gray-700 mt-2 leading-tight">{step.title}</p>
                <p className="text-[10px] text-gray-400 mt-1">{step.caption}</p>
              </div>
            ))}
          </div>

          <Link
            href={nextStep?.href || '/dashboard/brand/campaigns'}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-primary-700 transition"
          >
            {d.continueSetup}
            <span aria-hidden>→</span>
          </Link>
        </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href} className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-5 flex gap-4 hover:bg-white transition">
            <div className="w-11 h-11 rounded-full bg-gray-50 shadow-sm flex items-center justify-center flex-shrink-0 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">{card.value}</p>
              <p className={`text-xs font-medium mt-1 ${card.hintClass}`}>{card.hint}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Activity + right column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-gray-900">{d.activityTitle}</h3>
              <p className="text-xs text-gray-500 mt-1">{d.activitySubtitle}</p>
            </div>
            <Link
              href="/dashboard/brand/campaigns"
              className="px-4 py-2 bg-white shadow-sm rounded-full text-xs font-semibold text-gray-700 hover:text-primary-700 transition whitespace-nowrap"
            >
              {d.viewAllCampaigns}
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-gray-500 text-sm mb-4">{d.noCampaigns}</p>
              {isApproved && (
                <Link
                  href="/dashboard/brand/campaigns/new"
                  className="inline-block px-5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition text-sm font-medium"
                >
                  {d.createFirst}
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="py-2 pr-4 font-medium">{t.brand.campaigns.thCampaign}</th>
                    <th className="py-2 px-4 font-medium">{t.brand.campaigns.thStatus}</th>
                    <th className="py-2 px-4 font-medium">{t.brand.campaigns.thApplications}</th>
                    <th className="py-2 px-4 font-medium">{d.thCollaborators}</th>
                    <th className="py-2 px-4 font-medium">{d.thUpdated}</th>
                    <th className="py-2 pl-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {campaigns.map((c) => {
                    const collabs = c.collaborations || []
                    return (
                      <tr key={c.id} className="hover:bg-white/80 transition">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3 min-w-[220px]">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                              {c.images?.[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={c.images[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm font-bold">
                                  {c.title.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link href={`/dashboard/brand/campaigns/${c.id}/applications`} className="text-sm font-semibold text-gray-900 hover:text-primary-700 transition block truncate">
                                {c.title}
                              </Link>
                              <p className="text-xs text-gray-400 truncate">
                                {[
                                  c.categories?.[0] ? t.categoryNames[c.categories[0].category?.name] || c.categories[0].category?.name : null,
                                  (c.platforms || []).map((p: any) => p.platform.name).join(', ') || null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge machine="campaign" status={c.status} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700 tabular-nums">
                          {c._count?.applications || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {collabs.length === 0 ? (
                            <span className="text-sm text-gray-400">—</span>
                          ) : (
                            <div className="flex items-center">
                              {collabs.slice(0, 3).map((col: any, i: number) => (
                                <div key={col.id} className={`w-7 h-7 rounded-full ring-2 ring-white overflow-hidden ${i > 0 ? '-ml-2' : ''}`}>
                                  <Avatar
                                    src={col.influencer?.avatarUrl || col.influencer?.user?.image}
                                    name={col.influencer?.displayName || col.influencer?.user?.name || 'C'}
                                    className="w-full h-full text-[10px]"
                                  />
                                </div>
                              ))}
                              {collabs.length > 3 && (
                                <span className="ml-1.5 text-xs text-gray-500 font-medium">+{collabs.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">{relTime(c.updatedAt)}</td>
                        <td className="py-3 pl-4 text-right">
                          <Link href={`/dashboard/brand/campaigns/${c.id}/edit`} className="text-gray-400 hover:text-gray-700 transition" title={t.brand.campaigns.edit}>
                            ⋯
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{d.recentMessages}</h3>
              <Link href="/dashboard/messages" className="text-xs font-medium text-gray-500 hover:text-primary-700 transition">
                {d.viewAll}
              </Link>
            </div>
            {recentMessages.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{d.noMessages}</p>
            ) : (
              <div className="space-y-4">
                {recentMessages.map((m) => (
                  <Link key={m.conversationId} href="/dashboard/messages" className="flex items-start gap-3 group">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                      <Avatar src={m.avatarUrl} name={m.name} className="w-full h-full text-xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-700 transition">{m.name}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{m.snippet}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">{relTime(m.at)}</span>
                      {m.unread && <span className="w-2 h-2 rounded-full bg-gray-900" />}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/ai-assistant"
            className="block bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl shadow-sm p-5 hover:from-indigo-100 hover:to-purple-100 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-primary-600 flex-shrink-0">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  {t.workspace.aiAssistant}
                  <span className="ml-2 px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded text-[10px] font-bold align-middle">BETA</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{d.aiGreeting}</p>
              </div>
              <span className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 flex-shrink-0">→</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
