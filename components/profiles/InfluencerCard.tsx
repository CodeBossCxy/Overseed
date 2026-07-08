'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface InfluencerCardProps {
  influencer: {
    id: string
    displayName?: string | null
    avatarUrl?: string | null
    bio?: string | null
    primaryNiche?: string | null
    locationCity?: string | null
    locationState?: string | null
    isVerified: boolean
    user: {
      name?: string | null
      image?: string | null
    }
    socialAccounts: Array<{
      platform: {
        name: string
        slug: string
      }
      username: string
      followerCount: number
    }>
    completedCampaigns?: number
  }
}

export default function InfluencerCard({ influencer }: InfluencerCardProps) {
  const { t } = useLanguage()
  const displayName = influencer.displayName || influencer.user.name || t.profileCards.influencer.unknownName
  const avatar = influencer.avatarUrl || influencer.user.image

  // Get total followers across all platforms
  const totalFollowers = influencer.socialAccounts.reduce(
    (sum, acc) => sum + acc.followerCount,
    0
  )

  // Get primary platform (highest follower count)
  const primaryPlatform = influencer.socialAccounts.sort(
    (a, b) => b.followerCount - a.followerCount
  )[0]

  const location = [influencer.locationCity, influencer.locationState]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      href={`/influencer/${influencer.id}`}
      className="block bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                {displayName.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
              {influencer.isVerified && (
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {influencer.primaryNiche && (
              <span className="inline-block mt-1 text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                {influencer.primaryNiche}
              </span>
            )}

            {location && (
              <p className="text-sm text-gray-500 mt-1">{location}</p>
            )}
          </div>
        </div>

        {/* Bio */}
        {influencer.bio && (
          <p className="text-sm text-gray-600 mt-3 line-clamp-2">{influencer.bio}</p>
        )}

        {/* Platforms */}
        {influencer.socialAccounts.length > 0 && (
          <div className="mt-4 pt-3 border-t space-y-1.5">
            {influencer.socialAccounts
              .sort((a, b) => b.followerCount - a.followerCount)
              .map((acc) => (
              <div key={acc.platform.slug} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-gray-500 flex-shrink-0">{acc.platform.name}</span>
                  <span className="text-gray-400 truncate">@{acc.username}</span>
                </div>
                <span className="font-medium text-gray-700 flex-shrink-0 ml-2">
                  {acc.followerCount >= 1000000
                    ? `${(acc.followerCount / 1000000).toFixed(1)}M`
                    : acc.followerCount >= 1000
                      ? `${(acc.followerCount / 1000).toFixed(1)}K`
                      : acc.followerCount}
                </span>
              </div>
            ))}
          </div>
        )}
        {influencer.completedCampaigns !== undefined && influencer.completedCampaigns > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            {influencer.completedCampaigns} {t.profileCards.influencer.completedSuffix}
          </div>
        )}
      </div>
    </Link>
  )
}
