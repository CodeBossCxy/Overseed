'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const CURRENCIES = ['USD', 'CNY', 'EUR', 'GBP', 'HKD', 'JPY', 'CAD', 'AUD', 'SGD']

interface Props {
  applicationId: string
  creatorName: string
  campaignTitle: string
  defaultCurrency?: string
  onCreated: () => void
  onClose: () => void
}

export default function ConfirmCollaborationModal({
  applicationId,
  creatorName,
  campaignTitle,
  defaultCurrency = 'USD',
  onCreated,
  onClose,
}: Props) {
  const { t } = useLanguage()
  const c = t.collab

  const [fee, setFee] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [productCompensation, setProductCompensation] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [deadline, setDeadline] = useState('')
  const [revisionRounds, setRevisionRounds] = useState('2')
  const [usageRights, setUsageRights] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/collaborations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          fee: fee ? Number(fee) : null,
          currency,
          productCompensation: productCompensation || null,
          deliverables: deliverables || null,
          deadline: deadline || null,
          revisionRounds: Number(revisionRounds) || 0,
          usageRights: usageRights || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || c.actionFailed)
      }
      onCreated()
    } catch (err: any) {
      setError(err.message || c.actionFailed)
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        data-solid className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold">{c.confirmTitle}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{c.confirmSubtitle}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">{c.creator}</span>
              <p className="font-medium">{creatorName}</p>
            </div>
            <div>
              <span className="text-gray-500">{c.campaign}</span>
              <p className="font-medium truncate">{campaignTitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{c.fee}</label>
              <input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} className={fieldClass} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{c.currency}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldClass}>
                {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{c.compensation}</label>
            <input value={productCompensation} onChange={(e) => setProductCompensation(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{c.deliverables}</label>
            <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} rows={2} className={fieldClass} placeholder={c.deliverablesPlaceholder} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{c.deadline}</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{c.revisionRounds}</label>
              <select value={revisionRounds} onChange={(e) => setRevisionRounds(e.target.value)} className={fieldClass}>
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{c.usageRights}</label>
            <input value={usageRights} onChange={(e) => setUsageRights(e.target.value)} className={fieldClass} placeholder={c.usageRightsPlaceholder} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            {c.cancel}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
          >
            {saving ? c.sending : c.sendInvite}
          </button>
        </div>
      </div>
    </div>
  )
}
