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
    { key: 'discover', label: d.tabFind, desc: d.tabFindDesc, href: `/dashboard/brand/campaigns/${campaignId}/discover` },
    { key: 'pipeline', label: d.tabPipeline, desc: d.tabPipelineDesc, href: `/dashboard/brand/campaigns/${campaignId}/applications` },
  ] as const

  return (
    <div className="mb-6 inline-flex flex-wrap gap-2 rounded-2xl p-1.5 workspace-glass-toolbar">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? 'page' : undefined}
          title={tab.desc}
          className={`rounded-xl px-5 py-2.5 text-sm transition ${
            active === tab.key
              ? 'selected-option-glass text-gray-900 font-bold'
              : 'text-gray-500 font-semibold hover:bg-white/45 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
