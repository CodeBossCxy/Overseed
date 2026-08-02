'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

// Creator Manage Collaboration per spec 4.4.4 — four areas: Overview (locked
// terms + accept/decline), Deliverables & Submission (6-step progress, draft
// upload, revision resubmit, published evidence), Payment, and Brand (avatar,
// name, Message).

const PLATFORM_OPTIONS = ['Instagram', 'TikTok', 'YouTube', 'Other']

function SectionCard({ title, subtitle, right, children }: { title: string; subtitle: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

export default function CreatorManageCollaborationPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { t, locale } = useLanguage()
  const c = t.collab

  const [collab, setCollab] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const draftInputRef = useRef<HTMLInputElement>(null)
  const shotInputRef = useRef<HTMLInputElement>(null)
  const [uploadingDraft, setUploadingDraft] = useState(false)

  // Published-evidence form
  const [publishedUrl, setPublishedUrl] = useState('')
  const [publishedPlatform, setPublishedPlatform] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [screenshot, setScreenshot] = useState('')
  const [uploadingShot, setUploadingShot] = useState(false)

  const load = useCallback(async () => {
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

  useEffect(() => {
    load()
  }, [load])

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

  const uploadFile = async (file: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append('files', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    return res.ok && data.urls?.[0] ? data.urls[0] : null
  }

  const uploadDraft = async (file: File) => {
    setUploadingDraft(true)
    setError(null)
    try {
      const url = await uploadFile(file)
      if (!url) throw new Error(c.actionFailed)
      await doAction('upload_draft', { fileUrl: url, title: file.name })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingDraft(false)
    }
  }

  const uploadScreenshot = async (file: File) => {
    setUploadingShot(true)
    try {
      const url = await uploadFile(file)
      if (url) setScreenshot(url)
    } finally {
      setUploadingShot(false)
    }
  }

  const submitEvidence = () =>
    doAction('submit', {
      publishedUrl,
      publishedPlatform,
      publishedAt: publishDate || null,
      evidenceScreenshot: screenshot || null,
    })

  const message = async () => {
    if (!collab?.application?.id) return router.push('/dashboard/messages')
    try {
      await fetch('/api/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: collab.application.id }),
      })
    } catch {}
    router.push('/dashboard/messages')
  }

  if (loading || !collab) {
    return (
      <CreatorWorkspaceLayout>
        <div className="max-w-6xl mx-auto pt-16 text-center text-gray-400">{c.loading}</div>
      </CreatorWorkspaceLayout>
    )
  }

  const status: string = collab.status
  const pay = collab.payment
  const drafts = (collab.deliverableItems || []).filter((d: any) => d.type === 'draft')
  const paymentSecured = !!pay && ['HELD', 'RELEASE_PENDING', 'RELEASED', 'PAYOUT_PROCESSING', 'PAID'].includes(pay.status)

  const steps = [
    { label: c.stepAccepted, done: ['ACTIVE', 'SUBMITTED', 'COMPLETED'].includes(status) },
    { label: c.stepPaymentSecured, done: paymentSecured },
    { label: c.stepDraftSubmitted, done: drafts.length > 0 || ['SUBMITTED', 'COMPLETED'].includes(status) },
    { label: c.stepBrandReview, done: ['SUBMITTED', 'COMPLETED'].includes(status) },
    { label: c.stepEvidenceSubmitted, done: !!collab.publishedUrl || ['SUBMITTED', 'COMPLETED'].includes(status) },
    { label: c.stepCompleted, done: status === 'COMPLETED' },
  ]

  const paymentStates = [
    { key: 'required', label: t.status.payment.required, active: !!pay && ['PENDING', 'PROCESSING'].includes(pay.status) },
    { key: 'secured', label: t.status.payment.secured, active: !!pay && ['HELD', 'RELEASE_PENDING'].includes(pay.status) },
    { key: 'released', label: t.status.payment.released, active: !!pay && ['RELEASED', 'PAYOUT_PROCESSING', 'PAID'].includes(pay.status) },
    { key: 'refunded', label: t.status.payment.refunded, active: pay?.status === 'REFUNDED' },
    { key: 'na', label: 'N/A', active: !pay },
  ]

  const term = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || '—'}</span>
    </div>
  )

  return (
    <CreatorWorkspaceLayout>
      <div className="max-w-6xl mx-auto pt-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{c.manage}</h1>
          <p className="text-sm text-gray-500 mt-1">
            <Link href="/dashboard/influencer/applications" className="hover:text-primary-700">{c.pageTitle}</Link>
            {' › '}
            {collab.campaign?.title} · {collab.brand?.companyName}
          </p>
        </div>

        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── 1. Overview ── */}
          <SectionCard
            title={`1. ${c.overview}`}
            subtitle={c.overviewSubtitle}
            right={<StatusBadge machine="collaboration" status={status} size="sm" dot />}
          >
            {term(c.deliverables, collab.deliverables)}
            {term(c.compensation, [
              collab.fee != null ? `${collab.currency} ${Number(collab.fee).toLocaleString()}` : null,
              collab.productCompensation,
            ].filter(Boolean).join(' + ') || null)}
            {term(c.deadline, collab.deadline ? formatDate(collab.deadline, locale) : null)}
            {term(c.revisionRounds, `${collab.revisionsUsed} / ${collab.revisionRounds}`)}
            {term(c.usageRights, collab.usageRights)}

            <p className="text-xs text-gray-400 mt-4 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {c.lockedByBrand}
            </p>

            {status === 'AWAITING_CONFIRMATION' && (
              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  onClick={() => doAction('accept')}
                  disabled={busy}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {c.acceptCollaboration}
                </button>
                <button
                  onClick={() => { if (confirm(c.confirmDecline)) doAction('decline') }}
                  disabled={busy}
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {c.declineCollaboration}
                </button>
              </div>
            )}
          </SectionCard>

          {/* ── 2. Deliverables & Submission ── */}
          <SectionCard title={`2. ${c.deliverablesSubmission}`} subtitle={c.deliverablesSubtitle}>
            {/* Progress */}
            <div className="flex items-start mb-6 overflow-x-auto pb-1">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-start flex-1 min-w-[70px] last:flex-none">
                  <div className="flex flex-col items-center text-center w-[70px] flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.done ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-300'}`}>
                      {step.done ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-xs">{i + 1}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1.5 leading-tight">{step.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 mt-4 ${step.done && steps[i + 1].done ? 'bg-primary-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>

            {status === 'ACTIVE' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Creator actions: draft */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{c.creatorActions}</p>
                  <input ref={draftInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadDraft(e.target.files[0])} />
                  <button
                    onClick={() => draftInputRef.current?.click()}
                    disabled={uploadingDraft || busy}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:text-primary-700 transition disabled:opacity-50"
                  >
                    ⬆ {collab.reviewNote ? c.resubmitDraft : c.uploadDraft}
                  </button>
                  {collab.reviewNote && (
                    <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-xs font-bold text-amber-600">{c.revisionRequested}</p>
                      <p className="text-xs text-amber-700 mt-1">{collab.reviewNote}</p>
                    </div>
                  )}
                  {drafts.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] text-gray-400 mb-1">{c.draftsTitle}</p>
                      {drafts.map((dr: any) => (
                        <a key={dr.id} href={dr.fileUrl || '#'} target="_blank" rel="noreferrer" className="block text-xs text-primary-600 hover:underline truncate">
                          {dr.title} · {dr.submittedAt ? formatDate(dr.submittedAt, locale) : ''}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Published evidence */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{c.publishedEvidence}</p>
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={publishedUrl}
                      onChange={(e) => setPublishedUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                    <input ref={shotInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadScreenshot(e.target.files[0])} />
                    <button
                      onClick={() => shotInputRef.current?.click()}
                      disabled={uploadingShot}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-primary-700 transition disabled:opacity-50 text-left"
                    >
                      {screenshot ? `✓ ${c.screenshotUrl}` : `⬆ ${c.uploadScreenshot}`}
                    </button>
                    <input
                      type="date"
                      value={publishDate}
                      onChange={(e) => setPublishDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                    <select
                      value={publishedPlatform}
                      onChange={(e) => setPublishedPlatform(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    >
                      <option value="">{c.publishedPlatform}</option>
                      {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button
                      onClick={submitEvidence}
                      disabled={busy || !publishedUrl}
                      className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50"
                    >
                      {c.submitEvidence}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {status === 'SUBMITTED' && (
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">{c.awaitingReview}</div>
            )}
            {status === 'AWAITING_CONFIRMATION' && (
              <p className="text-sm text-gray-400">{c.acceptHint}</p>
            )}
            {(status === 'SUBMITTED' || status === 'COMPLETED') && collab.publishedUrl && (
              <div className="mt-4 text-sm">
                {term(c.publishedUrl, (
                  <a href={collab.publishedUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline break-all">{collab.publishedUrl}</a>
                ))}
                {collab.publishedPlatform && term(c.publishedPlatform, collab.publishedPlatform)}
                {collab.publishedAt && term(c.publishDate, formatDate(collab.publishedAt, locale))}
              </div>
            )}
          </SectionCard>

          {/* ── 3. Payment ── */}
          <SectionCard title={`3. ${c.paymentSection}`} subtitle={c.paymentSubtitle}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-0">
                {paymentStates.map((st, i) => (
                  <div key={st.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`w-4 h-4 rounded-full border-2 ${st.active ? 'border-gray-900 bg-gray-900' : 'border-gray-200 bg-white'}`} />
                      {i < paymentStates.length - 1 && <span className="w-0.5 flex-1 min-h-[16px] bg-gray-100" />}
                    </div>
                    <p className={`text-sm pb-4 ${st.active ? 'font-bold text-gray-900' : 'text-gray-400'}`}>{st.label}</p>
                  </div>
                ))}
              </div>
              <div>
                {term(c.amountLabel, pay
                  ? `$${Number(pay.creatorPayout ?? pay.amount).toLocaleString()}`
                  : collab.fee != null ? `${collab.currency} ${Number(collab.fee).toLocaleString()}` : null)}
                {pay?.paidAt && term(c.securedOn, formatDate(pay.paidAt, locale))}
                {pay?.releasedAt && term(c.releasedOn, formatDate(pay.releasedAt, locale))}
                {pay && (
                  <div className="mt-3">
                    <StatusBadge machine="payment" status={pay.status} size="sm" dot />
                  </div>
                )}
                {paymentSecured && (
                  <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">🔒 {c.fundsHeldNote}</p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── 4. Brand ── */}
          <SectionCard
            title={`4. ${c.brandSection}`}
            subtitle={c.brandSubtitle}
            right={
              <button
                onClick={message}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white shadow-sm rounded-xl text-sm font-semibold text-gray-700 hover:text-primary-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {c.message}
              </button>
            }
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 overflow-hidden flex items-center justify-center text-lg font-bold flex-shrink-0">
                {collab.brand?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={collab.brand.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (collab.brand?.companyName || 'B').slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{collab.brand?.companyName}</p>
                <p className="text-xs text-gray-500 truncate">{collab.campaign?.title}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </CreatorWorkspaceLayout>
  )
}
