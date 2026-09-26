'use client'

import { useEffect, useState } from 'react'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'

interface OutreachCampaignItem {
  id: string
  title: string
  status: string
  quantity: number
  platform: string
  totalSent: number
  totalFailed: number
  creditsCost: number
  recipientCount: number
  createdAt: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  SELECTING: { label: 'Selecting', className: 'bg-yellow-100 text-yellow-700' },
  READY: { label: 'Ready', className: 'bg-blue-100 text-blue-700' },
  SENDING: { label: 'Sending', className: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
}

export default function OutreachCampaignListPage() {
  const { locale } = useLanguage()
  const [campaigns, setCampaigns] = useState<OutreachCampaignItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/outreach')
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data.campaigns ?? [])
      })
      .catch(() => {
        setCampaigns([])
      })
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mass Outreach</h1>
            <p className="mt-1 text-sm text-gray-500">
              Send personalized collaboration invitations to creators at scale
            </p>
          </div>
          <Link
            href="/dashboard/brand/outreach/new"
            className="bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition"
          >
            + New Campaign
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="workspace-glass-card rounded-3xl p-16 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl">
              📨
            </div>
            <h2 className="text-lg font-semibold text-gray-900">No outreach campaigns yet</h2>
            <p className="text-sm text-gray-500 max-w-sm">
              Launch your first mass outreach campaign and let AI find the best creators for your brand.
            </p>
            <Link
              href="/dashboard/brand/outreach/new"
              className="bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition"
            >
              Create Your First Campaign
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const badge = STATUS_BADGE[c.status] ?? { label: c.status, className: 'bg-gray-100 text-gray-600' }
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/brand/outreach/${c.id}`}
                  className="workspace-glass-card rounded-3xl p-5 flex items-center gap-5 hover:shadow-md transition block"
                >
                  {/* Platform icon */}
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary-600">
                    {(PLATFORM_LABEL[c.platform] ?? c.platform).charAt(0).toUpperCase()}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">{c.title}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                      <span>{PLATFORM_LABEL[c.platform] ?? c.platform}</span>
                      <span>Qty: {c.quantity}</span>
                      <span>{c.recipientCount} selected</span>
                      {c.totalSent > 0 && <span>{c.totalSent} sent</span>}
                      {c.totalFailed > 0 && <span className="text-red-500">{c.totalFailed} failed</span>}
                    </div>
                  </div>

                  {/* Right meta */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-400">{formatDate(c.createdAt)}</div>
                    {c.creditsCost > 0 && (
                      <div className="text-xs text-primary-600 font-medium mt-0.5">{c.creditsCost} credits</div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </BrandWorkspaceLayout>
  )
}
