'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function BetaBanner() {
  const [dismissed, setDismissed] = useState(false)
  const pathname = usePathname()
  const { t } = useLanguage()

  if (pathname === '/') return null
  if (dismissed) return null

  return (
    <div className="relative z-[60] bg-gradient-to-r from-amber-500 to-orange-500 text-white" style={{ isolation: 'isolate' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <span className="font-medium">
            {t.beta?.bannerMessage || "You're using the beta version of Overseed. We'd love your feedback!"}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/80 hover:text-white transition flex-shrink-0 ml-4"
          aria-label={t.common.dismiss}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
