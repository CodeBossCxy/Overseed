'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatCompactNumber } from '@/lib/i18n/formatNumber'
import PlatformIcon from '@/components/PlatformIcon'

interface SocialAccount {
  id: string
  platform: {
    name: string
    slug: string
  }
  username: string
  profileUrl?: string | null
  followerCount: number
  engagementRate?: number | string | null
  isVerified: boolean
  verificationMethod?: string | null
  verifiedAt?: string | null
}

interface SocialAccountListProps {
  accounts: SocialAccount[]
  isPublicView?: boolean
  onDelete?: (id: string) => void
  onAdd?: () => void
}

export default function SocialAccountList({
  accounts,
  isPublicView = false,
  onDelete,
  onAdd,
}: SocialAccountListProps) {
  const { t, locale } = useLanguage()

  const formatFollowers = (count: number) => formatCompactNumber(count, locale)

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{t.socialAccounts.list.empty}</p>
        {!isPublicView && onAdd && (
          <button
            onClick={onAdd}
            className="text-primary-600 hover:underline mt-2 inline-block"
          >
            {t.socialAccounts.list.addFirst}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
        >
          {/* Platform Icon */}
          <PlatformIcon name={account.platform.slug} className="w-12 h-12 rounded-lg" />

          {/* Account Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{account.platform.name}</span>
              {account.isVerified && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {account.verificationMethod && account.verificationMethod !== 'manual' && (
                    <span className="text-xs text-blue-500">
                      {account.verificationMethod === 'url' ? t.influencer.accounts.verifiedViaUrl : t.influencer.accounts.verifiedViaScreenshot}
                    </span>
                  )}
                </span>
              )}
            </div>
            {account.profileUrl ? (
              <a
                href={account.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-primary-600"
              >
                @{account.username}
              </a>
            ) : (
              <span className="text-sm text-gray-600">@{account.username}</span>
            )}
          </div>

          {/* Stats */}
          <div className="text-right">
            <div className="font-semibold">{formatFollowers(account.followerCount)}</div>
            <div className="text-xs text-gray-500">{t.socialAccounts.list.followers}</div>
          </div>

          {account.engagementRate && (
            <div className="text-right">
              <div className="font-semibold">{Number(account.engagementRate).toFixed(1)}%</div>
              <div className="text-xs text-gray-500">{t.socialAccounts.list.engagement}</div>
            </div>
          )}

          {/* Delete Button (only in edit mode) */}
          {!isPublicView && onDelete && (
            <button
              onClick={() => onDelete(account.id)}
              className="p-2 text-gray-400 hover:text-red-600 transition"
              title={t.common.removeAccount}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
