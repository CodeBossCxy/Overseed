'use client'

import { useState, useEffect } from 'react'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

// My Applications & Collaborations per spec 4.4: three tabs — Applications
// (Applied/Selected/Not Selected/Withdrawn), Active (Awaiting Confirmation /
// Active / Submitted with next steps), Completed (Completed/Cancelled, no
// actions column).

type Tab = 'applications' | 'active' | 'completed'
const ACTIVE_STATUSES = ['AWAITING_CONFIRMATION', 'ACTIVE', 'SUBMITTED']

function Thumb({ src, fallback }: { src?: string | null; fallback: string }) {
  return (
    <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold">{fallback.charAt(0)}</div>
      )}
    </div>
  )
}

function BrandCell({ brand }: { brand: any }) {
  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 overflow-hidden flex items-center justify-center text-[10px] font-bold flex-shrink-0">
        {brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          (brand?.companyName || 'B').slice(0, 2).toUpperCase()
        )}
      </div>
      <span className="text-sm text-gray-700 truncate">{brand?.companyName || '—'}</span>
    </div>
  )
}

export default function InfluencerApplicationsPage() {
  const { t, locale } = useLanguage()
  const c = t.collab
  const [tab, setTab] = useState<Tab>('applications')
  const [applications, setApplications] = useState<any[]>([])
  const [collaborations, setCollaborations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/applications').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/collaborations?role=creator').then((r) => (r.ok ? r.json() : { collaborations: [] })),
    ])
      .then(([apps, cols]) => {
        setApplications(apps || [])
        setCollaborations(cols.collaborations || [])
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const collabByApp: Record<string, any> = {}
  collaborations.forEach((col) => {
    collabByApp[col.applicationId] = col
  })

  const withdraw = async (applicationId: string) => {
    if (!confirm(t.confirmDialogs.withdrawApplication)) return
    setBusyId(applicationId)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, { method: 'DELETE' })
      if (res.ok) {
        setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status: 'WITHDRAWN' } : a)))
      }
    } finally {
      setBusyId(null)
    }
  }

  const compensationText = (app: any) => {
    if (app.proposedRate != null) return `$${Number(app.proposedRate)}`
    const cp = app.campaign
    if (!cp) return '—'
    if (cp.compensationType === 'GIFTED') return c.productWord
    const amount = cp.paymentMax ?? cp.paymentMin
    if (cp.compensationType === 'PAID_PLUS_GIFT') return `${c.productWord} + $${Number(amount || 0)}`
    if (amount != null) return `$${Number(amount)}`
    return '—'
  }

  const activeCollabs = collaborations.filter((col) => ACTIVE_STATUSES.includes(col.status))
  const completedCollabs = collaborations.filter((col) => !ACTIVE_STATUSES.includes(col.status))

  const nextStep = (col: any) => {
    if (col.status === 'AWAITING_CONFIRMATION') return c.nextAccept
    if (col.status === 'ACTIVE') return c.nextSubmitDraft
    if (col.status === 'SUBMITTED') return c.nextBrandReview
    if (col.status === 'CANCELLED') return c.nextClosed
    if (col.payment && ['RELEASED', 'PAYOUT_PROCESSING', 'PAID'].includes(col.payment.status)) return c.nextPaymentReleased
    return c.nextCompleted
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'applications', label: c.tabApplications, count: applications.length },
    { key: 'active', label: c.tabActive, count: activeCollabs.length },
    { key: 'completed', label: c.tabCompleted, count: completedCollabs.length },
  ]

  const thClass = 'py-2.5 px-3 text-left text-xs font-medium text-gray-400 first:pl-0'

  const collabTable = (list: any[], showAction: boolean, emptyText: string) =>
    list.length === 0 ? (
      <p className="py-10 text-center text-sm text-gray-500">{emptyText}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className={thClass}>{c.thCampaign}</th>
              <th className={thClass}>{c.thBrand}</th>
              <th className={thClass}>{c.thStatus}</th>
              <th className={thClass}>{c.thNextStep}</th>
              <th className={thClass}>{c.thDeadline}</th>
              <th className={thClass}>{c.thPayment}</th>
              {showAction && <th className={thClass}>{c.thAction}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {list.map((col) => (
              <tr key={col.id} className="hover:bg-white/70 transition">
                <td className="py-3 px-3 pl-0">
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <Thumb src={col.campaign?.images?.[0]} fallback={col.campaign?.title || '?'} />
                    <p className="text-sm font-semibold text-gray-900 truncate">{col.campaign?.title}</p>
                  </div>
                </td>
                <td className="py-3 px-3"><BrandCell brand={col.brand} /></td>
                <td className="py-3 px-3"><StatusBadge machine="collaboration" status={col.status} size="sm" dot /></td>
                <td className="py-3 px-3 text-sm text-gray-600 whitespace-nowrap">{nextStep(col)}</td>
                <td className="py-3 px-3 text-sm text-gray-600 whitespace-nowrap">
                  {col.deadline ? formatDate(col.deadline, locale) : '—'}
                </td>
                <td className="py-3 px-3">
                  {col.payment ? (
                    <StatusBadge machine="payment" status={col.payment.status} size="sm" dot />
                  ) : (
                    <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">N/A</span>
                  )}
                </td>
                {showAction && (
                  <td className="py-3 px-3">
                    <Link
                      href={`/dashboard/influencer/collaborations/${col.id}`}
                      className="inline-flex px-4 py-1.5 border border-primary-200 text-primary-700 rounded-full text-xs font-semibold hover:bg-primary-50 transition whitespace-nowrap"
                    >
                      {c.manageBtn}
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <CreatorWorkspaceLayout>
      <div className="max-w-6xl mx-auto pt-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{c.pageTitle}</h1>
          <p className="text-gray-500 mt-1">{c.pageSubtitle}</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex bg-white/70 backdrop-blur rounded-2xl shadow-sm p-1.5 mb-6">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition ${
                tab === tb.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tb.label}
              {tb.count != null && tb.count > 0 && <span className="ml-1.5 text-xs text-gray-400">{tb.count}</span>}
            </button>
          ))}
        </div>

        {/* Info banner (Applications tab) */}
        {tab === 'applications' && (
          <div className="mb-6 bg-white/70 backdrop-blur rounded-2xl shadow-sm px-5 py-3.5 flex items-center gap-3 text-sm text-gray-600">
            <svg className="w-5 h-5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {c.autoCollabNote}
          </div>
        )}

        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-400">{c.loading}</p>
          ) : tab === 'applications' ? (
            applications.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-500 mb-4">{t.influencer.applications.noApplications}</p>
                <Link href="/browse" className="inline-block px-5 py-2.5 bg-primary-600 text-white rounded-full text-sm font-semibold hover:bg-primary-700 transition">
                  {t.influencer.saved.browseCampaigns}
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className={thClass}>{c.thCampaign}</th>
                      <th className={thClass}>{c.thBrand}</th>
                      <th className={thClass}>{c.thStatus}</th>
                      <th className={thClass}>{c.thAppliedOn}</th>
                      <th className={thClass}>{c.thCompensation}</th>
                      <th className={thClass}>{c.thAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {applications.map((app) => {
                      const col = collabByApp[app.id]
                      const status =
                        col && app.status !== 'COMPLETED' && !['REJECTED', 'WITHDRAWN'].includes(app.status)
                          ? 'APPROVED'
                          : app.status
                      return (
                        <tr key={app.id} className="hover:bg-white/70 transition">
                          <td className="py-3 px-3 pl-0">
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <Thumb src={app.campaign?.images?.[0]} fallback={app.campaign?.title || '?'} />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{app.campaign?.title}</p>
                                {app.campaign?.categories?.[0] && (
                                  <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-medium">
                                    {t.categoryNames[app.campaign.categories[0].category?.name] || app.campaign.categories[0].category?.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3"><BrandCell brand={app.campaign?.brand} /></td>
                          <td className="py-3 px-3"><StatusBadge machine="application" status={status} size="sm" dot /></td>
                          <td className="py-3 px-3 text-sm text-gray-600 whitespace-nowrap">
                            {app.appliedAt ? formatDate(app.appliedAt, locale) : '—'}
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">{compensationText(app)}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              {col ? (
                                <Link
                                  href={`/dashboard/influencer/collaborations/${col.id}`}
                                  className="px-4 py-1.5 border border-primary-200 text-primary-700 rounded-full text-xs font-semibold hover:bg-primary-50 transition whitespace-nowrap"
                                >
                                  {c.reviewCollab}
                                </Link>
                              ) : (
                                <>
                                  <Link
                                    href={`/campaign/${app.campaign?.id}`}
                                    className="px-4 py-1.5 border border-gray-200 text-gray-600 rounded-full text-xs font-semibold hover:bg-gray-50 transition whitespace-nowrap"
                                  >
                                    {c.viewBtn}
                                  </Link>
                                  {['PENDING', 'UNDER_REVIEW'].includes(app.status) && (
                                    <button
                                      onClick={() => withdraw(app.id)}
                                      disabled={busyId === app.id}
                                      className="px-4 py-1.5 border border-gray-200 text-gray-500 rounded-full text-xs font-semibold hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50 whitespace-nowrap"
                                    >
                                      {c.withdrawBtn}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : tab === 'active' ? (
            collabTable(activeCollabs, true, c.noItemsActive)
          ) : (
            collabTable(completedCollabs, false, c.noItemsCompleted)
          )}
        </div>
      </div>
    </CreatorWorkspaceLayout>
  )
}
