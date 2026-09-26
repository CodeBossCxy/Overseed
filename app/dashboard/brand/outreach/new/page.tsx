'use client'

import { useState } from 'react'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
]

const STEPS = ['Brief & Criteria', 'Quantity', 'Preview', 'Done']

interface Criteria {
  niche: string
  country: string
  followerMin: string
  followerMax: string
  language: string
}

interface Recipient {
  id: string
  name: string
  handle: string
  avatarUrl: string | null
  platform: string
  followers: number
  engagementRate: number
  matchScore: number
  matchReason: string
}

interface SendResult {
  sent: number
  failed: number
  creditsUsed: number
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition
                  ${done ? 'bg-primary-600 text-white' : active ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-gray-100 text-gray-400'}`}
              >
                {done ? '✓' : idx}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-primary-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-12 mx-2 mb-4 rounded ${done ? 'bg-primary-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function MatchScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{score}</span>
}

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function NewOutreachPage() {
  const { locale } = useLanguage()
  const [step, setStep] = useState(1)

  // Step 1 fields
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [briefMessage, setBriefMessage] = useState('')
  const [criteria, setCriteria] = useState<Criteria>({
    niche: '',
    country: '',
    followerMin: '',
    followerMax: '',
    language: '',
  })

  // Step 2 fields
  const [quantity, setQuantity] = useState(10)

  // Result state
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 validation
  const step1Valid =
    title.trim().length > 0 && briefMessage.length >= 10 && briefMessage.length <= 2000

  const handleFindCreators = async () => {
    setLoading(true)
    setError(null)
    try {
      const criteriaPayload: Record<string, any> = {}
      if (criteria.niche.trim()) criteriaPayload.niche = criteria.niche.trim()
      if (criteria.country.trim()) criteriaPayload.country = criteria.country.trim()
      if (criteria.followerMin) criteriaPayload.followerMin = Number(criteria.followerMin)
      if (criteria.followerMax) criteriaPayload.followerMax = Number(criteria.followerMax)
      if (criteria.language.trim()) criteriaPayload.language = criteria.language.trim()

      const createRes = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          briefMessage,
          quantity,
          platform,
          criteria: Object.keys(criteriaPayload).length > 0 ? criteriaPayload : null,
        }),
      })
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}))
        throw new Error(d.message || 'Failed to create campaign')
      }
      const { campaign } = await createRes.json()
      setCampaignId(campaign.id)

      const selectRes = await fetch(`/api/outreach/${campaign.id}/select`, { method: 'POST' })
      if (!selectRes.ok) {
        const d = await selectRes.json().catch(() => ({}))
        throw new Error(d.message || 'Failed to select creators')
      }
      const { recipients: selected } = await selectRes.json()
      setRecipients(selected ?? [])
      setStep(3)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!campaignId) return
    setLoading(true)
    setError(null)
    try {
      const sendRes = await fetch(`/api/outreach/${campaignId}/send`, { method: 'POST' })
      if (!sendRes.ok) {
        const d = await sendRes.json().catch(() => ({}))
        throw new Error(d.message || 'Failed to send outreach')
      }
      const result = await sendRes.json()
      setSendResult({
        sent: result.sent ?? 0,
        failed: result.failed ?? 0,
        creditsUsed: result.creditsUsed ?? 0,
      })
      setStep(4)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-2xl mx-auto">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">New Outreach Campaign</h1>
          <p className="mt-1 text-sm text-gray-500">Find and message creators who fit your brand</p>
        </div>

        <StepIndicator current={step} />

        {/* Step 1: Brief & Criteria */}
        {step === 1 && (
          <div className="workspace-glass-card rounded-3xl p-7 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Brief &amp; Criteria</h2>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Campaign Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Summer Collection Launch"
                className="workspace-glass-control rounded-xl w-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Platform <span className="text-red-500">*</span></label>
              <div className="flex gap-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlatform(p.value)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition
                      ${platform === p.value
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Brief message */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Brief Message <span className="text-red-500">*</span>
                <span className="ml-2 text-gray-400 font-normal">({briefMessage.length}/2000)</span>
              </label>
              <textarea
                value={briefMessage}
                onChange={(e) => setBriefMessage(e.target.value)}
                rows={5}
                placeholder="Introduce your brand and describe the collaboration you're looking for. This message will be sent to creators..."
                className="workspace-glass-control rounded-xl w-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              {briefMessage.length > 0 && briefMessage.length < 10 && (
                <p className="text-xs text-red-500">Minimum 10 characters</p>
              )}
            </div>

            {/* Criteria */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Creator Criteria</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Niche / Category</label>
                  <input
                    type="text"
                    value={criteria.niche}
                    onChange={(e) => setCriteria((c) => ({ ...c, niche: e.target.value }))}
                    placeholder="e.g. fitness, beauty"
                    className="workspace-glass-control rounded-xl w-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Country</label>
                  <input
                    type="text"
                    value={criteria.country}
                    onChange={(e) => setCriteria((c) => ({ ...c, country: e.target.value }))}
                    placeholder="e.g. US, CN"
                    className="workspace-glass-control rounded-xl w-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Min Followers</label>
                  <input
                    type="number"
                    value={criteria.followerMin}
                    onChange={(e) => setCriteria((c) => ({ ...c, followerMin: e.target.value }))}
                    placeholder="e.g. 10000"
                    min={0}
                    className="workspace-glass-control rounded-xl w-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Max Followers</label>
                  <input
                    type="number"
                    value={criteria.followerMax}
                    onChange={(e) => setCriteria((c) => ({ ...c, followerMax: e.target.value }))}
                    placeholder="e.g. 500000"
                    min={0}
                    className="workspace-glass-control rounded-xl w-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium text-gray-600">Language (optional)</label>
                  <input
                    type="text"
                    value={criteria.language}
                    onChange={(e) => setCriteria((c) => ({ ...c, language: e.target.value }))}
                    placeholder="e.g. en, zh"
                    className="workspace-glass-control rounded-xl w-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Quantity */}
        {step === 2 && (
          <div className="workspace-glass-card rounded-3xl p-7 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">How many creators?</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Quantity</label>
                <span className="text-2xl font-bold text-primary-600">{quantity}</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>1</span>
                <span>100</span>
              </div>
            </div>

            <div className="workspace-glass-card rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Estimated Credit Cost</p>
                <p className="text-xs text-gray-400 mt-0.5">12 credits per outreach message</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-600">{quantity * 12}</p>
                <p className="text-xs text-gray-400">credits</p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep(1); setError(null) }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl px-6 py-3 font-semibold hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleFindCreators}
                className="flex-1 bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    AI is finding the best creators for you...
                  </>
                ) : (
                  'Find Creators'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="workspace-glass-card rounded-3xl p-7 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Selected Creators</h2>
              <span className="text-sm text-gray-500">{recipients.length} creators · {recipients.length * 12} credits</span>
            </div>

            {recipients.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-500">
                No creators were selected. Try adjusting your criteria.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recipients.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/60">
                    {r.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {(r.name || r.handle || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{r.name || r.handle}</span>
                        <span className="text-xs text-gray-400">{r.handle}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                        <span>{formatFollowers(r.followers)} followers</span>
                        {r.engagementRate > 0 && <span>{r.engagementRate.toFixed(1)}% eng.</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <MatchScoreBadge score={r.matchScore} />
                      {r.matchReason && (
                        <span className="text-xs text-gray-400 max-w-28 text-right truncate">{r.matchReason}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep(2); setError(null) }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl px-6 py-3 font-semibold hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading || recipients.length === 0}
                onClick={handleSend}
                className="flex-1 bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  `Send All (${recipients.length})`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && sendResult && (
          <div className="workspace-glass-card rounded-3xl p-10 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl">
              ✓
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Outreach Sent!</h2>
              <p className="text-sm text-gray-500 mt-1">Your messages have been delivered to creators.</p>
            </div>

            <div className="flex gap-6 py-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{sendResult.sent}</p>
                <p className="text-xs text-gray-500">Sent</p>
              </div>
              {sendResult.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{sendResult.failed}</p>
                  <p className="text-xs text-gray-500">Failed</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600">{sendResult.creditsUsed}</p>
                <p className="text-xs text-gray-500">Credits used</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs pt-2">
              <Link
                href="/dashboard/messages"
                className="bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition text-center"
              >
                View in Messages
              </Link>
              {campaignId && (
                <Link
                  href={`/dashboard/brand/outreach/${campaignId}`}
                  className="border border-gray-200 text-gray-700 rounded-xl px-6 py-3 font-semibold hover:bg-gray-50 transition text-center"
                >
                  View Campaign Details
                </Link>
              )}
              <Link
                href="/dashboard/brand/outreach/new"
                className="text-primary-600 text-sm font-medium hover:underline"
              >
                Create Another Campaign
              </Link>
            </div>
          </div>
        )}
      </div>
    </BrandWorkspaceLayout>
  )
}
