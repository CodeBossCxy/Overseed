'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import StatusBadge from '@/components/StatusBadge'

interface Campaign {
  id: string
  title: string
  status: string
  totalSlots: number
  filledSlots: number
  deadline: string | null
  categories: { category: { id: string; name: string } }[]
  platforms: { platform: { id: string; name: string } }[]
  _count: { applications: number }
}

interface BrandCampaignsClientProps {
  campaigns: Campaign[]
}

export default function BrandCampaignsClient({ campaigns }: BrandCampaignsClientProps) {
  const { t, locale } = useLanguage()

  return (
    <div className="max-w-6xl mx-auto pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t.brand.campaigns.title}</h1>
          <p className="text-gray-500 mt-1">{t.brand.campaigns.subtitle}</p>
        </div>
        <Link
          href="/dashboard/brand/campaigns/new"
          className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 transition"
        >
          {t.brand.campaigns.createCampaign}
        </Link>
      </div>

      {/* Campaigns Table */}
      {campaigns.length === 0 ? (
        <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">{t.brand.campaigns.noCampaigns}</p>
          <p className="text-gray-400 mb-6">{t.brand.campaigns.noCampaignsDesc}</p>
          <Link
            href="/dashboard/brand/campaigns/new"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition"
          >
            {t.brand.campaigns.createFirst}
          </Link>
        </div>
      ) : (
        <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t.brand.campaigns.thCampaign}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t.brand.campaigns.thStatus}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t.brand.campaigns.thApplications}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t.brand.campaigns.thDeadline}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t.brand.campaigns.thActions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-white transition">
                  <td className="px-6 py-4">
                    <div>
                      <Link
                        href={`/campaign/${campaign.id}`}
                        className="font-medium text-gray-900 hover:text-primary-600"
                      >
                        {campaign.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        {campaign.categories.slice(0, 2).map(({ category }) => (
                          <span
                            key={category.id}
                            className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
                          >
                            {t.categoryNames[category.name] || category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge machine="campaign" status={campaign.status} size="sm" dot />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-900">{campaign._count.applications}</span>
                    <span className="text-gray-500"> / {campaign.totalSlots} {t.brand.campaigns.spots}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {campaign.deadline
                      ? formatDate(campaign.deadline, locale)
                      : t.brand.campaigns.noDeadline}
                  </td>
                  <td className="px-6 py-4 text-right space-x-4">
                    <Link
                      href={`/dashboard/brand/campaigns/${campaign.id}/applications`}
                      className="text-primary-600 hover:underline text-sm"
                    >
                      {t.brand.campaigns.thApplications}
                    </Link>
                    <Link
                      href={`/dashboard/brand/campaigns/${campaign.id}/edit`}
                      className="text-gray-600 hover:underline text-sm"
                    >
                      {t.brand.campaigns.edit}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
