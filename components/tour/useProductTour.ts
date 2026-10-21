'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

// Module-level flags survive component remounts (page navigations).
let _checked = false
let _tourRunning = false

export function useProductTour() {
  const { data: session } = useSession()
  const [shouldAutoStart, setShouldAutoStart] = useState(false)

  useEffect(() => {
    if (!session?.user || _checked || _tourRunning) return
    _checked = true

    fetch('/api/user/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.needsProductTour && window.innerWidth >= 1024) {
          setShouldAutoStart(true)
        }
      })
      .catch(() => {})
  }, [session?.user])

  const markTourRunning = useCallback(() => { _tourRunning = true }, [])

  const completeTour = useCallback(async () => {
    _tourRunning = false
    setShouldAutoStart(false)
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completeProductTour' }),
      })
    } catch {}
  }, [])

  const resetTour = useCallback(async () => {
    _checked = false
    _tourRunning = false
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resetProductTour' }),
      })
    } catch {}
  }, [])

  return { shouldAutoStart, completeTour, resetTour, markTourRunning }
}
