'use client'

import DiscoverPanel from '@/components/discovery/DiscoverPanel'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function DiscoverPageClient() {
  const { t } = useLanguage()
  const d = t.brand.discover

  return (
    <div className="max-w-6xl mx-auto pt-6 pb-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{d.title}</h1>
        <p className="text-gray-600 mt-1">{d.databaseSubtitle}</p>
      </div>
      <DiscoverPanel />
    </div>
  )
}
