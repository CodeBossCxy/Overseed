'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useViewMode } from '@/lib/hooks/useViewMode'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export type ThemeMode = 'creator' | 'brand' | 'global'

export type ColorTheme = 'default' | 'sunset' | 'sky' | 'cream' | 'lavender'
export const COLOR_THEMES: ColorTheme[] = ['default', 'sunset', 'sky', 'cream', 'lavender']

interface ThemeContextType {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'creator',
  setThemeMode: () => {},
  colorTheme: 'default',
  setColorTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { isBrand } = useViewMode()
  const pathname = usePathname()
  const [themeMode, setThemeModeState] = useState<ThemeMode>('global')
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('default')
  const syncedFromDb = useRef(false)

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
  }, [])

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme)
    localStorage.setItem('colorTheme', theme)
    if (session) {
      fetch('/api/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorTheme: theme }),
      }).catch(() => {})
    }
  }, [session])

  // Instant restore from localStorage, then sync once from DB when signed in
  useEffect(() => {
    const stored = localStorage.getItem('colorTheme') as ColorTheme | null
    if (stored && COLOR_THEMES.includes(stored)) {
      setColorThemeState(stored)
    }
  }, [])

  useEffect(() => {
    if (!session || syncedFromDb.current) return
    syncedFromDb.current = true
    fetch('/api/user/theme')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const theme = data?.colorTheme as ColorTheme | undefined
        if (theme && COLOR_THEMES.includes(theme)) {
          setColorThemeState(theme)
          localStorage.setItem('colorTheme', theme)
        }
      })
      .catch(() => {})
  }, [session])

  // Homepage → global (dark space theme)
  // Other pages → sync with user's view mode (creator pink / brand blue)
  useEffect(() => {
    const isGlobalPage = pathname === '/' || pathname === '/contact' || pathname === '/guidelines' || pathname === '/faq' || pathname === '/terms' || pathname === '/privacy'

    if (isGlobalPage) {
      document.documentElement.setAttribute('data-theme', 'global')
      setThemeModeState('global')
    } else {
      const viewTheme = session && isBrand ? 'brand' : 'creator'
      document.documentElement.setAttribute('data-theme', viewTheme)
      setThemeModeState(viewTheme)
    }

    // Update favicon
    const iconHref = (!session || isGlobalPage) ? '/icon-pink.png' : isBrand ? '/icon-blue.png' : '/icon-pink.png'
    let link = document.querySelector<HTMLLinkElement>('link[data-dynamic-icon]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      link.type = 'image/png'
      link.setAttribute('data-dynamic-icon', 'true')
      document.head.appendChild(link)
    }
    link.href = iconHref + '?v=' + (isGlobalPage ? 'global' : isBrand ? 'brand' : 'creator')
  }, [pathname, session, isBrand])

  // Ambient color theme only applies on app pages; the dark global theme
  // and the default look keep the attribute off entirely
  useEffect(() => {
    if (themeMode === 'global' || colorTheme === 'default') {
      document.documentElement.removeAttribute('data-color-theme')
    } else {
      document.documentElement.setAttribute('data-color-theme', colorTheme)
    }
  }, [themeMode, colorTheme])

  const value = useMemo(() => ({
    themeMode,
    setThemeMode,
    colorTheme,
    setColorTheme,
  }), [themeMode, setThemeMode, colorTheme, setColorTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
