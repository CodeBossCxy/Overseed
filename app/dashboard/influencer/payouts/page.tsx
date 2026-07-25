'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

// Creator payouts overview: every collaboration that has (or will have) a
// payment attached, with its current payment state.
export default function CreatorPayoutsPage() {
  const { t, locale } = useLanguage()
  const w = t.workspace

  const [collabs, setCollabs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/collaborations?role=creator')
      .then((res) => (res.ok ? res.json() : { collaborations: [] }))
      .then((data) => setCollabs(data.collaborations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const withPayment = collabs.filter((c) => c.payment)
  const totalPaid = withPayment
    .filter((c) => ['RELEASED', 'PAID', 'COMPLETED'].includes(c.payment?.status))
    .reduce((sum, c) => sum + (Number(c.payment?.amount) || 0), 0)

  return (
    <CreatorWorkspaceLayout>
      <div className="max-w-5xl mx-auto pt-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{w.payouts}</h1>
          <p className="text-gray-500 mt-1">{w.payoutsSubtitle}</p>
        </div>

        {loading ? (
          <div className="bg-white/80 rounded-2xl shadow-sm p-10 text-center text-gray-500">…</div>
        ) : collabs.length === 0 ? (
          <div className="bg-white/80 rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">{w.payoutsEmpty}</p>
            <Link
              href="/browse"
              className="inline-block px-6 py-2.5 bg-primary-600 text-white rounded-full font-medium hover:bg-primary-700 transition"
            >
              {t.influencer.saved.browseCampaigns}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 bg-white/80 rounded-2xl shadow-sm px-5 py-4 flex items-center gap-8">
              <div>
                <p className="text-xs text-gray-500">{w.payoutsTotalReceived}</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">${totalPaid.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{w.payoutsCollaborations}</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{collabs.length}</p>
              </div>
            </div>

            <div className="bg-white/85 rounded-2xl shadow-sm divide-y divide-gray-100">
              {collabs.map((col) => (
                <Link
                  key={col.id}
                  href={`/dashboard/influencer/collaborations/${col.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-white transition first:rounded-t-2xl last:rounded-b-2xl"
                >
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
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{col.campaign?.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {col.brand?.companyName}
                      {col.updatedAt && <> · {formatDate(col.updatedAt, locale)}</>}
                    </p>
                  </div>
                  <StatusBadge machine="collaboration" status={col.status} size="sm" />
                  {col.payment ? (
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 tabular-nums">
                        ${Number(col.payment.amount).toFixed(2)}
                      </p>
                      <StatusBadge machine="payment" status={col.payment.status} size="sm" />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">{w.payoutsNoPayment}</span>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </CreatorWorkspaceLayout>
  )
}
