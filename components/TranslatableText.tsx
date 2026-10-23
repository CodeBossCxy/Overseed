'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

/**
 * Reddit-style inline translation component for user-generated content.
 *
 * When autoTranslateUGC is ON and the text appears to be in a different language,
 * it auto-translates and shows "Translated from {lang} · Show Original".
 *
 * When autoTranslateUGC is OFF, it shows a subtle "Translate" link for foreign text.
 */

// Simple heuristic: does the text contain significant CJK characters?
function detectLanguage(text: string): 'zh' | 'en' | 'unknown' {
  if (!text || text.length < 3) return 'unknown'
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const ratio = cjkCount / text.length
  if (ratio > 0.15) return 'zh'
  if (ratio < 0.05 && /[a-zA-Z]/.test(text)) return 'en'
  return 'unknown'
}

// In-memory cache keyed by text hash + target language
const translationCache = new Map<string, string>()

function cacheKey(text: string, target: string): string {
  // Simple hash — good enough for client-side dedup
  let hash = 0
  for (let i = 0; i < Math.min(text.length, 200); i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  }
  return `${hash}:${target}`
}

interface TranslatableTextProps {
  /** The original text content */
  text: string
  /** Render function — receives the display text */
  children: (displayText: string) => React.ReactNode
  /** Optional: known source language (skip auto-detection) */
  sourceLanguage?: string
  /** Optional: CSS class for the translation indicator */
  className?: string
}

export default function TranslatableText({
  text,
  children,
  sourceLanguage,
  className = '',
}: TranslatableTextProps) {
  const { locale, autoTranslateUGC } = useLanguage()
  const zh = locale === 'zh'

  const detected = sourceLanguage || detectLanguage(text)
  const isForeign = detected !== 'unknown' && detected !== locale
  const targetLang = locale

  const [translated, setTranslated] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const translate = useCallback(async () => {
    if (!text || !isForeign) return
    const key = cacheKey(text, targetLang)
    const cached = translationCache.get(key)
    if (cached) {
      setTranslated(cached)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/messages/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: targetLang }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.translated && data.translated !== text) {
        translationCache.set(key, data.translated)
        setTranslated(data.translated)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [text, targetLang, isForeign])

  // Auto-translate when enabled
  useEffect(() => {
    if (autoTranslateUGC && isForeign && !translated) {
      translate()
    }
  }, [autoTranslateUGC, isForeign, translated, translate])

  // Reset translation when locale changes
  useEffect(() => {
    setTranslated(null)
    setShowOriginal(false)
  }, [locale])

  // Not foreign or no text — render as-is
  if (!isForeign || !text) {
    return <>{children(text)}</>
  }

  const displayText = (translated && !showOriginal) ? translated : text
  const langLabel = detected === 'zh' ? (zh ? '中文' : 'Chinese') : (zh ? '英文' : 'English')

  return (
    <div className={className}>
      {children(displayText)}

      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-400">
        {loading && (
          <span className="animate-pulse">{zh ? '翻译中...' : 'Translating...'}</span>
        )}

        {translated && !showOriginal && !loading && (
          <>
            <span>{zh ? `已从${langLabel}翻译` : `Translated from ${langLabel}`}</span>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => setShowOriginal(true)}
              className="text-primary-500 hover:text-primary-600 font-medium"
            >
              {zh ? '显示原文' : 'Show Original'}
            </button>
          </>
        )}

        {translated && showOriginal && !loading && (
          <button
            onClick={() => setShowOriginal(false)}
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            {zh ? '显示翻译' : 'Show Translation'}
          </button>
        )}

        {!translated && !loading && !autoTranslateUGC && (
          <button
            onClick={translate}
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            {zh ? '翻译' : 'Translate'}
          </button>
        )}

        {error && !loading && (
          <button
            onClick={translate}
            className="text-red-400 hover:text-red-500 font-medium"
          >
            {zh ? '翻译失败，重试' : 'Failed, retry'}
          </button>
        )}
      </div>
    </div>
  )
}
