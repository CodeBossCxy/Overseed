'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import PipelineTabs from '@/components/PipelineTabs'
import DiscoverPanel from '@/components/discovery/DiscoverPanel'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function CampaignDiscoverPage() {
  const params = useParams()
  const campaignId = params.id as string
  const { t, locale } = useLanguage()
  const d = t.brand.discover

  const [campaign, setCampaign] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}?lang=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCampaign(data))
      .catch(() => {})
  }, [campaignId, locale])

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-6xl mx-auto workspace-page-tight pb-8">
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">
            <Link href="/dashboard/brand/campaigns" className="hover:text-primary-700">
              {t.brand.applications.breadcrumbPipeline}
            </Link>
            {campaign && (
              <>
                <span className="mx-2">›</span>
                <Link href={`/dashboard/brand/campaigns/${campaignId}`} className="hover:text-primary-700">{campaign.title}</Link>
                <span className="mx-2">›</span>
                <span className="font-semibold text-gray-700">{d.tabFind}</span>
              </>
            )}
          </p>
          <h1 className="text-3xl font-bold">{d.title}</h1>
          {campaign && (
            <p className="text-gray-600 mt-1">
              {d.tabFindDesc}
            </p>
          )}
        </div>

        <PipelineTabs campaignId={campaignId} active="discover" />

        <DiscoverPanel />
      </div>
    </BrandWorkspaceLayout>
  )
}
