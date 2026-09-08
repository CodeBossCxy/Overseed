'use client'

import Link from 'next/link'
import CampaignCard from '../campaigns/CampaignCard'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatMonthYear } from '@/lib/i18n/formatDate'

interface BrandProfileProps {
  brand: {
    id: string
    companyName?: string | null
    logoUrl?: string | null
    websiteUrl?: string | null
    description?: string | null
    industry?: string | null
    companySize?: string | null
    isVerified: boolean
    createdAt: string
    user: {
      createdAt: string
    }
    campaigns: Array<any>
    _count: {
      campaigns: number
    }
    completedCollaborations?: number
  }
}

export default function BrandProfile({ brand }: BrandProfileProps) {
  const { locale, t } = useLanguage()
  const p = t.brand.profile
  const companySizeLabels: Record<string, string> = {
    startup: 'Startup',
    small: 'Small Business',
    medium: 'Medium Business',
    enterprise: 'Enterprise',
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Card */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Cover/Banner */}
        <div className="h-32 bg-gradient-to-r from-blue-400 to-blue-600" />

        {/* Profile Info */}
        <div className="px-6 pb-6">
          {/* Logo */}
          <div className="relative -mt-16 mb-4">
            <div className="w-32 h-32 rounded-lg border-4 border-white bg-white overflow-hidden shadow-lg">
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={brand.companyName || 'Brand'}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                  {brand.companyName?.charAt(0) || 'B'}
                </div>
              )}
            </div>
          </div>

          {/* Name and Verification */}
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">{brand.companyName || 'Anonymous Brand'}</h1>
            {brand.isVerified && (
              <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* Industry and Company Size */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
            {brand.industry && (
              <span className="px-3 py-1 bg-gray-100 rounded-full">{brand.industry}</span>
            )}
            {brand.companySize && (
              <span>{companySizeLabels[brand.companySize] || brand.companySize}</span>
            )}
            <span>
              {p.onPlatformSince}{formatMonthYear(brand.user.createdAt, locale)}
            </span>
          </div>

          {/* Website */}
          {brand.websiteUrl && (
            <a
              href={brand.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary-600 hover:underline mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {brand.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}

          {/* Description */}
          {brand.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">About</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{brand.description}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {brand._count.campaigns}
              </div>
              <div className="text-sm text-gray-500">Total Campaigns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {brand.campaigns.length}
              </div>
              <div className="text-sm text-gray-500">Active Campaigns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {brand.completedCollaborations || 0}
              </div>
              <div className="text-sm text-gray-500">Collaborations</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      {brand.campaigns.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Active Campaigns</h2>
          <div className="space-y-4">
            {brand.campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>
      )}

      {brand.campaigns.length === 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">No active campaigns at the moment.</p>
        </div>
      )}
    </div>
  )
}
