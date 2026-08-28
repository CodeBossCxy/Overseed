'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ViewMode = 'BRAND' | 'INFLUENCER'

export function useViewMode() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [isSwitching, setIsSwitching] = useState(false)

  const userType = (session?.user as any)?.userType
  // ADMIN accounts operate the workspace in brand view
  const currentMode: ViewMode =
    userType === 'BRAND' || userType === 'ADMIN' ? 'BRAND' : 'INFLUENCER'

  const isBrand = currentMode === 'BRAND'
  const isInfluencer = currentMode === 'INFLUENCER'

  const switchView = async (targetMode?: ViewMode) => {
    const newMode = targetMode ?? (isBrand ? 'INFLUENCER' : 'BRAND')
    if (newMode === currentMode) return

    setIsSwitching(true)
    try {
      const res = await fetch('/api/user/switch-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewMode: newMode }),
      })

      if (!res.ok) {
        console.error('Switch view failed:', await res.text())
        return
      }

      // Refresh the JWT cookie so it matches the DB, then navigate
      await update()

      const dashboard =
        newMode === 'BRAND' ? '/dashboard/brand' : '/dashboard/influencer'
      router.push(dashboard)
    } finally {
      setIsSwitching(false)
    }
  }

  return {
    currentMode,
    isBrand,
    isInfluencer,
    switchView,
    isSwitching,
  }
}
