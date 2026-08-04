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
      return
    }

    async function fetchTranslatedCampaign() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/campaigns/${initialCampaign.id}?lang=${locale}`)
        const data = await response.json()
        if (data && !data.message) {
          setCampaign(data)
        }
      } catch (error) {
        console.error('Error fetching campaign:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTranslatedCampaign()
  }, [locale, isUGCTranslated, initialCampaign])

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex min-h-16 items-center justify-between gap-3 mb-2">
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
