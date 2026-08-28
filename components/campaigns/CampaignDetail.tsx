'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import CompensationBadge from './CompensationBadge'
import CampaignStats from './CampaignStats'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

interface CampaignDetailProps {
  campaign: {
    id: string
    title: string
    description?: string | null
    compensationType: string
    paymentMin?: number | string | null
    paymentMax?: number | string | null
    giftDescription?: string | null
    giftValue?: number | string | null
    deadline?: string | null
    campaignStartDate?: string | null
    campaignEndDate?: string | null
    totalSlots: number
    filledSlots: number
    images: string[]
    isFeatured: boolean
    viewCount: number
    requiresProductPurchase: boolean
    productPurchaseAmount?: number | string | null
    isProductReimbursed: boolean
    contentType?: string | null
    contentGuidelines?: string | null
    wordCountMin?: number | null
    wordCountMax?: number | null
    hashtagsRequired?: string | null
    mentionsRequired?: string | null
    createdAt: string
    brand: {
      id: string
      userId: string
      companyName?: string | null
      logoUrl?: string | null
      websiteUrl?: string | null
      description?: string | null
      industry?: string | null
      isVerified: boolean
    }
    agency?: {
      id: string
      agencyName: string
      logoUrl?: string | null
    } | null
    categories: Array<{
      category: {
        id: number
        name: string
        slug: string
      }
    }>
    platforms: Array<{
      platform: {
        id: number
        name: string
        slug: string
      }
    }>
    followerRequirements: Array<{
      platform: { id: number; name: string }
      minFollowers: number
      maxFollowers?: number | null
      minEngagementRate?: number | string | null
    }>
    media: Array<{
      id: string
      mediaUrl: string
      mediaType: string
    }>
    _count: {
      applications: number
    }
  }
  isOwner?: boolean
  hasApplied?: boolean
  isSaved?: boolean
  isAuthenticated?: boolean
  userType?: string | null
  subscriptionTier?: string | null
}

export default function CampaignDetail({
  campaign,
  isOwner = false,
  hasApplied = false,
  isSaved = false,
  isAuthenticated = false,
  userType,
  subscriptionTier,
}: CampaignDetailProps) {
  const router = useRouter()
  const { t, locale } = useLanguage()
  const spotsLeft = campaign.totalSlots - campaign.filledSlots
  const isDeadlinePassed = campaign.deadline && new Date(campaign.deadline) < new Date()

  // Save-campaign toggle (creators)
  const [saved, setSaved] = useState(isSaved)
  const [saveBusy, setSaveBusy] = useState(false)
  const toggleSave = async () => {
    setSaveBusy(true)
    const next = !saved
    setSaved(next)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/save`, { method: next ? 'POST' : 'DELETE' })
      if (!res.ok) setSaved(!next)
    } catch {
      setSaved(!next)
    } finally {
      setSaveBusy(false)
    }
  }

  const getContentTypeLabel = (type: string | null | undefined) => {
    const types: Record<string, string> = {
      IMAGE_POST: t.campaign.imagePost,
      VIDEO: t.campaign.video,
      STORY: t.campaign.story,
      REEL: t.campaign.reel,
      ANY: t.campaign.anyFormat,
    }
    return type ? types[type] || type : t.campaign.notSpecified
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header Card */}
        <div className="workspace-glass-card rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {campaign.categories.map(({ category }) => (
                    <span
                      key={category.id}
                      className="text-sm font-medium text-primary-600 bg-primary-100 px-3 py-1 rounded-full"
                    >
                      {t.categoryNames[category.name] || category.name}
                    </span>
                  ))}
                  {campaign.isFeatured && (
                    <span className="text-sm font-medium text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full">
                      {t.campaign.featured}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{campaign.title}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span>{campaign.viewCount.toLocaleString()} {t.campaign.views_count}</span>
                  <span>{t.campaign.posted} {formatDate(campaign.createdAt, locale)}</span>
                  {campaign.deadline && (
                    <span className={isDeadlinePassed ? 'text-red-600' : 'text-orange-600'}>
                      {isDeadlinePassed ? t.campaign.deadlinePassedLabel : `${t.campaign.deadline} ${formatDate(campaign.deadline, locale)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Images */}
          {(campaign.images.length > 0 || campaign.media.length > 0) && (
            <div className="p-6 border-b">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {campaign.images.map((image, index) => (
                  <div key={index} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <Image src={image} alt={t.campaign.campaignImageAlt.replace('{n}', String(index + 1))} width={400} height={225} className="w-full h-full object-cover" />
                  </div>
                ))}
                {campaign.media.map((media) => (
                  <div key={media.id} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    {media.mediaType === 'video' ? (
                      <video src={media.mediaUrl} className="w-full h-full object-cover" controls />
                    ) : (
                      <Image src={media.mediaUrl} alt={t.campaign.campaignMediaAlt} width={400} height={225} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold mb-4">{t.campaign.aboutThisCampaign}</h2>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">{campaign.description || t.campaign.noDescription}</p>
              {/* Anti-fraud notice — shown under every campaign per spec */}
              <div className="mt-4 bg-amber-50/80 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
                {t.brand.campaigns.antiFraud}{' '}
                <Link href="/contact" className="font-semibold underline hover:text-amber-900">
                  {t.brand.campaigns.reportNow}
                </Link>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold mb-4">{t.campaign.requirements}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Platforms */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t.campaign.platforms}</h3>
                <div className="flex flex-wrap gap-2">
                  {campaign.platforms.map(({ platform }) => (
                    <span key={platform.id} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                      {platform.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Follower Requirements */}
              {campaign.followerRequirements.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">{t.campaign.followerRequirements}</h3>
                  <div className="space-y-1">
                    {campaign.followerRequirements.map((req, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium">{req.platform.name}:</span>{' '}
                        {req.minFollowers.toLocaleString()}
                        {req.maxFollowers ? ` - ${req.maxFollowers.toLocaleString()}` : '+'} {t.campaign.followers}
                        {req.minEngagementRate && ` (min ${req.minEngagementRate}% ${t.campaign.engagement})`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Type */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t.campaign.contentType}</h3>
                <p className="text-sm">{getContentTypeLabel(campaign.contentType)}</p>
              </div>

              {/* Slots */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t.campaign.availableSpots}</h3>
                <p className="text-sm">
                  {t.campaign.spotsRemaining.replace('{left}', String(spotsLeft)).replace('{total}', String(campaign.totalSlots))}
                </p>
              </div>
            </div>
          </div>

          {/* Content Guidelines */}
          {campaign.contentGuidelines && (
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold mb-4">{t.campaign.contentGuidelines}</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{campaign.contentGuidelines}</p>

              {(campaign.hashtagsRequired || campaign.mentionsRequired) && (
                <div className="mt-4 space-y-2">
                  {campaign.hashtagsRequired && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">{t.campaign.requiredHashtags} </span>
                      <span className="text-sm text-primary-600">{campaign.hashtagsRequired}</span>
                    </div>
                  )}
                  {campaign.mentionsRequired && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">{t.campaign.requiredMentions} </span>
                      <span className="text-sm text-primary-600">{campaign.mentionsRequired}</span>
                    </div>
                  )}
                </div>
              )}

              {(campaign.wordCountMin || campaign.wordCountMax) && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-500">{t.campaign.wordCount} </span>
                  <span className="text-sm">
                    {campaign.wordCountMin && `${t.campaign.min} ${campaign.wordCountMin}`}
                    {campaign.wordCountMin && campaign.wordCountMax && ' - '}
                    {campaign.wordCountMax && `${t.campaign.max} ${campaign.wordCountMax}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Campaign Timeline */}
          {(campaign.campaignStartDate || campaign.campaignEndDate) && (
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">{t.campaign.campaignTimeline}</h2>
              <div className="flex flex-wrap gap-6">
                {campaign.campaignStartDate && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">{t.campaign.startDate} </span>
                    <span className="text-sm">{formatDate(campaign.campaignStartDate, locale)}</span>
                  </div>
                )}
                {campaign.campaignEndDate && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">{t.campaign.endDate} </span>
                    <span className="text-sm">{formatDate(campaign.campaignEndDate, locale)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-1">
        <div className="workspace-glass-card rounded-3xl p-6 sticky top-20 space-y-6">
          {/* Compensation */}
          <div>
            <h3 className="text-lg font-semibold mb-3">{t.campaign.compensation}</h3>
            <CompensationBadge
              type={campaign.compensationType}
              paymentMin={campaign.paymentMin}
              paymentMax={campaign.paymentMax}
              giftDescription={campaign.giftDescription}
              size="lg"
            />
            {campaign.giftValue && (
              <p className="text-sm text-gray-500 mt-2">
                {t.campaign.giftValue} ${Number(campaign.giftValue).toLocaleString()}
              </p>
            )}
            {campaign.requiresProductPurchase && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm">
                <p className="font-medium text-yellow-800">{t.campaign.requiresProductPurchase}</p>
                {campaign.productPurchaseAmount && (
                  <p className="text-yellow-700">
                    ${Number(campaign.productPurchaseAmount).toLocaleString()}
                    {campaign.isProductReimbursed && ` ${t.campaign.reimbursed}`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <CampaignStats
            applications={campaign._count.applications}
            spotsLeft={spotsLeft}
            totalSlots={campaign.totalSlots}
            viewCount={campaign.viewCount}
          />

          {/* Actions */}
          <div className="pt-4 border-t space-y-3">
            {isOwner ? (
              <Link
                href={`/dashboard/brand/campaigns/${campaign.id}`}
                className="block w-full px-4 py-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition text-center font-semibold"
              >
                {t.campaign.manageCampaignLink}
              </Link>
            ) : (
              <>
                {userType === 'BRAND' || userType === 'ADMIN' ? (
                  <div className="text-center text-gray-500 text-sm py-2">
                    {t.campaign.onlyCreatorsCanApply}
                  </div>
                ) : (
                  <>
                    {!isDeadlinePassed && spotsLeft > 0 && (
                      hasApplied ? (
                        <button
                          disabled
                          className="w-full px-4 py-3 bg-gray-300 text-gray-600 rounded-full cursor-not-allowed text-center font-semibold"
                        >
                          {t.campaign.alreadyApplied}
                        </button>
                      ) : isAuthenticated && subscriptionTier === 'FREE' ? (
                        <Link
                          href="/dashboard/upgrade"
                          className="block w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full hover:from-amber-600 hover:to-orange-600 transition text-center font-semibold"
                        >
                          {t.campaign.upgradeToProToApply}
                        </Link>
                      ) : isAuthenticated ? (
                        <Link
                          href={`/campaign/${campaign.id}/apply`}
                          className="block w-full px-4 py-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition text-center font-semibold"
                        >
                          {t.campaign.applyNow}
                        </Link>
                      ) : (
                        <Link
                          href="/auth/signin"
                          className="block w-full px-4 py-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition text-center font-semibold"
                        >
                          {t.campaign.signInToApply}
                        </Link>
                      )
                    )}
                    {isDeadlinePassed && (
                      <div className="text-center text-red-600 font-medium">
                        {t.campaign.deadlinePassed}
                      </div>
                    )}
                    {spotsLeft === 0 && !isDeadlinePassed && (
                      <div className="text-center text-orange-600 font-medium">
                        {t.campaign.allSpotsFilled}
                      </div>
                    )}
                    {isAuthenticated && (
                      <button
                        onClick={toggleSave}
                        disabled={saveBusy}
                        className={`w-full px-4 py-3 rounded-full transition text-center font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${
                          saved
                            ? 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {saved ? t.campaign.savedCampaignBtn : t.campaign.saveCampaignBtn}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Brand Info */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">{t.campaign.postedBy}</h3>
            <Link href={`/brand/${campaign.brand.id}`} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg -mx-2">
              <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {campaign.brand.logoUrl ? (
                  <Image src={campaign.brand.logoUrl} alt={campaign.brand.companyName || t.profileCards.brand.logoAltFallback} width={48} height={48} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl">
                    {campaign.brand.companyName?.charAt(0) || 'B'}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-medium">{campaign.brand.companyName || t.campaign.anonymousBrand}</p>
                  {campaign.brand.isVerified && (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                {campaign.brand.industry && (
                  <p className="text-sm text-gray-500">{campaign.brand.industry}</p>
                )}
              </div>
            </Link>
          </div>

          {/* Report */}
          <div className="pt-4 border-t">
            <Link href="/contact" className="text-sm text-red-600 hover:underline">
              {t.campaign.reportCampaign}
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}
