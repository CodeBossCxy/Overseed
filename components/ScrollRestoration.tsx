'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'scroll_pos:'

export default function ScrollRestoration() {
  const pathname = usePathname()

  useEffect(() => {
    const key = STORAGE_KEY + pathname

    // Restore scroll position after the page has rendered
    const saved = sessionStorage.getItem(key)
    if (saved) {
      const y = Number(saved)
      // Use rAF to wait for the browser to finish layout
      requestAnimationFrame(() => {
        window.scrollTo(0, y)
      })
    }

    // Save scroll position on scroll (debounced) and before unload
    let timer: ReturnType<typeof setTimeout>
    const saveScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        sessionStorage.setItem(key, String(window.scrollY))
      }, 150)
    }

    const saveImmediate = () => {
      sessionStorage.setItem(key, String(window.scrollY))
    }

    window.addEventListener('scroll', saveScroll, { passive: true })
    window.addEventListener('beforeunload', saveImmediate)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', saveScroll)
      window.removeEventListener('beforeunload', saveImmediate)
    }
  }, [pathname])

  return null
}
