'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatNumber, formatCompactNumber } from '@/lib/i18n/formatNumber'

export function LocaleNumber({ value, className }: { value: number; className?: string }) {
  const { locale } = useLanguage()
  return <span className={className}>{formatNumber(value, locale)}</span>
}

export function LocaleCompactNumber({ value, className }: { value: number; className?: string }) {
  const { locale } = useLanguage()
  return <span className={className}>{formatCompactNumber(value, locale)}</span>
}
