'use client'

// Credit usage history for the My Plan page: balance summary strip + paginated
// ledger from GET /api/credits/history. Hidden entirely on legacy (flag-off) builds.

import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDateTime } from '@/lib/i18n/formatDate'
import { formatNumber } from '@/lib/i18n/formatNumber'

interface LedgerEntry {
  id: string
  delta: number
  type: 'GRANT' | 'DEDUCTION' | 'REFUND' | 'EXPIRY' | 'ADMIN_ADJUSTMENT'
  bucket: string
  featureKey: string | null
  referenceId: string | null
  balanceAfter: number
  createdAt: string
}

interface Balance {
  subscription: number
  purchased: number
  total: number
  nextExpiry: { at: string; credits: number } | null
}

// featureKey -> t.myPlan label key
const FEATURE_LABEL_KEYS: Record<string, string> = {
  chat_standard: 'creditFeatureChatStandard',
  chat_advanced: 'creditFeatureChatAdvanced',
  image: 'creditFeatureImage',
  discovery_search: 'creditFeatureDiscoverySearch',
  profile_view: 'creditFeatureProfileOutreach',
  outreach: 'creditFeatureOutreach',
  analytics: 'creditFeatureAnalytics',
  translation: 'creditCostTranslation',
  doc_export: 'creditCostDocExport',
}

export default function CreditHistoryPanel() {
  const { t, locale } = useLanguage()
  const ch = t.creditHistory
  const myPlan = t.myPlan as unknown as Record<string, string>

  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [legacy, setLegacy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async (cursor?: string | null) => {
    const url = cursor
      ? `/api/credits/history?cursor=${encodeURIComponent(cursor)}`
      : '/api/credits/history'
    const res = await fetch(url)
    if (!res.ok) throw new Error('history fetch failed')
    return res.json() as Promise<{
      entries: LedgerEntry[]
      nextCursor: string | null
      legacy?: boolean
    }>
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const [history, balRes] = await Promise.all([load(), fetch('/api/credits/balance')])
        if (cancelled) return
        if (history.legacy) {
          setLegacy(true)
          return
        }
        setEntries(history.entries)
        setNextCursor(history.nextCursor)
        if (balRes.ok) setBalance(await balRes.json())
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [load])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const history = await load(nextCursor)
      setEntries((prev) => [...prev, ...history.entries])
      setNextCursor(history.nextCursor)
    } catch {
      setError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const featureLabel = (e: LedgerEntry): string | null => {
    const labelKey = e.featureKey ? FEATURE_LABEL_KEYS[e.featureKey] : undefined
    return (labelKey && myPlan[labelKey]) || null
  }

  const describe = (e: LedgerEntry): string => {
    // Refunds keep the feature context: "Refund · Discovery Search"
    if (e.type === 'REFUND') {
      const feature = featureLabel(e)
      return feature ? `${ch.typeRefund} · ${feature}` : ch.typeRefund
    }
    if (e.type === 'EXPIRY') return ch.typeExpire
    if (e.type === 'DEDUCTION') {
      return featureLabel(e) || ch.typeDeduct
    }
    // GRANT — classify by reference
    const ref = e.referenceId || ''
    if (ref.includes('migration-bonus')) return ch.typeGrantBonus
    if (ref.startsWith('checkout:')) return ch.typeGrantPurchase
    if (ref.startsWith('monthly:') || ref.startsWith('invoice:')) return ch.typeGrantMonthly
    return ch.typeGrantManual
  }

  if (legacy || (!loading && !error && entries.length === 0 && !balance)) return null

  return (
    <div className="workspace-glass-card rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{ch.title}</p>
          <p className="text-sm text-gray-400">{ch.subtitle}</p>
        </div>
      </div>

      {balance && (
        <div className="flex flex-wrap gap-2 mt-3 mb-4">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
            {ch.summarySubscription}: {formatNumber(balance.subscription, locale)}
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-50 text-sm font-semibold text-amber-700">
            {ch.summaryPurchased}: {formatNumber(balance.purchased, locale)}
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100 text-sm font-bold text-gray-700">
            {ch.summaryTotal}: {formatNumber(balance.total, locale)}
          </span>
          {balance.nextExpiry && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-rose-50 text-sm text-rose-600">
              {(myPlan.creditsExpireNote || '{n} credits expire on {date}')
                .replace('{n}', formatNumber(balance.nextExpiry.credits, locale))
                .replace('{date}', formatDateTime(balance.nextExpiry.at, locale))}
            </span>
          )}
        </div>
      )}

      {error ? (
        <p className="text-sm text-rose-500 mt-3">{ch.loadError}</p>
      ) : loading ? (
        <div className="space-y-2 mt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 mt-3">{ch.empty}</p>
      ) : (
        <>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="py-2 pr-4 font-medium">{ch.colDate}</th>
                  <th className="py-2 pr-4 font-medium">{ch.colDescription}</th>
                  <th className="py-2 pr-4 font-medium text-right">{ch.colChange}</th>
                  <th className="py-2 font-medium text-right">{ch.colBalance}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100">
                    <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                      {formatDateTime(e.createdAt, locale)}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700">{describe(e)}</td>
                    <td
                      className={`py-2.5 pr-4 text-right font-semibold whitespace-nowrap ${
                        e.delta >= 0 ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {e.delta >= 0 ? '+' : ''}
                      {formatNumber(e.delta, locale)}
                    </td>
                    <td className="py-2.5 text-right text-gray-500 whitespace-nowrap">
                      {formatNumber(e.balanceAfter, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition disabled:opacity-50"
            >
              {ch.loadMore}
            </button>
          )}
        </>
      )}
    </div>
  )
}
