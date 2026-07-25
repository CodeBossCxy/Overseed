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
      <div className="max-w-6xl mx-auto pt-6 pb-8">
        <div className="mb-8">
          <Link href="/dashboard/brand/campaigns" className="text-primary-600 hover:underline text-sm mb-2 inline-block">
            {t.brand.applications.backToCampaigns}
          </Link>
          <h1 className="text-3xl font-bold">{d.title}</h1>
          {campaign && (
            <p className="text-gray-600 mt-1">
              {t.brand.applications.forCampaign} {campaign.title}
            </p>
          )}
        </div>

        <PipelineTabs campaignId={campaignId} active="discover" />

        <DiscoverPanel />
      </div>
    </BrandWorkspaceLayout>
  )
}
