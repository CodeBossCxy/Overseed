'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { Payment, type Tone, type StatusMeta } from '@/lib/status'

interface PaymentStatusProps {
  status: string
  amount?: number
  creatorPayout?: number
  paidAt?: string | null
  releasedAt?: string | null
}

const TONE_BOX: Record<Tone, { color: string; bg: string }> = {
  gray: { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
  green: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  amber: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  red: { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  violet: { color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  blue: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
}

export default function PaymentStatusBadge({ status, amount, creatorPayout, paidAt, releasedAt }: PaymentStatusProps) {
  const { t } = useLanguage()

  const meta = (Payment.meta as Record<string, StatusMeta>)[status]
  const label = meta ? ((t.status as any)?.payment?.[meta.key] ?? status) : status
  const box = TONE_BOX[meta?.tone ?? 'amber']

  return (
    <div className={`rounded-lg border p-3 ${box.bg}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${box.color}`}>{label}</span>
        {amount ? <span className="text-sm font-bold">${amount.toFixed(2)}</span> : null}
      </div>
      {status === 'HELD' && creatorPayout ? (
        <p className="text-xs text-gray-500 mt-1">
          ${creatorPayout.toFixed(2)} will go to the creator upon release
        </p>
      ) : null}
      {status === 'RELEASED' && releasedAt ? (
        <p className="text-xs text-gray-500 mt-1">
          Released on {new Date(releasedAt).toLocaleDateString()}
        </p>
      ) : null}
      {status === 'PAID' && paidAt ? (
        <p className="text-xs text-gray-500 mt-1">
          Paid on {new Date(paidAt).toLocaleDateString()}
        </p>
      ) : null}
    </div>
  )
}
