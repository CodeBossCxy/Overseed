'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import StatusBadge from '@/components/StatusBadge'

// Campaign Pipeline per spec: one card per campaign (campaign · status ·
// applications · deadline · Manage Campaign), searchable/filterable with
// pagination instead of a separate "view all".

interface Campaign {
  id: string
  title: string
  description: string | null
  status: string
  totalSlots: number
  filledSlots: number
  deadline: string | null
  publishedAt: string | null
  updatedAt: string
  createdAt: string
  images: string[]
  categories: { category: { id: number; name: string } }[]
  platforms: { platform: { id: number; name: string } }[]
  _count: { applications: number }
}

const PAGE_SIZE = 10
const STATUS_OPTIONS = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'COMPLETED', 'CANCELLED']

export default function BrandCampaignsClient({ campaigns }: { campaigns: Campaign[] }) {
  const { t, locale } = useLanguage()
  const c = t.brand.campaigns

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<'deadline' | 'newest'>('deadline')
  const [page, setPage] = useState(1)

  const statusLabel = (status: string) => {
    const keyMap: Record<string, string> = {
      DRAFT: 'draft', PENDING_REVIEW: 'inReview', ACTIVE: 'live', PAUSED: 'paused', COMPLETED: 'closed', CANCELLED: 'cancelled',
    }
    return (t.status as any)?.campaign?.[keyMap[status]] ?? status
  }

  const visible = useMemo(() => {
    let list = [...campaigns]
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (cp) => cp.title?.toLowerCase().includes(q) || cp.description?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) list = list.filter((cp) => cp.status === statusFilter)
    if (sort === 'deadline') {
      list.sort((a, b) => {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
        return da - db
      })
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return list
  }, [campaigns, query, statusFilter, sort])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const deadlineInfo = (cp: Campaign) => {
    if (cp.status === 'COMPLETED') return { caption: c.closedOn, extra: '' }
    if (cp.status === 'CANCELLED') return { caption: c.cancelledOn, extra: '' }
    if (!cp.deadline) return null
    const days = Math.ceil((new Date(cp.deadline).getTime() - Date.now()) / 86400000)
    return { caption: null, extra: days >= 0 ? `${days} ${c.daysLeft}` : '' }
  }

  return (
    <div className="max-w-6xl mx-auto pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{c.title}</h1>
          <p className="text-gray-500 mt-1">{c.subtitle}</p>
        </div>
        <Link
          href="/dashboard/brand/campaigns/new"
          className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 transition"
        >
          {c.createCampaign}
        </Link>
      </div>

      {/* Toolbar */}
      <div className="mb-6 bg-white/70 backdrop-blur rounded-2xl shadow-sm px-5 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder={c.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 bg-white rounded-full text-sm border border-transparent focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="">{c.allStatuses}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as any); setPage(1) }}
            className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="deadline">{c.sortDeadlineSoonest}</option>
            <option value="newest">{c.sortNewest}</option>
          </select>
        </div>
      </div>

      {/* Campaign cards */}
      {campaigns.length === 0 ? (
        <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">{c.noCampaigns}</p>
          <p className="text-gray-400 mb-6">{c.noCampaignsDesc}</p>
          <Link
            href="/dashboard/brand/campaigns/new"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition"
          >
            {c.createFirst}
          </Link>
        </div>
      ) : paged.length === 0 ? (
        <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-10 text-center text-gray-500">{c.noMatches}</div>
      ) : (
        <div className="space-y-4">
          {paged.map((cp) => {
            const dl = deadlineInfo(cp)
            return (
              <div key={cp.id} className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-5">
                {/* Thumb + title */}
                <div className="flex items-center gap-4 flex-1 min-w-0 lg:max-w-md">
                  <div className="w-24 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    {cp.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cp.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-lg">
                        {cp.title.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/dashboard/brand/campaigns/${cp.id}`} className="text-lg font-bold text-gray-900 hover:text-primary-700 transition block truncate">
                      {cp.title}
                    </Link>
                    <p className="text-xs text-gray-500 truncate">
                      {[
                        cp.categories?.[0] ? t.categoryNames[cp.categories[0].category?.name] || cp.categories[0].category?.name : null,
                        (cp.platforms || []).map((p) => p.platform.name).join(', ') || null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {cp.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cp.description}</p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="lg:w-32 flex-shrink-0">
                  <p className="text-xs text-gray-400 mb-1.5">{t.brand.campaigns.thStatus}</p>
                  <StatusBadge machine="campaign" status={cp.status} size="sm" />
                  {cp.status === 'ACTIVE' && cp.publishedAt && (
                    <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {c.liveSince} {formatDate(cp.publishedAt, locale)}
                    </p>
                  )}
                </div>

                {/* Applications */}
                <div className="lg:w-32 flex-shrink-0">
                  <p className="text-xs text-gray-400 mb-1">{t.brand.campaigns.thApplications}</p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{cp._count.applications}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{c.creatorsApplied}</p>
                </div>

                {/* Deadline */}
                <div className="lg:w-36 flex-shrink-0">
                  <p className="text-xs text-gray-400 mb-1">{c.ddlLabel}</p>
                  {cp.deadline ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(cp.deadline, locale)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {cp.status === 'COMPLETED'
                          ? statusLabel('COMPLETED')
                          : cp.status === 'CANCELLED'
                            ? statusLabel('CANCELLED')
                            : dl?.extra}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">{c.noDeadline}</p>
                  )}
                </div>

                {/* Action */}
                <div className="flex-shrink-0">
                  <Link
                    href={`/dashboard/brand/campaigns/${cp.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white shadow-sm rounded-xl text-sm font-semibold text-gray-800 hover:text-primary-700 hover:shadow transition"
                  >
                    {c.manageCampaign}
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="w-9 h-9 rounded-full bg-white shadow-sm text-gray-600 disabled:opacity-40 hover:text-primary-700 transition"
            aria-label="Previous page"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`w-9 h-9 rounded-full text-sm font-semibold transition ${
                n === safePage ? 'bg-primary-600 text-white shadow-sm' : 'bg-white shadow-sm text-gray-600 hover:text-primary-700'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="w-9 h-9 rounded-full bg-white shadow-sm text-gray-600 disabled:opacity-40 hover:text-primary-700 transition"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
