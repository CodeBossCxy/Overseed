'use client'

import Link from 'next/link'
import Image from 'next/image'
import CompensationBadge from './CompensationBadge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import { formatNumber } from '@/lib/i18n/formatNumber'

interface CampaignCardProps {
  campaign: {
    id: string
    title: string
    description?: string | null
    compensationType: string
    paymentMin?: number | string | null
    paymentMax?: number | string | null
    giftDescription?: string | null
    deadline?: string | null
    totalSlots: number
    filledSlots: number
    images: string[]
    isFeatured: boolean
    viewCount: number
    brand: {
      companyName?: string | null
      logoUrl?: string | null
      isVerified: boolean
    }
    categories: Array<{
      category: {
        name: string
        slug: string
      }
    }>
    platforms: Array<{
      platform: {
        name: string
        slug: string
      }
    }>
    followerRequirements?: Array<{
      platform: { name: string }
      minFollowers: number
      maxFollowers?: number | null
    }>
    _count?: {
      applications: number
    }
  }
}

export default function CampaignCard({ campaign }: CampaignCardProps) {
  const { t, locale } = useLanguage()
  const spotsLeft = campaign.totalSlots - campaign.filledSlots
  const isUrgent = campaign.deadline && new Date(campaign.deadline) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

  return (
    <Link
      href={`/campaign/${campaign.id}`}
      className="block bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
    >
      <div className="flex gap-4 p-4 md:p-6">
        {/* Image */}
        <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg overflow-hidden">
          {campaign.images && campaign.images.length > 0 ? (
            <Image
              src={campaign.images[0]}
              alt={campaign.title}
              width={128}
              height={128}
              className="w-full h-full object-cover"
            />
          ) : campaign.brand.logoUrl ? (
            <Image
              src={campaign.brand.logoUrl}
              alt={campaign.brand.companyName || 'Brand'}
              width={128}
              height={128}
              className="w-full h-full object-contain p-4 bg-white"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-3xl">
              {campaign.brand.companyName?.charAt(0) || 'C'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Tags Row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {campaign.categories.slice(0, 2).map(({ category }) => (
              <span
                key={category.slug}
                className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded"
              >
                {t.categoryNames[category.name] || category.name}
              </span>
            ))}
            {campaign.isFeatured && (
              <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                {t.campaignCard.featured}
              </span>
            )}
            {isUrgent && (
              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">
                {t.campaignCard.urgent}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
            {campaign.title}
          </h3>

          {/* Brand Name */}
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
            <span>{campaign.brand.companyName || t.campaign.anonymousBrand}</span>
            {campaign.brand.isVerified && (
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>

          {/* Description */}
          {campaign.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3">
              {campaign.description}
            </p>
          )}

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {campaign.platforms.length > 0 && (
              <span className="flex items-center gap-1">
                {campaign.platforms.map(p => p.platform.name).join(', ')}
              </span>
            )}
            {campaign.followerRequirements && campaign.followerRequirements.length > 0 && (
              <span>
                {formatNumber(campaign.followerRequirements[0].minFollowers, locale)}+ {t.campaignCard.followers}
              </span>
            )}
            {campaign._count && (
              <span>{campaign._count.applications} {t.campaignCard.applied}</span>
            )}
            <span>{spotsLeft} {t.campaignCard.spotsLeft}</span>
          </div>
        </div>

        {/* Right Side - Compensation */}
        <div className="hidden md:flex flex-col items-end justify-between">
          <CompensationBadge
            type={campaign.compensationType}
            paymentMin={campaign.paymentMin}
            paymentMax={campaign.paymentMax}
            giftDescription={campaign.giftDescription}
          />
          {campaign.deadline && (
            <span className={`text-xs ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
              {t.campaignCard.due} {formatDate(campaign.deadline, locale)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
