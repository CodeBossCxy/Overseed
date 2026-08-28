'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatMonthYear } from '@/lib/i18n/formatDate'

// Default scenic cover shown when the creator hasn't set their own.
const DEFAULT_COVER_IMAGE = '/creator-cover-default.jpg'

const CHIP_STYLES = [
  'bg-blue-50 text-blue-600',
  'bg-purple-50 text-purple-600',
  'bg-emerald-50 text-emerald-600',
  'bg-amber-50 text-amber-600',
]

interface InfluencerProfileProps {
  influencer: {
    id: string
    displayName?: string | null
    avatarUrl?: string | null
    coverImageUrl?: string | null
    bio?: string | null
    primaryNiche?: string | null
    secondaryNiches: string[]
    languages: string[]
    locationCity?: string | null
    locationState?: string | null
    locationCountry?: string | null
    isVerified: boolean
    createdAt: string
    updatedAt?: string
    user: {
      name?: string | null
      image?: string | null
      createdAt: string
    }
    socialAccounts: Array<{
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
      lastSyncedAt?: string | null
      updatedAt?: string
    }>
    completedCampaigns?: number
  }
}

function compactCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function platformTile(name: string) {
  const key = name.toLowerCase()
  const base = 'w-10 h-10 rounded-xl flex items-center justify-center text-xs text-white font-bold flex-shrink-0'
  if (key.includes('instagram')) return <span className={`${base} bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600`}>IG</span>
  if (key.includes('tiktok')) return <span className={`${base} bg-black`}>TT</span>
  if (key.includes('youtube')) return <span className={`${base} bg-red-600`}>▶</span>
  if (key.includes('facebook')) return <span className={`${base} bg-blue-600`}>f</span>
  if (key.includes('twitter') || key.includes('x')) return <span className={`${base} bg-gray-900`}>𝕏</span>
  return <span className={`${base} bg-gray-300`}>{name.charAt(0).toUpperCase()}</span>
}

function sparklineColor(name: string) {
  const key = name.toLowerCase()
  if (key.includes('instagram')) return '#c084fc'
  if (key.includes('tiktok')) return '#2dd4bf'
  if (key.includes('youtube')) return '#f87171'
  return '#93c5fd'
}

// Decorative trend line — deterministic per account id (there is no real
// per-day follower history to plot).
function Sparkline({ seed, color }: { seed: string; color: string }) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const points: number[] = []
  let v = 14 + (h % 8)
  for (let i = 0; i < 16; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    v = Math.min(26, Math.max(4, v + ((h % 9) - 4)))
    points.push(v)
  }
  const step = 120 / (points.length - 1)
  const line = points.map((p, i) => `${(i * step).toFixed(1)},${(30 - p).toFixed(1)}`).join(' ')
  const area = `0,30 ${line} 120,30`
  return (
    <svg viewBox="0 0 120 30" className="w-28 h-8" aria-hidden>
      <polygon points={area} fill={color} opacity={0.15} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function InfluencerProfile({ influencer }: InfluencerProfileProps) {
  const { locale } = useLanguage()
  const zh = locale === 'zh'
  const [showAll, setShowAll] = useState(false)

  const displayName = influencer.displayName || influencer.user.name || 'Unknown'
  const avatar = influencer.avatarUrl || influencer.user.image

  const location = [influencer.locationCity, influencer.locationState, influencer.locationCountry]
    .filter(Boolean)
    .join(', ')

  const allNiches = [influencer.primaryNiche, ...influencer.secondaryNiches].filter(Boolean) as string[]
  const accounts = influencer.socialAccounts
  const visibleAccounts = showAll ? accounts : accounts.slice(0, 3)

  const lastUpdatedRaw = accounts
    .flatMap((a) => [a.lastSyncedAt, a.updatedAt])
    .filter(Boolean)
    .sort()
    .pop() as string | undefined

  const lastUpdated = lastUpdatedRaw
    ? new Date(lastUpdatedRaw).toLocaleString(zh ? 'zh-CN' : 'en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  const stats = [
    {
      label: zh ? '总粉丝数' : 'Total Followers',
      value: accounts.reduce((sum, acc) => sum + acc.followerCount, 0).toLocaleString(),
      icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3M3 8a3 3 0 103 3',
      tint: 'bg-blue-50 text-blue-500',
    },
    {
      label: zh ? '平台数' : 'Platforms',
      value: String(accounts.length),
      icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
      tint: 'bg-indigo-50 text-indigo-500',
    },
    {
      label: zh ? '活动数' : 'Campaigns',
      value: String(influencer.completedCampaigns || 0),
      icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
      tint: 'bg-violet-50 text-violet-500',
    },
    {
      label: zh ? '已认证' : 'Verified',
      value: influencer.isVerified ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No'),
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      tint: 'bg-emerald-50 text-emerald-500',
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        {/* Photo cover — plain block img with its own height so the header
            never collapses even if the asset fails to load */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={influencer.coverImageUrl || DEFAULT_COVER_IMAGE} alt="" className="block w-full h-36 sm:h-40 object-cover bg-gradient-to-r from-primary-400 to-primary-600" />

        <div className="px-6 pb-6">
          {/* Avatar straddling the cover, name beside it on the white area */}
          <div className="flex items-end gap-5 -mt-14 mb-4">
            <div className="w-28 h-28 rounded-full border-4 border-white bg-gray-200 overflow-hidden shadow-lg flex-shrink-0">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                  {displayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 -mb-2">
              <div className="flex items-center gap-2">
                {/* h2, not h1: the workspace shell absolutely-positions every
                    `main h1` into the shared page-title slot (globals.css) */}
                <h2 className="text-2xl font-bold text-gray-900 truncate">{displayName}</h2>
                {influencer.isVerified && (
                  <svg className="w-6 h-6 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mt-1">
                {location && (
                  <>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {location}
                    </span>
                    <span className="text-gray-300">|</span>
                  </>
                )}
                <span>
                  {zh ? '加入于 ' : 'Member since '}{formatMonthYear(influencer.user.createdAt, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Niches */}
          {allNiches.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {allNiches.map((niche, i) => (
                <span key={i} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${CHIP_STYLES[i % CHIP_STYLES.length]}`}>
                  {niche}
                </span>
              ))}
            </div>
          )}

          {/* Languages */}
          {influencer.languages.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <span className="font-medium text-gray-900">{zh ? '语言：' : 'Languages:'}</span>
              <span>{influencer.languages.join(', ')}</span>
            </div>
          )}

          {/* Bio */}
          {influencer.bio && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{zh ? '关于' : 'About'}</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{influencer.bio}</p>
            </div>
          )}

          {/* Stats strip */}
          <div className="border border-gray-100 rounded-xl grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x-0 md:divide-x divide-gray-100">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3 px-5 py-4">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${s.tint}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-gray-900 leading-tight truncate">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Connected Platforms */}
      <div className="mt-6 bg-white rounded-2xl shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{zh ? '已连接平台' : 'Connected Platforms'}</h3>
          {lastUpdated && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              {zh ? '最近更新：' : 'Last updated: '}{lastUpdated}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </span>
          )}
        </div>

        {accounts.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{zh ? '尚未关联社交账号。' : 'No social accounts linked yet.'}</p>
        ) : (
          <>
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
              {visibleAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-4 px-4 py-3.5">
                  {platformTile(acc.platform.name)}
                  <div className="min-w-0 w-40 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{acc.platform.name}</p>
                    <p className="text-xs text-gray-500 truncate">@{acc.username}</p>
                  </div>
                  <div className="w-24 flex-shrink-0 hidden sm:block">
                    <p className="text-sm font-semibold text-gray-900">{compactCount(acc.followerCount)}</p>
                    <p className="text-xs text-gray-500">{zh ? '粉丝' : 'Followers'}</p>
                  </div>
                  <div className="w-24 flex-shrink-0 hidden sm:block">
                    <p className="text-sm font-semibold text-gray-900">
                      {acc.engagementRate != null ? `${Number(acc.engagementRate)}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-500">{zh ? '互动率' : 'Engagement'}</p>
                  </div>
                  <div className="flex-1 hidden lg:flex justify-center">
                    <Sparkline seed={acc.id} color={sparklineColor(acc.platform.name)} />
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    {acc.profileUrl ? (
                      <a
                        href={acc.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-700 transition whitespace-nowrap"
                      >
                        {zh ? '查看数据' : 'View analytics'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {accounts.length > 3 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-4 mx-auto flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition"
              >
                {showAll ? (zh ? '收起' : 'Show less') : (zh ? '查看全部平台' : 'View all platforms')}
                <svg className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
