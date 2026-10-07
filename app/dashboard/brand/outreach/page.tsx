'use client'

import { useEffect, useState } from 'react'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'

interface OutreachItem {
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

const STATUS_BADGE: Record<string, { en: string; zh: string; cls: string }> = {
  DRAFT:     { en: 'Draft',      zh: '草稿',   cls: 'bg-gray-100 text-gray-600' },
  SELECTING: { en: 'Selecting',  zh: '筛选中', cls: 'bg-yellow-100 text-yellow-700' },
  READY:     { en: 'Ready',      zh: '就绪',   cls: 'bg-blue-100 text-blue-700' },
  SENDING:   { en: 'Sending',    zh: '发送中', cls: 'bg-orange-100 text-orange-700' },
  COMPLETED: { en: 'Active',     zh: '进行中', cls: 'bg-green-100 text-green-700' },
  FAILED:    { en: 'Failed',     zh: '失败',   cls: 'bg-red-100 text-red-700' },
  CANCELLED: { en: 'Cancelled',  zh: '已取消', cls: 'bg-gray-100 text-gray-500' },
}

export default function OutreachListPage() {
  const { locale } = useLanguage()
  const zh = locale === 'zh'
  const [items, setItems] = useState<OutreachItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/outreach')
      .then((r) => r.json())
      .then((data) => setItems(data.campaigns ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(zh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

  const hasItems = items.length > 0

  const maintenanceMode = false // set to true to temporarily disable mass outreach

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ---- Page header ---- */}
        <div>
          <p className="text-xs font-bold tracking-widest text-primary-600 uppercase mb-1">
            {zh ? '批量触达' : 'MASS OUTREACH'}
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            {zh ? '批量触达' : 'Mass Outreach'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {zh
              ? '向达人大规模发送个性化合作邀请。'
              : 'Send personalized collaboration invitations to creators at scale.'}
          </p>
        </div>

        {/* ---- Maintenance banner ---- */}
        {maintenanceMode && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-6 py-5">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 mt-0.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
              <div>
                <h3 className="text-base font-bold text-amber-800">
                  {zh ? '批量触达功能维护中' : 'Mass Outreach Under Maintenance'}
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  {zh
                    ? '我们正在升级批量触达引擎，以提供更精准的创作者匹配和更丰富的数据。功能恢复后，我们将通过邮件通知所有用户。感谢您的耐心等待！'
                    : 'We are upgrading our mass outreach engine to deliver more accurate creator matching and richer data. We will notify all users via email when the feature is back. Thank you for your patience!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ---- Hero banner ---- */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-50 via-orange-50 to-rose-50 border border-primary-100 px-8 py-10 md:px-12 md:py-12 ${maintenanceMode ? 'opacity-40 pointer-events-none select-none' : ''}`}>
          <div className="max-w-lg relative z-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
              {zh ? '将创意变成合作' : 'Turn ideas into partnerships'}
            </h2>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              {zh
                ? '发起批量触达，让 AI 为您的品牌找到最匹配的达人并发送个性化邀请。'
                : 'Launch a mass outreach and let AI find the best creators for your brand.'}
            </p>
            <Link
              href="/dashboard/brand/outreach/new"
              className="mt-6 inline-flex items-center gap-2 bg-primary-600 text-white rounded-xl px-7 py-3.5 font-semibold hover:bg-primary-700 transition shadow-sm"
            >
              {zh
                ? hasItems ? '+ 新建触达' : '创建您的第一个触达'
                : hasItems ? '+ New Outreach' : 'Create Your First Outreach'}
              <span aria-hidden>→</span>
            </Link>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-64 h-64 rounded-full bg-gradient-to-br from-primary-200/30 to-orange-200/30 blur-2xl" />
          <div className="absolute right-24 bottom-0 w-40 h-40 rounded-full bg-gradient-to-br from-rose-200/30 to-primary-200/20 blur-xl" />
        </div>

        {/* ---- How it works ---- */}
        {!hasItems && (
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {zh ? '如何运作' : 'How it works'}
            </h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              {zh ? '从想法到触达，只需几步。' : 'Get from idea to outreach in a few simple steps.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  n: 1,
                  icon: (
                    <svg className="w-7 h-7 text-primary-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  ),
                  en: 'Define your outreach',
                  enDesc: 'Set your goals, audience and preferences.',
                  zh: '定义您的触达',
                  zhDesc: '设定目标、受众和偏好。',
                },
                {
                  n: 2,
                  icon: (
                    <svg className="w-7 h-7 text-primary-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  ),
                  en: 'AI finds the best creators',
                  enDesc: 'Our AI matches you with relevant creators at scale.',
                  zh: 'AI 寻找最佳达人',
                  zhDesc: 'AI 为您大规模匹配相关达人。',
                },
                {
                  n: 3,
                  icon: (
                    <svg className="w-7 h-7 text-primary-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  ),
                  en: 'Send personalized invites',
                  enDesc: 'Reach out with tailored messages in one click.',
                  zh: '发送个性化邀请',
                  zhDesc: '一键发送定制化消息。',
                },
                {
                  n: 4,
                  icon: (
                    <svg className="w-7 h-7 text-primary-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                    </svg>
                  ),
                  en: 'Track and manage',
                  enDesc: 'Monitor responses and move creators to the next step.',
                  zh: '跟踪与管理',
                  zhDesc: '监控回复并推进合作。',
                },
              ].map((s) => (
                <div key={s.n} className="workspace-glass-card rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold">
                      {s.n}
                    </span>
                    {s.icon}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{zh ? s.zh : s.en}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{zh ? s.zhDesc : s.enDesc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Recent outreach list ---- */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hasItems && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {zh ? '最近的触达' : 'Recent Outreach'}
              </h2>
              {items.length > 5 && (
                <Link
                  href="/dashboard/brand/outreach"
                  className="text-sm text-primary-600 font-medium hover:underline inline-flex items-center gap-1"
                >
                  {zh ? '查看全部' : 'View All'} →
                </Link>
              )}
            </div>

            <div className="workspace-glass-card rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-3 font-medium">{zh ? '触达名称' : 'Outreach Name'}</th>
                    <th className="px-5 py-3 font-medium">{zh ? '目标受众' : 'Target Audience'}</th>
                    <th className="px-5 py-3 font-medium text-right">{zh ? '已触达' : 'Creators Reached'}</th>
                    <th className="px-5 py-3 font-medium text-right">{zh ? '状态' : 'Status'}</th>
                    <th className="px-5 py-3 font-medium text-right">{zh ? '创建时间' : 'Created At'}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 10).map((c) => {
                    const badge = STATUS_BADGE[c.status] ?? { en: c.status, zh: c.status, cls: 'bg-gray-100 text-gray-600' }
                    const platformLabel: Record<string, string> = {
                      instagram: 'Instagram',
                      youtube: 'YouTube',
                      tiktok: 'TikTok',
                      twitter: 'X / Twitter',
                      twitch: 'Twitch',
                      onlyfans: 'OnlyFans',
                    }
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition"
                        onClick={() => window.location.href = `/dashboard/brand/outreach/${c.id}`}
                      >
                        <td className="px-5 py-4">
                          <span className="font-medium text-gray-900">{c.title}</span>
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {platformLabel[c.platform] || c.platform}
                          {c.quantity > 0 && ` · ${c.quantity} ${zh ? '位' : 'creators'}`}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-gray-700">
                          {c.totalSent > 0 ? c.totalSent.toLocaleString() : '—'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
                            {zh ? badge.zh : badge.en}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-gray-400 text-xs">
                          {formatDate(c.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </BrandWorkspaceLayout>
  )
}
