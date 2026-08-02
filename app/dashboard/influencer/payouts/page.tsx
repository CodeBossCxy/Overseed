'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

// "Earnings & Payments" per spec: summary cards (Pending Release /
// Available Soon / Paid to Date), a setup banner until Stripe is connected,
// Payments + History (filterable) tabs, a payment-details drawer with a
// release timeline, and a Stripe-backed Payout Settings tab.

// Secured in escrow, collaboration not finished yet
const PENDING_RELEASE = ['HELD']
// Release conditions met, money moving to the creator
const AVAILABLE_SOON = ['RELEASE_PENDING', 'RELEASED', 'PAYOUT_PROCESSING']
// Terminal states shown in History
const HISTORY_STATUSES = ['PAID', 'REFUNDED', 'DISPUTED', 'FAILED']

interface StripeInfo {
  connected: boolean
  unavailable?: boolean
  verified?: boolean
  detailsSubmitted?: boolean
  defaultCurrency?: string | null
  payoutMethod?: { kind: 'bank' | 'card'; last4: string | null; bankName: string | null } | null
}

function SettingRow({
  icon,
  tint,
  title,
  right,
}: {
  icon: string
  tint: string
  title: string
  right: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tint}`}>
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-900 flex-1">{title}</p>
      <div className="flex items-center gap-2 text-sm text-gray-700">{right}</div>
    </div>
  )
}

export default function CreatorPayoutsPage() {
  const { t, locale } = useLanguage()
  const p = t.payouts

  const [collabs, setCollabs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'payments' | 'history' | 'settings'>('payments')
  const [stripeInfo, setStripeInfo] = useState<StripeInfo | null>(null)
  const [stripeLoading, setStripeLoading] = useState(true)
  const [managing, setManaging] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [historyStatus, setHistoryStatus] = useState('')
  const [historyRange, setHistoryRange] = useState<'' | '30' | '90'>('')

  useEffect(() => {
    fetch('/api/collaborations?role=creator')
      .then((res) => (res.ok ? res.json() : { collaborations: [] }))
      .then((data) => setCollabs(data.collaborations || []))
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch('/api/stripe/connect')
      .then((res) => (res.ok ? res.json() : { connected: false }))
      .then(setStripeInfo)
      .catch(() => setStripeInfo({ connected: false }))
      .finally(() => setStripeLoading(false))
  }, [])

  const payout = (c: any) => Number(c.payment?.creatorPayout ?? c.payment?.amount ?? 0)
  const sumWhere = (statuses: string[]) =>
    collabs
      .filter((c) => c.payment && statuses.includes(c.payment.status))
      .reduce((sum, c) => sum + payout(c), 0)

  const money = (n: number) =>
    `$${n.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 2 })}`

  const activeList = collabs.filter((c) => !c.payment || !HISTORY_STATUSES.includes(c.payment.status))

  const historyList = useMemo(() => {
    let list = collabs.filter((c) => c.payment && HISTORY_STATUSES.includes(c.payment.status))
    if (historyStatus) list = list.filter((c) => c.payment.status === historyStatus)
    if (historyRange) {
      const cutoff = Date.now() - Number(historyRange) * 86400000
      list = list.filter((c) => {
        const when = c.payment.paidAt || c.updatedAt
        return when && new Date(when).getTime() >= cutoff
      })
    }
    return list
  }, [collabs, historyStatus, historyRange])

  const openStripe = async () => {
    setManaging(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) window.open(data.url, '_blank', 'noopener')
    } finally {
      setManaging(false)
    }
  }

  const methodLabel = () => {
    if (!stripeInfo?.payoutMethod) return p.notSet
    const m = stripeInfo.payoutMethod
    const prefix = m.kind === 'card' ? p.cardEnding : p.bankEnding
    return m.last4 ? `${prefix} ${m.last4}` : m.bankName || p.notSet
  }

  const expectedPayout = (payment: any) => {
    if (!payment) return p.afterApproval
    if (payment.status === 'PAID') return payment.paidAt ? formatDate(payment.paidAt, locale) : p.stepPaid
    if (['RELEASED', 'PAYOUT_PROCESSING'].includes(payment.status)) return p.afterRelease
    return p.afterApproval
  }

  const timelineSteps = (status: string | undefined) => {
    const reached = (stages: string[]) => !!status && stages.includes(status)
    return [
      { label: p.stepSecured, done: reached(['HELD', 'RELEASE_PENDING', 'RELEASED', 'PAYOUT_PROCESSING', 'PAID', 'DISPUTED']) },
      { label: p.stepApproved, done: reached(['RELEASE_PENDING', 'RELEASED', 'PAYOUT_PROCESSING', 'PAID']) },
      { label: p.stepReleased, done: reached(['RELEASED', 'PAYOUT_PROCESSING', 'PAID']) },
      { label: p.stepProcessing, done: reached(['PAID']) },
      { label: p.stepPaid, done: reached(['PAID']) },
    ]
  }

  const stats = [
    {
      label: p.pendingRelease,
      value: sumWhere(PENDING_RELEASE),
      hint: p.pendingReleaseHint,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      tint: 'bg-indigo-50 text-indigo-500',
    },
    {
      label: p.availableSoon,
      value: sumWhere(AVAILABLE_SOON),
      hint: p.availableSoonHint,
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      tint: 'bg-sky-50 text-sky-500',
    },
    {
      label: p.paidToDate,
      value: sumWhere(['PAID']),
      hint: p.paidToDateHint,
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      tint: 'bg-emerald-50 text-emerald-500',
    },
  ]

  const expectedShort = (payment: any) => {
    if (!payment) return '—'
    if (payment.status === 'PAID') return payment.paidAt ? formatDate(payment.paidAt, locale) : p.stepPaid
    if (['RELEASED', 'PAYOUT_PROCESSING'].includes(payment.status)) {
      if (payment.releasedAt) {
        const est = new Date(new Date(payment.releasedAt).getTime() + 5 * 86400000)
        return `${p.estPrefix} ${formatDate(est.toISOString(), locale)}`
      }
      return p.afterRelease
    }
    if (['HELD', 'RELEASE_PENDING'].includes(payment.status)) return p.afterApprovalShort
    return '—'
  }

  const thClass = 'py-2.5 px-3 text-left text-xs font-medium text-gray-400 first:pl-5'

  const campaignCell = (col: any) => (
    <div className="flex items-center gap-3 min-w-[180px]">
      <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
        {col.campaign?.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={col.campaign.images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm font-bold">
            {(col.campaign?.title || '?').charAt(0)}
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-900 truncate">{col.campaign?.title}</p>
    </div>
  )

  const brandCell = (col: any) => (
    <div className="flex items-center gap-2.5 min-w-[110px]">
      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 overflow-hidden flex items-center justify-center text-[10px] font-bold flex-shrink-0">
        {col.brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={col.brand.logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          (col.brand?.companyName || 'B').slice(0, 2).toUpperCase()
        )}
      </div>
      <span className="text-sm text-gray-700 truncate">{col.brand?.companyName || '—'}</span>
    </div>
  )

  const paymentsTable = (list: any[]) => (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className={thClass}>{p.thCampaign}</th>
            <th className={thClass}>{p.thBrand}</th>
            <th className={thClass}>{p.thStatus}</th>
            <th className={thClass}>{p.thAmount}</th>
            <th className={thClass}>{p.thExpected}</th>
            <th className={thClass}>{p.thAction}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {list.map((col) => (
            <tr key={col.id} className="hover:bg-white/70 transition">
              <td className="py-3 px-3 pl-5">{campaignCell(col)}</td>
              <td className="py-3 px-3">{brandCell(col)}</td>
              <td className="py-3 px-3">
                {col.payment ? (
                  <StatusBadge machine="payment" status={col.payment.status} size="sm" dot />
                ) : (
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-600 rounded-full text-xs font-medium whitespace-nowrap">
                    {p.awaitingBrandPayment}
                  </span>
                )}
              </td>
              <td className="py-3 px-3 text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                {col.payment ? money(payout(col)) : '—'}
              </td>
              <td className="py-3 px-3 text-sm text-gray-600 whitespace-nowrap">{expectedShort(col.payment)}</td>
              <td className="py-3 px-3 pr-5">
                <button
                  onClick={() => setDetail(col)}
                  className="px-3.5 py-1.5 bg-white shadow-sm rounded-lg text-xs font-semibold text-gray-700 hover:text-primary-700 transition whitespace-nowrap"
                >
                  {p.viewDetails}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const historyTable = (list: any[]) => (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className={thClass}>{p.thCampaign}</th>
            <th className={thClass}>{p.thBrand}</th>
            <th className={thClass}>{p.thStatus}</th>
            <th className={thClass}>{p.thDate}</th>
            <th className={thClass}>{p.thAmount}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {list.map((col) => (
            <tr
              key={col.id}
              onClick={() => setDetail(col)}
              className="hover:bg-white/70 transition cursor-pointer"
            >
              <td className="py-3 px-3 pl-5">{campaignCell(col)}</td>
              <td className="py-3 px-3">{brandCell(col)}</td>
              <td className="py-3 px-3">
                <StatusBadge machine="payment" status={col.payment.status} size="sm" dot />
              </td>
              <td className="py-3 px-3 text-sm text-gray-600 whitespace-nowrap">
                {formatDate(col.payment.paidAt || col.updatedAt, locale)}
              </td>
              <td className="py-3 px-3 pr-5 text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                {money(payout(col))}
              </td>
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
          <h1 className="text-3xl font-bold text-gray-900">{p.title}</h1>
          <p className="text-gray-500 mt-1">{p.subtitle}</p>
        </div>

        {/* Setup banner — hidden automatically once Stripe is connected */}
        {!stripeLoading && stripeInfo && !stripeInfo.connected && (
          <div className="mb-6 bg-white/85 backdrop-blur border border-primary-100 rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{p.setupTitle}</p>
              <p className="text-sm text-gray-500 mt-0.5">{p.setupDesc}</p>
            </div>
            <button
              onClick={openStripe}
              disabled={managing}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50 flex-shrink-0"
            >
              {p.setupCta}
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${s.tint}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums flex items-center gap-1.5">
                  {loading ? '—' : money(s.value)}
                  <span className="text-gray-300 cursor-help" title={s.hint}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200/80 flex gap-8">
          {[
            { key: 'payments' as const, label: p.tabPayments },
            { key: 'history' as const, label: p.tabHistory },
            { key: 'settings' as const, label: p.tabSettings },
          ].map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`pb-3 -mb-px text-sm border-b-2 transition ${
                tab === tb.key
                  ? 'border-gray-900 text-gray-900 font-bold'
                  : 'border-transparent text-gray-500 font-medium hover:text-gray-700'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* History filters */}
        {tab === 'history' && (
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <span className="text-sm text-gray-500">{p.filterStatus}</span>
            <select
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              className="px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">{p.filterAll}</option>
              <option value="PAID">{t.status.payment.paid}</option>
              <option value="REFUNDED">{t.status.payment.refunded}</option>
              <option value="DISPUTED">{t.status.payment.disputed}</option>
              <option value="FAILED">{t.status.payment.failed}</option>
            </select>
            <span className="text-sm text-gray-500 ml-2">{p.filterDate}</span>
            <select
              value={historyRange}
              onChange={(e) => setHistoryRange(e.target.value as any)}
              className="px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">{p.allTime}</option>
              <option value="30">{p.last30}</option>
              <option value="90">{p.last90}</option>
            </select>
            {(historyStatus || historyRange) && (
              <button
                onClick={() => { setHistoryStatus(''); setHistoryRange('') }}
                className="px-3.5 py-1.5 bg-white shadow-sm rounded-full text-sm font-medium text-primary-600 hover:bg-primary-50 transition"
              >
                {p.clearFilters}
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">
              {p.showingWord} {historyList.length} {p.resultsWord}
            </span>
          </div>
        )}

        {/* Tab content */}
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm mt-6">
          {tab === 'payments' &&
            (loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">{p.loading}</div>
            ) : activeList.length === 0 ? (
              <div className="p-10 text-center text-gray-500 text-sm">{p.noPayments}</div>
            ) : (
              paymentsTable(activeList)
            ))}

          {tab === 'history' &&
            (loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">{p.loading}</div>
            ) : historyList.length === 0 ? (
              <div className="p-10 text-center text-gray-500 text-sm">{p.noHistory}</div>
            ) : (
              historyTable(historyList)
            ))}

          {tab === 'settings' && (
            <div className="p-6 sm:p-8">
              {stripeLoading ? (
                <div className="p-6 text-center text-gray-400 text-sm">{p.loading}</div>
              ) : (
                <>
                  <SettingRow
                    icon="M20 12a8 8 0 11-16 0 8 8 0 0116 0zm-9.2-2.4c0-.7.7-1.1 1.7-1.1.9 0 1.9.3 2.7.8l.8-2a6.6 6.6 0 00-3.2-.8c-2.2 0-3.7 1.1-3.7 2.9 0 3.2 4.6 2.3 4.6 3.9 0 .6-.6 1-1.7 1-1 0-2.2-.4-3-1l-.9 2c.9.6 2.3 1 3.7 1 2.3 0 3.9-1.1 3.9-2.9 0-3.3-4.9-2.4-4.9-3.8z"
                    tint="bg-indigo-50 text-indigo-500"
                    title={p.stripeAccount}
                    right={
                      stripeInfo?.connected ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {p.connected}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold">
                          {p.notConnected}
                        </span>
                      )
                    }
                  />

                  {stripeInfo?.connected && !stripeInfo.unavailable && (
                    <>
                      <SettingRow
                        icon="M3 21h18M4 18h16M6 18V9m4 9V9m4 9V9m4 9V9M2 9l10-6 10 6H2z"
                        tint="bg-gray-100 text-gray-600"
                        title={p.payoutMethod}
                        right={
                          <button onClick={openStripe} className="flex items-center gap-1 hover:text-primary-700 transition">
                            {methodLabel()}
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        }
                      />
                      <SettingRow
                        icon="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18"
                        tint="bg-blue-50 text-blue-500"
                        title={p.defaultCurrency}
                        right={
                          <button onClick={openStripe} className="flex items-center gap-1 hover:text-primary-700 transition">
                            {stripeInfo.defaultCurrency || '—'}
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        }
                      />
                      <SettingRow
                        icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        tint="bg-emerald-50 text-emerald-500"
                        title={p.accountStatus}
                        right={
                          stripeInfo.verified ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {p.verified}
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold">
                              {p.pendingStatus}
                            </span>
                          )
                        }
                      />
                    </>
                  )}

                  {stripeInfo?.unavailable && (
                    <p className="py-4 text-sm text-gray-500">{p.settingsUnavailable}</p>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-6 mt-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 max-w-md">{p.stripeNote}</p>
                    </div>
                    <button
                      onClick={openStripe}
                      disabled={managing}
                      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50 flex-shrink-0"
                    >
                      {stripeInfo?.connected ? p.manageWithStripe : p.connectWithStripe}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {/* Stripe security note */}
        <div className="mt-4 flex items-center justify-between gap-3 px-2 text-xs text-gray-400">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {p.stripeFooter}
          </span>
          <span className="font-bold text-indigo-400 text-sm tracking-tight">stripe</span>
        </div>
      </div>

      {/* Payment details drawer */}
      {detail && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <aside data-solid className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900">{p.drawerTitle}</h2>
              <button onClick={() => setDetail(null)} className="p-1.5 text-gray-400 hover:text-gray-700 transition" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Campaign summary */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {detail.campaign?.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.campaign.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold">
                      {(detail.campaign?.title || '?').charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{detail.campaign?.title}</p>
                  <p className="text-xs text-gray-500 truncate">{detail.brand?.companyName}</p>
                </div>
              </div>

              {/* Dispute notice */}
              {detail.payment?.status === 'DISPUTED' && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                  <p className="text-sm font-bold text-red-600">⚠ {p.disputedTitle}</p>
                  <div className="flex gap-4 mt-2">
                    <Link
                      href={`/dashboard/influencer/collaborations/${detail.id}`}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      {p.viewDispute}
                    </Link>
                    <Link href="/contact" className="text-xs font-semibold text-red-600 hover:underline">
                      {p.contactSupport}
                    </Link>
                  </div>
                </div>
              )}

              {/* Facts */}
              <div className="bg-gray-50/80 rounded-2xl divide-y divide-gray-100">
                {[
                  { label: p.amount, value: detail.payment ? money(payout(detail)) : '—' },
                  {
                    label: p.paymentStatus,
                    value: detail.payment ? (
                      <StatusBadge machine="payment" status={detail.payment.status} size="sm" />
                    ) : (
                      <span className="text-amber-600 text-xs font-medium">{p.awaitingBrandPayment}</span>
                    ),
                  },
                  { label: p.releaseCondition, value: <span className="text-right text-xs text-gray-600 max-w-[200px]">{p.releaseConditionText}</span> },
                  { label: p.expectedPayout, value: expectedPayout(detail.payment) },
                  { label: p.payoutAccount, value: stripeInfo?.connected ? methodLabel() : p.notConnected },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-sm text-gray-500 flex-shrink-0">{row.label}</span>
                    <span className="text-sm font-medium text-gray-900 text-right">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-3">{p.timelineTitle}</p>
                <div className="space-y-0">
                  {timelineSteps(detail.payment?.status).map((step, i, arr) => (
                    <div key={step.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            step.done ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-gray-200'
                          }`}
                        >
                          {step.done && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`w-0.5 flex-1 min-h-[20px] ${step.done && arr[i + 1].done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <div className="pb-5">
                        <p className={`text-sm ${step.done ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{step.label}</p>
                        {!step.done && <p className="text-[11px] text-gray-300">{p.pendingWord}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={`/dashboard/influencer/collaborations/${detail.id}`}
                className="block text-center px-5 py-2.5 bg-indigo-50 text-primary-700 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition"
              >
                {t.collab.manage || 'View collaboration'} →
              </Link>
            </div>
          </aside>
        </div>
      )}
    </CreatorWorkspaceLayout>
  )
}
