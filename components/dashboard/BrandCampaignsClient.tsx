'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

  const router = useRouter()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<'deadline' | 'newest'>('deadline')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [deleting, setDeleting] = useState(false)

  const removeCampaign = async (mode: 'delete' | 'cancel') => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/campaigns/${deleteTarget.id}${mode === 'cancel' ? '?mode=cancel' : ''}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        setDeleteTarget(null)
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

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

  const statusCaption = (cp: Campaign) => {
    if (cp.status === 'ACTIVE' && cp.publishedAt) {
      return `${c.liveSince} ${formatDate(cp.publishedAt, locale)}`
    }
    if (cp.status === 'COMPLETED') {
      return `${c.closedOn} ${formatDate(cp.updatedAt, locale)}`
    }
    if (cp.status === 'CANCELLED') {
      return `${c.cancelledOn} ${formatDate(cp.updatedAt, locale)}`
    }
    return null
  }

  const statusDotClass = (status: string) =>
    status === 'ACTIVE' ? 'bg-emerald-400'
      : status === 'COMPLETED' ? 'bg-blue-500'
        : status === 'CANCELLED' ? 'bg-red-500'
          : 'bg-gray-300'

  return (
    <div className="max-w-7xl mx-auto workspace-page-tight pb-8">
      {/* Header */}
      <div className="mb-7">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{c.title}</h1>
          <p className="text-gray-500 mt-1">{c.subtitle}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:w-[320px]">
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder={c.searchPlaceholder}
            className="h-11 w-full pl-10 pr-4 workspace-glass-control text-sm focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-11 min-w-[180px] px-5 workspace-glass-control text-sm font-medium text-gray-700 focus:outline-none"
          >
            <option value="">{c.allStatuses}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <button
            type="button"
            className="h-11 w-11 inline-flex items-center justify-center workspace-glass-control text-gray-600 transition hover:text-gray-900"
            aria-label="Filter"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
            </svg>
          </button>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as any); setPage(1) }}
            className="h-11 min-w-[230px] px-5 workspace-glass-control text-sm font-medium text-gray-700 focus:outline-none"
          >
            <option value="deadline">{locale === 'zh' ? '排序：' : 'Sort by: '}{c.sortDeadlineSoonest}</option>
            <option value="newest">{locale === 'zh' ? '排序：' : 'Sort by: '}{c.sortNewest}</option>
          </select>
        </div>
      </div>

      {/* Campaign cards */}
      {campaigns.length === 0 ? (
        <div className="workspace-glass-card rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">{c.noCampaigns}</p>
          <p className="text-gray-400 mb-6">{c.noCampaignsDesc}</p>
          <Link
            href="/dashboard/brand/campaigns/new"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition"
          >
            {c.createFirst}
          </Link>
        </div>
      ) : paged.length === 0 ? (
        <div className="workspace-glass-card rounded-2xl p-10 text-center text-gray-500">{c.noMatches}</div>
      ) : (
        <div className="space-y-3">
          {paged.map((cp) => {
            const dl = deadlineInfo(cp)
            const caption = statusCaption(cp)
            return (
              <Link
                key={cp.id}
                href={`/dashboard/brand/campaigns/${cp.id}`}
                aria-label={`${c.manageCampaign}: ${cp.title}`}
                className="group workspace-glass-card workspace-glass-option rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8 min-h-[108px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {/* Thumb + title */}
                <div className="flex items-center gap-5 flex-1 min-w-0 lg:max-w-[440px]">
                  <div className="w-28 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
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
                    <span className="text-base font-semibold text-gray-900 group-hover:text-primary-700 transition block truncate">
                      {cp.title}
                    </span>
                    <p className="text-xs text-gray-500 truncate">
                      {[
                        cp.categories?.[0] ? t.categoryNames[cp.categories[0].category?.name] || cp.categories[0].category?.name : null,
                        (cp.platforms || []).map((p) => p.platform.name).join(', ') || null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {cp.description && (
                      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2 max-w-[300px]">{cp.description}</p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="lg:w-36 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-600 mb-2">{t.brand.campaigns.thStatus}</p>
                  <StatusBadge machine="campaign" status={cp.status} size="sm" />
                  {caption && (
                    <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(cp.status)}`} />
                      {caption}
                    </p>
                  )}
                </div>

                {/* Applications */}
                <div className="lg:w-36 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-600 mb-2">{t.brand.campaigns.thApplications}</p>
                  <p className="text-2xl font-semibold text-gray-900 tabular-nums leading-none">{cp._count.applications}</p>
                  <p className="text-[11px] text-gray-500 mt-2">{c.creatorsApplied}</p>
                </div>

                {/* Deadline */}
                <div className="lg:w-44 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-600 mb-2">{c.ddlLabel}</p>
                  {cp.deadline ? (
                    <>
                      <p className="text-sm font-normal text-gray-900 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(cp.deadline, locale)}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-2">
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
                <div className="flex-shrink-0 lg:ml-auto flex items-center gap-4">
                  <span className="inline-flex items-center justify-center gap-3 text-sm font-semibold text-gray-700 group-hover:text-primary-700 transition">
                    {c.manageCampaign}
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(cp) }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    aria-label={`${c.deleteCampaign}: ${cp.title}`}
                    title={c.deleteCampaign}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </Link>
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
              className={`w-9 h-9 rounded-full text-sm transition ${
                n === safePage ? 'bg-white text-gray-900 font-bold shadow-sm ring-1 ring-gray-200' : 'bg-white shadow-sm text-gray-600 font-semibold hover:text-gray-900'
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

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div data-solid className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg">{c.deleteConfirmTitle}</h3>
            <p className="text-sm text-gray-600 mt-2">{c.deleteConfirmDesc}</p>
            {['ACTIVE', 'PENDING_REVIEW', 'PAUSED'].includes(deleteTarget.status) && (
              <p className="text-sm text-gray-600 mt-2">{c.cancelConfirmDesc}</p>
            )}
            <p className="text-sm font-semibold text-gray-900 mt-3 truncate">{deleteTarget.title}</p>
            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl transition disabled:opacity-50"
              >
                {c.keepCampaign}
              </button>
              {['ACTIVE', 'PENDING_REVIEW', 'PAUSED'].includes(deleteTarget.status) && (
                <button
                  onClick={() => removeCampaign('cancel')}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                >
                  {c.cancelCampaign}
                </button>
              )}
              <button
                onClick={() => removeCampaign('delete')}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
              >
                {deleting ? '…' : c.deletePermanently}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
