'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import CreatorCampaignDetail from './CreatorCampaignDetail'
import UGCTranslateToggle from '../UGCTranslateToggle'

interface CampaignDetailWrapperProps {
  initialCampaign: any
  isOwner: boolean
  hasApplied: boolean
  isSaved: boolean
  isAuthenticated: boolean
  userType?: string | null
  subscriptionTier?: string | null
}

export default function CampaignDetailWrapper({
  initialCampaign,
  isOwner,
  hasApplied,
  isSaved,
  isAuthenticated,
  userType,
  subscriptionTier,
}: CampaignDetailWrapperProps) {
  const { t, locale, isUGCTranslated } = useLanguage()
  const [campaign, setCampaign] = useState(initialCampaign)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isUGCTranslated) {
      setCampaign(initialCampaign)
      setIsLoading(false)
      return
    }

    // Show original content immediately — swap in translation when ready
    setCampaign(initialCampaign)
    setIsLoading(true)

    const controller = new AbortController()
    fetch(`/api/campaigns/${initialCampaign.id}?lang=${locale}&track=0`, {
      signal: controller.signal,
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && !data.message) setCampaign(data)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [locale, isUGCTranslated, initialCampaign])

  return (
    <div>
      <header className="mb-3 text-[#17255f]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={isOwner ? '/dashboard/brand/campaigns' : '/browse'}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-primary-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {isOwner ? t.brand.campaigns.title : t.workspace.browseCampaigns}
          </Link>
          <UGCTranslateToggle isLoading={isLoading} />
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{t.campaign.campaignDetails}</h1>
        <p className="mt-2 text-[#6876a1]">{isOwner ? t.campaign.previewCreators : t.campaign.recommendedOpportunity}</p>
      </header>
      <CreatorCampaignDetail
        campaign={campaign}
        isOwner={isOwner}
        hasApplied={hasApplied}
        isSaved={isSaved}
        isAuthenticated={isAuthenticated}
        userType={userType}
        subscriptionTier={subscriptionTier}
      />
    </div>
  )
}
