'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Tab bar shown on the per-campaign brand pages: the application pipeline
// and the influencer discovery tab live side by side.
export default function PipelineTabs({
  campaignId,
  active,
}: {
  campaignId: string
  active: 'pipeline' | 'discover'
}) {
  const { t } = useLanguage()
  const d = t.brand.discover
  const tabs = [
    { key: 'pipeline', label: d.tabPipeline, href: `/dashboard/brand/campaigns/${campaignId}/applications` },
    { key: 'discover', label: d.tabFind, href: `/dashboard/brand/campaigns/${campaignId}/discover` },
  ] as const

  return (
    <div className="mb-6 border-b border-gray-200 flex gap-6">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? 'page' : undefined}
          className={`pb-3 -mb-px text-sm border-b-2 transition ${
            active === tab.key
              ? 'border-gray-900 text-gray-900 font-bold'
              : 'border-transparent text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
