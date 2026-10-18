'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'
import CreatorAvatar from '@/components/ui/CreatorAvatar'

const STATUS_BADGE: Record<string, { en: string; zh: string; cls: string }> = {
  DRAFT:     { en: 'Draft',      zh: '草稿',   cls: 'bg-gray-100 text-gray-600' },
  SELECTING: { en: 'Selecting',  zh: '筛选中', cls: 'bg-yellow-100 text-yellow-700' },
  READY:     { en: 'Ready',      zh: '就绪',   cls: 'bg-blue-100 text-blue-700' },
  SENDING:   { en: 'Sending',    zh: '发送中', cls: 'bg-orange-100 text-orange-700' },
  COMPLETED: { en: 'Active',     zh: '进行中', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  FAILED:    { en: 'Failed',     zh: '失败',   cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  CANCELLED: { en: 'Cancelled',  zh: '已取消', cls: 'bg-gray-100 text-gray-500' },
  PENDING:   { en: 'Pending',    zh: '待发送', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  SENT:      { en: 'Sent',       zh: '已发送', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  DELIVERED: { en: 'Delivered',  zh: '已送达', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
}

const PLATFORM_ICON: Record<string, string> = {
  instagram: 'https://cdn.simpleicons.org/instagram/E4405F',
  tiktok: 'https://cdn.simpleicons.org/tiktok/000000',
  youtube: 'https://cdn.simpleicons.org/youtube/FF0000',
  twitter: 'https://cdn.simpleicons.org/x/000000',
}

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function profileUrl(platform: string, handle: string) {
  switch (platform) {
    case 'instagram': return `https://instagram.com/${handle}`
    case 'tiktok': return `https://tiktok.com/@${handle}`
    case 'youtube': return `https://youtube.com/@${handle}`
    case 'twitter': return `https://x.com/${handle}`
    default: return null
  }
}

interface Recipient {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  platform: string
  followerCount: number | null
  engagementRate: number | null
  matchScore: number | null
  matchReason: string | null
  status: string
  sentAt: string | null
  errorMessage: string | null
}

interface Campaign {
  id: string
  title: string
  briefMessage: string
  status: string
  platform: string
  quantity: number
  totalSent: number
  totalFailed: number
  creditsCost: number
  createdAt: string
  completedAt: string | null
  recipients: Recipient[]
}

export default function OutreachDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { locale } = useLanguage()
  const zh = locale === 'zh'

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/outreach/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((data) => setCampaign(data.campaign))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <BrandWorkspaceLayout>
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </BrandWorkspaceLayout>
    )
  }

  if (error || !campaign) {
    return (
      <BrandWorkspaceLayout>
        <div className="text-center py-20">
          <p className="text-red-500 mb-4">{error || 'Campaign not found'}</p>
          <Link href="/dashboard/brand/outreach" className="text-primary-600 hover:underline">
            {zh ? '返回列表' : 'Back to list'}
          </Link>
        </div>
      </BrandWorkspaceLayout>
    )
  }

  const badge = STATUS_BADGE[campaign.status] || STATUS_BADGE.DRAFT
  const platformIcon = PLATFORM_ICON[campaign.platform]
  const sentCount = campaign.totalSent
  const failedCount = campaign.totalFailed
  const pendingCount = campaign.quantity - sentCount - failedCount

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Back link */}
        <Link href="/dashboard/brand/outreach" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-600 transition group">
          <svg className="w-4 h-4 transition group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {zh ? '所有外联' : 'All Outreach'}
        </Link>

        {/* ── Header card ── */}
        <div className="workspace-glass-card rounded-3xl overflow-hidden">
          {/* Top banner gradient */}
          <div className="h-2 bg-gradient-to-r from-primary-500 via-rose-400 to-orange-400" />

          <div className="p-6 pb-5">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {platformIcon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={platformIcon} alt={campaign.platform} className="w-8 h-8 flex-shrink-0 opacity-80" />
                )}
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-gray-900 truncate">{campaign.title}</h1>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {zh ? '创建于' : 'Created'} {formatDate(campaign.createdAt, locale)}
                    {campaign.completedAt && (
                      <> &middot; {zh ? '完成于' : 'Completed'} {formatDate(campaign.completedAt, locale)}</>
                    )}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${badge.cls}`}>
                {zh ? badge.zh : badge.en}
              </span>
            </div>

            {/* Stats strip */}
            <div className="mt-5 flex items-center gap-2 flex-wrap">
              <StatPill label={zh ? '目标' : 'Target'} value={campaign.quantity} color="text-gray-700" bg="bg-gray-100" />
              <StatPill label={zh ? '已发送' : 'Sent'} value={sentCount} color="text-emerald-700" bg="bg-emerald-50" />
              {failedCount > 0 && (
                <StatPill label={zh ? '失败' : 'Failed'} value={failedCount} color="text-red-600" bg="bg-red-50" />
              )}
              {pendingCount > 0 && (
                <StatPill label={zh ? '待处理' : 'Pending'} value={pendingCount} color="text-amber-700" bg="bg-amber-50" />
              )}
              {campaign.creditsCost > 0 && (
                <StatPill label={zh ? '积分' : 'Credits'} value={campaign.creditsCost} color="text-primary-700" bg="bg-primary-50" icon="⚡" />
              )}
            </div>
          </div>
        </div>

        {/* ── Two-column: Brief + Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Brief — spans 2 cols */}
          <div className="lg:col-span-2 workspace-glass-card rounded-3xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {zh ? '外联内容' : 'Outreach Brief'}
            </h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {campaign.briefMessage}
            </div>
          </div>

          {/* Quick actions */}
          <div className="workspace-glass-card rounded-3xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {zh ? '操作' : 'Actions'}
            </h3>
            <Link
              href="/dashboard/messages"
              className="flex items-center gap-2.5 px-4 py-3 bg-white/70 border border-white/80 rounded-xl text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm transition"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              {zh ? '查看消息' : 'View Messages'}
            </Link>
          </div>
        </div>

        {/* ── Recipients ── */}
        <div className="workspace-glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              {zh ? '创作者列表' : 'Recipients'}
            </h2>
            <span className="text-xs font-medium text-gray-400 bg-white/60 px-2.5 py-1 rounded-full">
              {campaign.recipients.length} {zh ? '位创作者' : 'creators'}
            </span>
          </div>

          {campaign.recipients.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">{zh ? '暂无创作者' : 'No recipients yet'}</p>
          ) : (
            <div className="divide-y divide-gray-100/80">
              {campaign.recipients.map((r) => {
                const rBadge = STATUS_BADGE[r.status] || STATUS_BADGE.PENDING
                const url = profileUrl(r.platform, r.handle)
                const rPlatformIcon = PLATFORM_ICON[r.platform]
                return (
                  <div key={r.id} className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <CreatorAvatar url={r.avatarUrl} name={r.displayName || r.handle || '?'} size="w-11 h-11" textSize="text-sm" className="ring-2 ring-white shadow-sm" />
                      {rPlatformIcon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rPlatformIcon}
                          alt=""
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white p-[2px]"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {r.displayName || r.handle}
                        </span>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-primary-500 transition truncate">
                            @{r.handle}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 truncate">@{r.handle}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        {r.followerCount ? (
                          <span>{formatFollowers(r.followerCount)} {zh ? '粉丝' : 'followers'}</span>
                        ) : null}
                        {r.engagementRate != null && Number(r.engagementRate) > 0 && (
                          <span>{Number(r.engagementRate).toFixed(1)}% {zh ? '互动' : 'eng.'}</span>
                        )}
                        {r.matchScore != null && (
                          <span className="text-primary-500 font-medium">{zh ? '匹配' : 'Match'} {Number(r.matchScore)}%</span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${rBadge.cls}`}>
                        {zh ? rBadge.zh : rBadge.en}
                      </span>
                      {r.sentAt && (
                        <span className="text-[10px] text-gray-400">
                          {formatDate(r.sentAt, locale)}
                        </span>
                      )}
                      {r.errorMessage && (
                        <span className="text-[10px] text-red-400 truncate max-w-36" title={r.errorMessage}>
                          {r.errorMessage}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </BrandWorkspaceLayout>
  )
}

/* ── Stat pill sub-component ── */
function StatPill({ label, value, color, bg, icon }: { label: string; value: number; color: string; bg: string; icon?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${bg}`}>
      {icon && <span className="text-xs">{icon}</span>}
      <span className={`font-bold ${color}`}>{value}</span>
      <span className="text-gray-500 text-xs">{label}</span>
    </div>
  )
}
