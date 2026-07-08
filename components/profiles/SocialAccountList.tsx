'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

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
  const { t } = useLanguage()

  const getPlatformIcon = (slug: string) => {
    const svgClass = "w-6 h-6 text-white"
    switch (slug) {
      case 'instagram':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
          </svg>
        )
      case 'tiktok':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.1a8.16 8.16 0 005.58 2.2V11.3a4.85 4.85 0 01-3.77-1.85V6.69h3.77z"/>
          </svg>
        )
      case 'youtube':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        )
      case 'twitter':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        )
      case 'facebook':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )
      case 'pinterest':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/>
          </svg>
        )
      case 'snapchat':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.97-.315a.76.76 0 01.397-.12.655.655 0 01.6.42c.04.12.06.24.06.36 0 .27-.12.51-.33.69-.39.33-.855.51-1.29.66-.18.06-.39.12-.555.18-.105.045-.18.09-.21.135a.42.42 0 00-.045.27c.12.54.315 1.08.585 1.59.57 1.05 1.305 1.845 2.175 2.37.345.21.72.375 1.095.495.12.045.24.09.315.135.33.18.375.36.345.54-.045.27-.345.48-.765.56a5.3 5.3 0 01-.9.105c-.24.015-.48.045-.72.09-.39.075-.69.24-.99.525a3.38 3.38 0 00-.36.42c-.27.375-.57.795-1.17 1.065-.36.165-.78.24-1.185.24-.21 0-.42-.015-.615-.06a4.62 4.62 0 00-.84-.09c-.27 0-.54.03-.825.09-.39.075-.72.195-1.095.345-1.11.45-1.905.555-2.385.555-.12 0-.225-.015-.3-.03-.66 0-1.29-.105-1.905-.555-.375-.15-.705-.27-1.095-.345a5.67 5.67 0 00-.825-.09c-.27 0-.57.015-.84.09a3.83 3.83 0 01-.615.06c-.405 0-.825-.075-1.185-.24-.6-.27-.9-.69-1.17-1.065a3.38 3.38 0 00-.36-.42c-.3-.285-.6-.45-.99-.525a8.1 8.1 0 00-.72-.09 5.3 5.3 0 01-.9-.105c-.42-.075-.72-.285-.765-.555-.03-.18.015-.36.345-.54.075-.045.195-.09.315-.135.375-.12.75-.285 1.095-.495.87-.525 1.605-1.32 2.175-2.37.27-.51.465-1.05.585-1.59a.42.42 0 00-.045-.27c-.03-.045-.105-.09-.21-.135-.165-.06-.375-.12-.555-.18-.435-.15-.9-.33-1.29-.66a.856.856 0 01-.33-.69c0-.12.015-.24.06-.36a.655.655 0 01.6-.42c.135 0 .27.045.396.12.315.195.675.3.975.315.195 0 .325-.045.399-.09a22.4 22.4 0 01-.03-.51l-.003-.06c-.104-1.628-.23-3.654.3-4.847C5.847 1.069 9.204.793 10.194.793h2.012z"/>
          </svg>
        )
      case 'linkedin':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        )
      case 'threads':
        return (
          <svg className={svgClass} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.592 12c.024 3.088.715 5.5 2.053 7.166 1.432 1.781 3.632 2.695 6.54 2.717 2.227-.02 4.358-.631 5.828-2.065 1.202-1.173 1.86-2.775 1.955-4.762.034-.752-.07-1.51-.192-2.073a5.428 5.428 0 00-.98-2.075c-.376-.458-.84-.834-1.394-1.107a4.29 4.29 0 00-.096-.051c.148 1.02.164 2.1.02 3.132-.249 1.773-.896 3.217-1.918 4.266-1.14 1.173-2.697 1.8-4.506 1.822h-.036c-1.592-.02-2.985-.594-4.023-1.66-1.084-1.112-1.643-2.638-1.616-4.41.052-3.405 2.558-5.761 6.09-5.727 1.098.01 2.122.244 3.043.698a.268.268 0 01.003.002c.097-.59.158-1.192.164-1.79l2.12.022c-.01.88-.114 1.77-.313 2.623 1.14.858 1.96 2.063 2.384 3.545.262.917.397 1.96.355 3.016-.115 2.42-.956 4.424-2.5 5.932-1.736 1.695-4.16 2.585-7.01 2.608zm-.09-8.09c1.274-.018 2.166-.48 2.768-1.1.674-.693 1.07-1.694 1.257-3.022a7.264 7.264 0 00-.02-2.143 3.606 3.606 0 00-.462.01c-2.427.024-3.94 1.553-3.972 3.94-.014.93.3 1.72.892 2.263.482.44 1.07.653 1.754.066z"/>
          </svg>
        )
      default:
        return <span className="text-sm font-bold">{slug.charAt(0).toUpperCase()}</span>
    }
  }

  const getPlatformColor = (slug: string) => {
    const colors: Record<string, string> = {
      instagram: 'bg-gradient-to-br from-purple-500 to-pink-500',
      tiktok: 'bg-black',
      youtube: 'bg-red-600',
      twitter: 'bg-gray-900',
      facebook: 'bg-blue-600',
      pinterest: 'bg-red-500',
      snapchat: 'bg-yellow-400',
      linkedin: 'bg-blue-700',
      blog: 'bg-gray-600',
    }
    return colors[slug] || 'bg-gray-500'
  }

  const formatFollowers = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

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
          <div
            className={`w-12 h-12 rounded-lg ${getPlatformColor(account.platform.slug)} flex items-center justify-center text-white font-bold`}
          >
            {getPlatformIcon(account.platform.slug)}
          </div>

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
