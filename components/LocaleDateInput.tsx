'use client'

import { useRef } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface LocaleDateInputProps {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  required?: boolean
  className?: string
  placeholder?: string
}

export default function LocaleDateInput({
  value,
  onChange,
  required,
  className = '',
  placeholder,
}: LocaleDateInputProps) {
  const { locale } = useLanguage()
  const hiddenRef = useRef<HTMLInputElement>(null)

  const formatDate = (isoDate: string) => {
    if (!isoDate) return ''
    const [y, m, d] = isoDate.split('-')
    if (locale === 'zh') {
      return `${y}/${m}/${d}`
    }
    return `${m}/${d}/${y}`
  }

  const defaultPlaceholder = locale === 'zh' ? 'yyyy/mm/dd' : 'mm/dd/yyyy'

  return (
    <div className="relative">
      {/* Hidden native date picker */}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="absolute inset-0 opacity-0 cursor-pointer z-10"
        tabIndex={-1}
        // This invisible input covers the whole field and swallows every click,
        // so the calendar must be opened from here — not from the div below.
        onClick={() => {
          try {
            hiddenRef.current?.showPicker?.()
          } catch {
            // Older browsers without showPicker fall back to native behavior
          }
        }}
      />
      {/* Visible formatted display */}
      <div
        onClick={() => hiddenRef.current?.showPicker?.()}
        className={`flex items-center justify-between cursor-pointer ${className}`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? formatDate(value) : (placeholder || defaultPlaceholder)}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  )
}
