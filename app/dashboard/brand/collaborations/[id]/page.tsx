'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import PaymentStatusBadge from '@/components/payments/PaymentStatus'
import PaymentModal from '@/components/payments/PaymentModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

const STAGES = ['AWAITING_CONFIRMATION', 'ACTIVE', 'SUBMITTED', 'COMPLETED'] as const

export default function BrandManageCollaborationPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { t, locale } = useLanguage()
  const c = t.collab

  const [collab, setCollab] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revisionNote, setRevisionNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [paymentModal, setPaymentModal] = useState<{
    clientSecret: string
    amount: number
    platformFee: number
    creatorPayout: number
  } | null>(null)

  const fundCollaboration = async (collabData: any) => {
    setPayBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: collabData.applicationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create payment')
      const amount = Number(collabData.fee || 0)
      const platformFee = Math.round(amount * 10) / 100
      setPaymentModal({
        clientSecret: data.clientSecret,
        amount,
        platformFee,
        creatorPayout: amount - platformFee,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPayBusy(false)
    }
  }

  const releasePayment = async (collabData: any) => {
    setPayBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: collabData.applicationId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to release payment')
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPayBusy(false)
    }
  }

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
      setRevisionOpen(false)
      setRevisionNote('')
      await load()
    } catch (err: any) {
      setError(err.message || c.actionFailed)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <BrandWorkspaceLayout>
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto" />
        </div>
      </BrandWorkspaceLayout>
    )
  }

  if (!collab) {
    return (
      <BrandWorkspaceLayout>
        <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500">Not found</div>
      </BrandWorkspaceLayout>
    )
  }

  const creatorName = collab.influencer?.displayName || 'Creator'
  const currentStageIndex = STAGES.indexOf(collab.status)
  const isCancelled = collab.status === 'CANCELLED'
  const isTerminal = collab.status === 'COMPLETED' || isCancelled

  const term = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-right">{value || '—'}</span>
    </div>
  )

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-5xl mx-auto workspace-page-tight pb-8">
        <Link href={`/dashboard/brand/campaigns/${collab.campaign?.id}/applications`} className="text-primary-600 hover:underline text-sm mb-2 inline-block">
          ← {c.backToPipeline}
        </Link>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{c.manage}</h1>
            <p className="text-gray-600 mt-1">{c.manageSubtitle}</p>
          </div>
          <StatusBadge machine="collaboration" status={collab.status} size="lg" dot />
        </div>

        {/* Creator header */}
        <div className="workspace-glass-card rounded-2xl p-5 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {collab.influencer?.avatarUrl ? (
              <img src={collab.influencer.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">{creatorName.charAt(0)}</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{creatorName}</p>
            <p className="text-sm text-gray-500 truncate">{collab.campaign?.title}</p>
          </div>
          <Link
            href={`/dashboard/messages`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {c.message}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overview — locked terms */}
          <div className="lg:col-span-2 space-y-6">
            <section className="workspace-glass-card rounded-2xl p-5">
              <h2 className="text-lg font-semibold mb-3">{c.overview}</h2>
              {term(c.deliverables, collab.deliverables)}
              {term(c.fee, collab.fee != null ? `${collab.currency} ${Number(collab.fee).toLocaleString()}` : null)}
              {term(c.compensation, collab.productCompensation)}
              {term(c.deadline, collab.deadline ? formatDate(collab.deadline, locale) : null)}
              {term(c.revisionRounds, `${collab.revisionsUsed} / ${collab.revisionRounds}`)}
              {term(c.usageRights, collab.usageRights)}
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                {c.lockedTerms}
              </p>
            </section>

            {/* Timeline */}
            <section className="workspace-glass-card rounded-2xl p-5">
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
                          {(t.status.collaboration as any)[
                            stage === 'AWAITING_CONFIRMATION' ? 'awaitingConfirmation'
                              : stage === 'ACTIVE' ? 'active'
                              : stage === 'SUBMITTED' ? 'submitted' : 'completed'
                          ]}
                        </span>
                      </div>
                      {!isLast && <div className={`h-0.5 flex-1 mx-1 ${i < currentStageIndex && !isCancelled ? 'bg-primary-600' : 'bg-gray-200'}`} />}
                    </div>
                  )
                })}
              </div>
              {isCancelled && (
                <p className="mt-4 text-sm text-red-600">{t.status.collaboration.cancelled}</p>
              )}
              {collab.reviewNote && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-amber-800">{collab.reviewNote}</div>
              )}
            </section>

            {/* Published evidence */}
            {collab.status === 'SUBMITTED' || collab.status === 'COMPLETED' ? (
              <section className="workspace-glass-card rounded-2xl p-5">
                <h2 className="text-lg font-semibold mb-3">{c.publishedEvidence}</h2>
                {collab.publishedUrl ? (
                  <div className="space-y-2 text-sm">
                    {term(c.publishedUrl, <a href={collab.publishedUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline break-all">{collab.publishedUrl}</a>)}
                    {term('Platform', collab.publishedPlatform)}
                    {term(c.deadline, collab.publishedAt ? formatDate(collab.publishedAt, locale) : null)}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{c.notSubmittedYet}</p>
                )}
              </section>
            ) : null}
          </div>

          {/* Actions + payment */}
          <div className="space-y-6">
            <section className="workspace-glass-card rounded-2xl p-5">
              <h2 className="text-lg font-semibold mb-3">{c.actions}</h2>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <div className="space-y-2">
                {/* Fund: no payment yet (or a failed attempt) and not terminal */}
                {!isTerminal && (!collab.payment || ['PENDING', 'FAILED'].includes(collab.payment.status)) && collab.fee != null && (
                  <button
                    onClick={() => fundCollaboration(collab)}
                    disabled={payBusy}
                    className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {payBusy ? '…' : c.fundCollaboration}
                  </button>
                )}
                {/* Release: funds secured and work approved or awaiting release */}
                {collab.payment && ['HELD', 'RELEASE_PENDING'].includes(collab.payment.status) && collab.status === 'COMPLETED' && (
                  <button
                    onClick={() => releasePayment(collab)}
                    disabled={payBusy}
                    className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {payBusy ? '…' : c.releasePayment}
                  </button>
                )}
                {collab.status === 'SUBMITTED' && (
                  <>
                    <button onClick={() => doAction('approve')} disabled={busy} className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
                      {c.approve}
                    </button>
                    {!revisionOpen ? (
                      <button onClick={() => setRevisionOpen(true)} disabled={busy} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
                        {c.requestRevision}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={revisionNote}
                          onChange={(e) => setRevisionNote(e.target.value)}
                          rows={3}
                          placeholder={c.revisionNotePrompt}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => doAction('request_revision', { reviewNote: revisionNote })} disabled={busy} className="flex-1 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50">
                            {c.requestRevision}
                          </button>
                          <button onClick={() => { setRevisionOpen(false); setRevisionNote('') }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
                            {c.cancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {!isTerminal && (
                  <>
                    <button onClick={() => doAction('dispute')} disabled={busy} className="w-full px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition disabled:opacity-50">
                      {c.openDispute}
                    </button>
                    <button
                      onClick={() => { if (confirm(c.confirmCancel)) doAction('cancel') }}
                      disabled={busy}
                      className="w-full px-4 py-2.5 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      {c.cancelCollaboration}
                    </button>
                  </>
                )}
              </div>
            </section>

            {collab.payment && (
              <section className="workspace-glass-card rounded-2xl p-5">
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

      {paymentModal && (
        <PaymentModal
          clientSecret={paymentModal.clientSecret}
          amount={paymentModal.amount}
          platformFee={paymentModal.platformFee}
          creatorPayout={paymentModal.creatorPayout}
          onSuccess={() => {
            setPaymentModal(null)
            load()
          }}
          onCancel={() => setPaymentModal(null)}
        />
      )}
    </BrandWorkspaceLayout>
  )
}
