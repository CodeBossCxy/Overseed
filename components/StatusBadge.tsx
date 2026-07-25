'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { Campaign, Application, Collaboration, Payment, VERIFICATION_META, type Tone, type StatusMeta } from '@/lib/status'

const TONE_CLASSES: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  violet: 'bg-violet-100 text-violet-800',
  blue: 'bg-blue-100 text-blue-800',
}

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
}

export type StatusMachine = 'campaign' | 'application' | 'collaboration' | 'payment' | 'verification'

function metaFor(machine: StatusMachine, status: string): StatusMeta | undefined {
  const table: Record<string, StatusMeta> =
    machine === 'campaign' ? (Campaign.meta as Record<string, StatusMeta>)
      : machine === 'application' ? (Application.meta as Record<string, StatusMeta>)
      : machine === 'collaboration' ? (Collaboration.meta as Record<string, StatusMeta>)
      : machine === 'payment' ? (Payment.meta as Record<string, StatusMeta>)
      : (VERIFICATION_META as Record<string, StatusMeta>)
  return table[status]
}

export default function StatusBadge({
  machine,
  status,
  size = 'md',
  dot = false,
}: {
  machine: StatusMachine
  status: string
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
}) {
  const { t } = useLanguage()
  const meta = metaFor(machine, status)

  if (!meta) {
    return (
      <span className={`inline-flex items-center rounded-full font-medium bg-gray-100 text-gray-700 ${SIZE_CLASSES[size]}`}>
        {status}
      </span>
    )
  }

  const label = (t.status as any)?.[machine]?.[meta.key] ?? status

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${TONE_CLASSES[meta.tone]} ${SIZE_CLASSES[size]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {label}
    </span>
  )
}
