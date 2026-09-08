'use client'

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { translations, Locale } from './translations'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (typeof translations)[Locale]
  autoTranslateUGC: boolean
  setAutoTranslateUGC: (value: boolean) => void
  isUGCTranslated: boolean
  setIsUGCTranslated: (value: boolean) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

/**
 * Keep the environment in sync with the active locale:
 * - <html lang> for accessibility/SEO (client-side; pages stay statically
 *   renderable, unlike reading a cookie in the server root layout)
 * - a `locale` cookie so any future server-side rendering can pick it up
 */
function syncLocaleEnvironment(locale: Locale) {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  document.cookie = `locale=${locale};path=/;max-age=31536000;samesite=lax`
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [autoTranslateUGC, setAutoTranslateUGCState] = useState(true)
  const [isUGCTranslated, setIsUGCTranslated] = useState(true)
  const { data: session, status } = useSession()
  const hasFetchedRef = useRef(false)

  // Load locale and autoTranslateUGC from localStorage immediately
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'zh')) {
      setLocaleState(savedLocale)
    }
    syncLocaleEnvironment(savedLocale === 'zh' ? 'zh' : 'en')
    const savedAutoTranslate = localStorage.getItem('autoTranslateUGC')
    if (savedAutoTranslate !== null) {
      const val = savedAutoTranslate === 'true'
      setAutoTranslateUGCState(val)
      setIsUGCTranslated(val)
    }
  }, [])

  // When user is logged in, fetch their preferences from the database
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user || hasFetchedRef.current) return
    hasFetchedRef.current = true

    fetch('/api/user/language')
      .then(res => res.json())
      .then(data => {
        if (data.language && (data.language === 'en' || data.language === 'zh')) {
          setLocaleState(data.language)
          localStorage.setItem('locale', data.language)
          syncLocaleEnvironment(data.language)
        }
        if (data.autoTranslateUGC !== undefined) {
          const val = Boolean(data.autoTranslateUGC)
          setAutoTranslateUGCState(val)
          setIsUGCTranslated(val)
          localStorage.setItem('autoTranslateUGC', String(val))
        }
      })
      .catch(() => {
        // Silently fall back to localStorage value
      })
  }, [status, session])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
    syncLocaleEnvironment(newLocale)

    // Reset UGC toggle to the user's default preference when switching language
    setIsUGCTranslated(autoTranslateUGC)

    // If logged in, persist to database
    fetch('/api/user/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: newLocale }),
    }).catch(() => {})
  }, [autoTranslateUGC])

  const setAutoTranslateUGC = useCallback((value: boolean) => {
    setAutoTranslateUGCState(value)
    setIsUGCTranslated(value)
    localStorage.setItem('autoTranslateUGC', String(value))

    // If logged in, persist to database
    fetch('/api/user/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoTranslateUGC: value }),
    }).catch(() => {})
  }, [])

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: translations[locale],
    autoTranslateUGC,
    setAutoTranslateUGC,
    isUGCTranslated,
    setIsUGCTranslated,
  }), [locale, setLocale, autoTranslateUGC, setAutoTranslateUGC, isUGCTranslated])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
