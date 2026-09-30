'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'

const STATUS_BADGE: Record<string, { en: string; zh: string; cls: string }> = {
  DRAFT:     { en: 'Draft',      zh: '草稿',   cls: 'bg-gray-100 text-gray-600' },
  SELECTING: { en: 'Selecting',  zh: '筛选中', cls: 'bg-yellow-100 text-yellow-700' },
  READY:     { en: 'Ready',      zh: '就绪',   cls: 'bg-blue-100 text-blue-700' },
  SENDING:   { en: 'Sending',    zh: '发送中', cls: 'bg-orange-100 text-orange-700' },
  COMPLETED: { en: 'Active',     zh: '进行中', cls: 'bg-green-100 text-green-700' },
  FAILED:    { en: 'Failed',     zh: '失败',   cls: 'bg-red-100 text-red-700' },
  CANCELLED: { en: 'Cancelled',  zh: '已取消', cls: 'bg-gray-100 text-gray-500' },
  PENDING:   { en: 'Pending',    zh: '待发送', cls: 'bg-gray-100 text-gray-600' },
  SENT:      { en: 'Sent',       zh: '已发送', cls: 'bg-green-100 text-green-700' },
  DELIVERED: { en: 'Delivered',  zh: '已送达', cls: 'bg-green-100 text-green-700' },
}

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
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

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link href="/dashboard/brand/outreach" className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {zh ? '返回' : 'Back'}
        </Link>

        {/* Header */}
        <div className="workspace-glass-card rounded-3xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{campaign.title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {campaign.platform} &middot; {new Date(campaign.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.cls}`}>
              {zh ? badge.zh : badge.en}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/60 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{campaign.quantity}</p>
              <p className="text-xs text-gray-500">{zh ? '目标数量' : 'Target'}</p>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{campaign.totalSent}</p>
              <p className="text-xs text-gray-500">{zh ? '已发送' : 'Sent'}</p>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{campaign.totalFailed}</p>
              <p className="text-xs text-gray-500">{zh ? '失败' : 'Failed'}</p>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{campaign.creditsCost}</p>
              <p className="text-xs text-gray-500">{zh ? '消耗积分' : 'Credits used'}</p>
            </div>
          </div>

          {/* Brief */}
          <div className="bg-white/50 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{zh ? '外联内容' : 'Outreach Brief'}</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{campaign.briefMessage}</p>
          </div>
        </div>

        {/* Recipients */}
        <div className="workspace-glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {zh ? '创作者列表' : 'Recipients'}
            </h2>
            <span className="text-sm text-gray-500">
              {campaign.recipients.length} {zh ? '位创作者' : 'creators'}
            </span>
          </div>

          {campaign.recipients.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{zh ? '暂无创作者' : 'No recipients yet'}</p>
          ) : (
            <div className="space-y-3">
              {campaign.recipients.map((r) => {
                const rBadge = STATUS_BADGE[r.status] || STATUS_BADGE.PENDING
                return (
                  <div key={r.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/60">
                    {r.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {(r.displayName || r.handle || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{r.displayName || r.handle}</span>
                        <span className="text-xs text-gray-400">@{r.handle}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                        <span>{r.followerCount ? formatFollowers(r.followerCount) : '—'} {zh ? '粉丝' : 'followers'}</span>
                        {r.engagementRate != null && Number(r.engagementRate) > 0 && (
                          <span>{Number(r.engagementRate).toFixed(1)}% {zh ? '互动率' : 'eng.'}</span>
                        )}
                        {r.matchScore != null && (
                          <span className="text-primary-600 font-semibold">{zh ? '匹配' : 'Match'}: {Number(r.matchScore)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${rBadge.cls}`}>
                        {zh ? rBadge.zh : rBadge.en}
                      </span>
                      {r.sentAt && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(r.sentAt).toLocaleString()}
                        </span>
                      )}
                      {r.errorMessage && (
                        <span className="text-[10px] text-red-400 truncate max-w-32">{r.errorMessage}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-6">
          <Link
            href="/dashboard/messages"
            className="px-6 py-3 bg-white/60 border border-white/80 rounded-xl text-sm font-semibold text-gray-700 hover:bg-white/80 transition"
          >
            {zh ? '查看消息' : 'View Messages'}
          </Link>
          <Link
            href="/dashboard/brand/outreach/new"
            className="px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition"
          >
            {zh ? '创建新外联' : 'New Outreach'}
          </Link>
        </div>
      </div>
    </BrandWorkspaceLayout>
  )
}
