'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import CompensationBadge from '@/components/campaigns/CompensationBadge'
import StatusBadge from '@/components/StatusBadge'

interface FollowerRequirement {
  id: string
  minFollowers: number
  maxFollowers: number | null
  platform: { name: string }
}

interface Campaign {
  id: string
  title: string
  status: string
  description: string | null
  contentGuidelines: string | null
  compensationType: string
  paymentMin: number | string | null
  paymentMax: number | string | null
  giftDescription: string | null
  contentType: string | null
  deadline: string | null
  campaignStartDate: string | null
  campaignEndDate: string | null
  createdAt: string
  viewCount: number
  totalSlots: number
  filledSlots: number
  hashtagsRequired: string | null
  mentionsRequired: string | null
  brand: { userId: string }
  categories: { categoryId: string; category: { name: string } }[]
  platforms: { platformId: string; platform: { name: string } }[]
  followerRequirements: FollowerRequirement[]
  _count: { applications: number }
}

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  underReview: number
}

interface BrandCampaignDetailClientProps {
  campaign: Campaign
  stats: Stats
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default function BrandCampaignDetailClient({ campaign, stats }: BrandCampaignDetailClientProps) {
  const { t, locale } = useLanguage()
  const fmtDate = (date: string | null) => {
    if (!date) return locale === 'zh' ? '未设置' : 'Not set'
    return formatDate(date, locale)
  }

  return (
    <div className="max-w-5xl mx-auto pt-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/brand/campaigns" className="text-gray-500 hover:text-gray-700">
              {t.brand.campaignDetail.backToCampaigns}
            </Link>
          </div>
          <h1 className="text-3xl font-bold">{campaign.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge machine="campaign" status={campaign.status} size="md" dot />
            <CompensationBadge type={campaign.compensationType} />
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/dashboard/brand/campaigns/${campaign.id}/edit`}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition"
          >
            {t.brand.campaignDetail.edit}
          </Link>
          <Link
            href={`/dashboard/brand/campaigns/${campaign.id}/applications`}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
          >
            {t.brand.campaignDetail.viewApplications} ({stats.total})
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white/85 backdrop-blur p-4 rounded-2xl shadow-sm">
          <div className="text-2xl font-bold">{campaign.viewCount}</div>
          <div className="text-sm text-gray-500">{t.brand.campaignDetail.views}</div>
        </div>
        <div className="bg-white/85 backdrop-blur p-4 rounded-2xl shadow-sm">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-500">{t.brand.campaignDetail.applications}</div>
        </div>
        <div className="bg-white/85 backdrop-blur p-4 rounded-2xl shadow-sm">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-500">{t.brand.campaignDetail.pending}</div>
        </div>
        <div className="bg-white/85 backdrop-blur p-4 rounded-2xl shadow-sm">
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-gray-500">{t.brand.campaignDetail.approved}</div>
        </div>
        <div className="bg-white/85 backdrop-blur p-4 rounded-2xl shadow-sm">
          <div className="text-2xl font-bold">{campaign.filledSlots}/{campaign.totalSlots}</div>
          <div className="text-sm text-gray-500">{t.brand.campaignDetail.slotsFilled}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">{t.brand.campaignDetail.description}</h2>
            {campaign.description ? (
              <div className="prose max-w-none whitespace-pre-wrap text-gray-700">
                {campaign.description}
              </div>
            ) : (
              <p className="text-gray-500 italic">{t.brand.campaignDetail.noDescription}</p>
            )}
          </div>

          {/* Content Guidelines */}
          {campaign.contentGuidelines && (
            <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">{t.brand.campaignDetail.contentGuidelines}</h2>
              <div className="prose max-w-none whitespace-pre-wrap text-gray-700">
                {campaign.contentGuidelines}
              </div>
            </div>
          )}

          {/* Requirements */}
          <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">{t.brand.campaignDetail.requirements}</h2>

            {campaign.followerRequirements.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t.brand.campaignDetail.followerRequirements}</h3>
                <div className="space-y-2">
                  {campaign.followerRequirements.map((req) => (
                    <div key={req.id} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{req.platform.name}:</span>
                      <span>
                        {req.minFollowers.toLocaleString()}
                        {req.maxFollowers ? ` - ${req.maxFollowers.toLocaleString()}` : '+'} {t.brand.campaignDetail.followers}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {campaign.hashtagsRequired && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t.brand.campaignDetail.requiredHashtags}</h3>
                <p className="text-sm">{campaign.hashtagsRequired}</p>
              </div>
            )}

            {campaign.mentionsRequired && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t.brand.campaignDetail.requiredMentions}</h3>
                <p className="text-sm">{campaign.mentionsRequired}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Campaign Info */}
          <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">{t.brand.campaignDetail.campaignDetails}</h2>

            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-500">{t.brand.campaignDetail.compensation}</span>
                <div className="font-medium">
                  {campaign.compensationType === 'PAID' && campaign.paymentMin && (
                    <span>${Number(campaign.paymentMin).toLocaleString()} - ${Number(campaign.paymentMax || campaign.paymentMin).toLocaleString()}</span>
                  )}
                  {campaign.compensationType === 'GIFTED' && campaign.giftDescription && (
                    <span>{campaign.giftDescription}</span>
                  )}
                  {campaign.compensationType === 'PAID_PLUS_GIFT' && (
                    <div>
                      {campaign.paymentMin && <div>${Number(campaign.paymentMin).toLocaleString()} - ${Number(campaign.paymentMax || campaign.paymentMin).toLocaleString()}</div>}
                      {campaign.giftDescription && <div className="text-sm text-gray-600">+ {campaign.giftDescription}</div>}
                    </div>
                  )}
                  {campaign.compensationType === 'AFFILIATE' && <span>{t.brand.campaignDetail.commissionBased}</span>}
                  {campaign.compensationType === 'NEGOTIABLE' && <span>{t.brand.campaignDetail.negotiable}</span>}
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-500">{t.brand.campaignDetail.contentType}</span>
                <div className="font-medium">{campaign.contentType || t.brand.campaignDetail.any}</div>
              </div>

              <div>
                <span className="text-sm text-gray-500">{t.brand.campaignDetail.applicationDeadline}</span>
                <div className="font-medium">{fmtDate(campaign.deadline)}</div>
              </div>

              <div>
                <span className="text-sm text-gray-500">{t.brand.campaignDetail.campaignPeriod}</span>
                <div className="font-medium">
                  {campaign.campaignStartDate || campaign.campaignEndDate ? (
                    <>
                      {fmtDate(campaign.campaignStartDate)} - {fmtDate(campaign.campaignEndDate)}
                    </>
                  ) : (
                    t.brand.campaignDetail.notSet
                  )}
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-500">{t.brand.campaignDetail.created}</span>
                <div className="font-medium">{fmtDate(campaign.createdAt)}</div>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">{t.brand.campaignDetail.categories}</h2>
            <div className="flex flex-wrap gap-2">
              {campaign.categories.map((c) => (
                <span key={c.categoryId} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {t.categoryNames[c.category.name] || c.category.name}
                </span>
              ))}
              {campaign.categories.length === 0 && (
                <span className="text-gray-500 text-sm">{t.brand.campaignDetail.noCategories}</span>
              )}
            </div>
          </div>

          {/* Platforms */}
          <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">{t.brand.campaignDetail.targetPlatforms}</h2>
            <div className="flex flex-wrap gap-2">
              {campaign.platforms.map((p) => (
                <span key={p.platformId} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                  {p.platform.name}
                </span>
              ))}
              {campaign.platforms.length === 0 && (
                <span className="text-gray-500 text-sm">{t.brand.campaignDetail.noPlatforms}</span>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">{t.brand.campaignDetail.actions}</h2>
            <div className="space-y-2">
              {campaign.status === 'DRAFT' && (
                <Link
                  href={`/dashboard/brand/campaigns/${campaign.id}/edit`}
                  className="block w-full px-4 py-2 text-center bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
                >
                  {t.brand.campaignDetail.continueEditing}
                </Link>
              )}
              <Link
                href={`/campaign/${campaign.id}`}
                className="block w-full px-4 py-2 text-center border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                {t.brand.campaignDetail.viewPublicPage}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Anti-fraud notice — shown under every campaign per spec */}
      <div className="mt-8 bg-amber-50/80 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-sm text-amber-800">
          {t.brand.campaigns.antiFraud}{' '}
          <Link href="/contact" className="font-semibold underline hover:text-amber-900">
            {t.brand.campaigns.reportNow}
          </Link>
        </p>
      </div>
    </div>
  )
}
