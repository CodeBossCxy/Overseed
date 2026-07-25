'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import PaymentStatusBadge from '@/components/payments/PaymentStatus'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

const STAGES = ['AWAITING_CONFIRMATION', 'ACTIVE', 'SUBMITTED', 'COMPLETED'] as const
const STAGE_KEY: Record<string, string> = {
  AWAITING_CONFIRMATION: 'awaitingConfirmation',
  ACTIVE: 'active',
  SUBMITTED: 'submitted',
  COMPLETED: 'completed',
}

export default function CreatorManageCollaborationPage() {
  const params = useParams()
  const id = params.id as string
  const { t, locale } = useLanguage()
  const c = t.collab

  const [collab, setCollab] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Submission form
  const [publishedUrl, setPublishedUrl] = useState('')
  const [publishedPlatform, setPublishedPlatform] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [evidenceScreenshot, setEvidenceScreenshot] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/collaborations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setCollab(data.collaboration)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const doAction = async (action: string, extra?: Record<string, any>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/collaborations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || c.actionFailed)
      }
      await load()
    } catch (err: any) {
      setError(err.message || c.actionFailed)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <CreatorWorkspaceLayout>
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto" />
        </div>
      </CreatorWorkspaceLayout>
    )
  }
  if (!collab) {
    return (
      <CreatorWorkspaceLayout>
        <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500">Not found</div>
      </CreatorWorkspaceLayout>
    )
  }

  const brandName = collab.brand?.companyName || c.brand
  const currentStageIndex = STAGES.indexOf(collab.status)
  const isCancelled = collab.status === 'CANCELLED'

  const term = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-right">{value || '—'}</span>
    </div>
  )
  const field = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <CreatorWorkspaceLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard/influencer/applications" className="text-primary-600 hover:underline text-sm mb-2 inline-block">
          ← {c.tabApplications}
        </Link>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{c.manage}</h1>
            <p className="text-gray-600 mt-1">{collab.campaign?.title}</p>
          </div>
          <StatusBadge machine="collaboration" status={collab.status} size="lg" dot />
        </div>

        {/* Brand header */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {collab.brand?.logoUrl ? (
              <img src={collab.brand.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">{brandName.charAt(0)}</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{brandName}</p>
            <p className="text-sm text-gray-500 truncate">{collab.campaign?.title}</p>
          </div>
          <Link href="/dashboard/messages" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {c.message}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overview */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold mb-3">{c.overview}</h2>
              {term(c.deliverables, collab.deliverables)}
              {term(c.fee, collab.fee != null ? `${collab.currency} ${Number(collab.fee).toLocaleString()}` : null)}
              {term(c.compensation, collab.productCompensation)}
              {term(c.deadline, collab.deadline ? formatDate(collab.deadline, locale) : null)}
              {term(c.revisionRounds, `${collab.revisionsUsed} / ${collab.revisionRounds}`)}
              {term(c.usageRights, collab.usageRights)}
              <p className="text-xs text-gray-400 mt-3">{c.lockedTerms}</p>
            </section>

            {/* Timeline */}
            <section className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold mb-4">{c.timeline}</h2>
              <div className="flex items-center">
                {STAGES.map((stage, i) => {
                  const done = !isCancelled && i <= currentStageIndex
                  const isLast = i === STAGES.length - 1
                  return (
                    <div key={stage} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${done ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                          {done ? '✓' : i + 1}
                        </div>
                        <span className="text-[11px] text-gray-500 mt-1.5 text-center max-w-[72px]">
                          {(t.status.collaboration as any)[STAGE_KEY[stage]]}
                        </span>
                      </div>
                      {!isLast && <div className={`h-0.5 flex-1 mx-1 ${i < currentStageIndex && !isCancelled ? 'bg-primary-600' : 'bg-gray-200'}`} />}
                    </div>
                  )
                })}
              </div>
              {isCancelled && <p className="mt-4 text-sm text-red-600">{t.status.collaboration.cancelled}</p>}
            </section>
          </div>

          {/* Deliverables & Submission — creator actions */}
          <div className="space-y-6">
            <section className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold mb-3">{c.deliverablesSubmission}</h2>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              {collab.status === 'AWAITING_CONFIRMATION' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">{c.acceptHint}</p>
                  <button onClick={() => doAction('accept')} disabled={busy} className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
                    {c.acceptCollaboration}
                  </button>
                  <button onClick={() => { if (confirm(c.confirmDecline)) doAction('decline') }} disabled={busy} className="w-full px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition disabled:opacity-50">
                    {c.declineCollaboration}
                  </button>
                </div>
              )}

              {collab.status === 'ACTIVE' && (
                <div className="space-y-3">
                  {collab.reviewNote && (
                    <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                      <p className="font-medium mb-0.5">{c.revisionRequested}</p>
                      {collab.reviewNote}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{c.publishedUrl}</label>
                    <input value={publishedUrl} onChange={(e) => setPublishedUrl(e.target.value)} className={field} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{c.publishedPlatform}</label>
                    <input value={publishedPlatform} onChange={(e) => setPublishedPlatform(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{c.publishDate}</label>
                    <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{c.screenshotUrl}</label>
                    <input value={evidenceScreenshot} onChange={(e) => setEvidenceScreenshot(e.target.value)} className={field} placeholder="https://..." />
                  </div>
                  <button
                    onClick={() => doAction('submit', { publishedUrl, publishedPlatform, publishedAt: publishedAt || null, evidenceScreenshot })}
                    disabled={busy || !publishedUrl}
                    className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
                  >
                    {c.submitEvidence}
                  </button>
                </div>
              )}

              {collab.status === 'SUBMITTED' && (
                <div className="space-y-2">
                  <p className="text-sm text-emerald-700">{c.awaitingReview}</p>
                  {collab.publishedUrl && (
                    <a href={collab.publishedUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline break-all">
                      {collab.publishedUrl}
                    </a>
                  )}
                </div>
              )}

              {(collab.status === 'COMPLETED' || collab.status === 'CANCELLED') && (
                <StatusBadge machine="collaboration" status={collab.status} />
              )}
            </section>

            {collab.payment && (
              <section className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-lg font-semibold mb-3">Payment</h2>
                <PaymentStatusBadge
                  status={collab.payment.status}
                  amount={collab.payment.amount != null ? Number(collab.payment.amount) : undefined}
                  creatorPayout={collab.payment.creatorPayout != null ? Number(collab.payment.creatorPayout) : undefined}
                  paidAt={collab.payment.paidAt}
                  releasedAt={collab.payment.releasedAt}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </CreatorWorkspaceLayout>
  )
}
