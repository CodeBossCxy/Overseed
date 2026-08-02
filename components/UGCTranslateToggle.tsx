'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

interface UGCTranslateToggleProps {
  isLoading?: boolean
}

export default function UGCTranslateToggle({ isLoading }: UGCTranslateToggleProps) {
  const { isUGCTranslated, setIsUGCTranslated, locale, t } = useLanguage()

  const langName = locale === 'zh' ? '中文' : 'English'

  return (
    <button
      onClick={() => setIsUGCTranslated(!isUGCTranslated)}
      disabled={isLoading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition border ${
        isUGCTranslated
          ? 'bg-white text-gray-900 font-bold border-gray-200 shadow-sm hover:bg-gray-50'
          : 'bg-gray-50 text-gray-600 font-medium border-gray-200 hover:bg-gray-100'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      )}
      {isLoading
        ? (t.ugcToggle?.translating || 'Translating...')
        : isUGCTranslated
          ? (t.ugcToggle?.showOriginal || 'Show Original')
          : (t.ugcToggle?.translateTo?.replace('{language}', langName) || `Translate to ${langName}`)
      }
    </button>
  )
}
