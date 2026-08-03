'use client'

import { useEffect } from 'react'
import DiscoverPanel from '@/components/discovery/DiscoverPanel'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function DiscoverPageClient() {
  const { t } = useLanguage()
  const d = t.brand.discover

  useEffect(() => {
    const key = 'overseed:view:/dashboard/brand/discover'
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    fetch('/api/analytics/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/dashboard/brand/discover' }),
      keepalive: true,
    }).catch(() => sessionStorage.removeItem(key))
  }, [])

  return (
    <div className="max-w-6xl mx-auto workspace-page-tight pb-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{d.title}</h1>
        <p className="text-gray-600 mt-1">{d.databaseSubtitle}</p>
      </div>
      <DiscoverPanel />
    </div>
  )
}
