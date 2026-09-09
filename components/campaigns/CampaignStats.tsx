'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatNumber } from '@/lib/i18n/formatNumber'

interface CampaignStatsProps {
  applications: number
  spotsLeft: number
  totalSlots: number
  viewCount: number
}

export default function CampaignStats({
  applications,
  spotsLeft,
  totalSlots,
  viewCount,
}: CampaignStatsProps) {
  const { t, locale } = useLanguage()
  const filledPercentage = ((totalSlots - spotsLeft) / totalSlots) * 100

  const spotsRemainingText = (spotsLeft === 1 ? t.campaign.spotRemainingCount : t.campaign.spotsRemainingCount)
    .replace('{count}', String(spotsLeft))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{t.campaign.applications}</span>
        <span className="font-semibold">{applications}</span>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">{t.campaign.spotsFilled}</span>
          <span className="font-semibold">{totalSlots - spotsLeft} / {totalSlots}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all"
            style={{ width: `${filledPercentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {spotsRemainingText}
        </p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{t.campaign.views}</span>
        <span className="font-semibold">{formatNumber(viewCount, locale)}</span>
      </div>
    </div>
  )
}
