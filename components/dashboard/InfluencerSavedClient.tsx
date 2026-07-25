'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import CampaignRowCard from '@/components/campaigns/CampaignRowCard'

interface InfluencerSavedClientProps {
  savedCampaigns: any[]
}

const URGENT_WINDOW_DAYS = 14

export default function InfluencerSavedClient({ savedCampaigns }: InfluencerSavedClientProps) {
  const { t } = useLanguage()
  const s = t.influencer.saved

  const [items, setItems] = useState<any[]>(savedCampaigns)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'deadline' | 'pay'>('recent')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [compFilter, setCompFilter] = useState<string[]>([])
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const isUrgent = (campaign: any) => {
    if (!campaign.deadline) return false
    const days = (new Date(campaign.deadline).getTime() - Date.now()) / 86400000
    return days >= 0 && days <= URGENT_WINDOW_DAYS
  }

  const compLabel = (type: string) =>
    ({
      PAID: s.paid,
      GIFTED: s.gifted,
      PAID_PLUS_GIFT: s.paidPlusGift,
      AFFILIATE: s.affiliate,
      NEGOTIABLE: s.negotiable,
    } as Record<string, string>)[type] || type

  const visible = useMemo(() => {
    let list = [...items]
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((item) => {
        const c = item.campaign
        return (
          c.title?.toLowerCase().includes(q) ||
          c.brand?.companyName?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
        )
      })
    }
    if (compFilter.length > 0) {
      list = list.filter((item) => compFilter.includes(item.campaign.compensationType))
    }
    if (urgentOnly) {
      list = list.filter((item) => isUrgent(item.campaign))
    }
    if (sort === 'deadline') {
      list.sort((a, b) => {
        const da = a.campaign.deadline ? new Date(a.campaign.deadline).getTime() : Infinity
        const db = b.campaign.deadline ? new Date(b.campaign.deadline).getTime() : Infinity
        return da - db
      })
    } else if (sort === 'pay') {
      list.sort(
        (a, b) => (Number(b.campaign.paymentMax) || 0) - (Number(a.campaign.paymentMax) || 0)
      )
    } else {
      list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, sort, compFilter, urgentOnly])

  const remove = async (campaignId: string) => {
    setRemoving(campaignId)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/save`, { method: 'DELETE' })
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.campaign.id !== campaignId))
      }
    } finally {
      setRemoving(null)
    }
  }

  const toggleComp = (type: string) =>
    setCompFilter((prev) =>
      prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]
    )

  return (
    <div className="max-w-6xl mx-auto pt-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{s.title}</h1>
        <p className="text-gray-500 mt-1">{s.subtitle}</p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 bg-white/70 backdrop-blur rounded-2xl shadow-sm px-5 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
          {items.length} {s.savedCount}
        </span>
        <div className="relative flex-1 min-w-[200px]">
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 bg-white rounded-full text-sm border border-transparent focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-500 whitespace-nowrap">{s.sortBy}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="recent">{s.sortRecentlySaved}</option>
            <option value="deadline">{s.sortDeadline}</option>
            <option value="pay">{s.sortHighestPay}</option>
          </select>
          <div className="relative">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`px-4 py-2 rounded-full text-sm font-medium shadow-sm flex items-center gap-2 transition ${
                compFilter.length > 0 || urgentOnly
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              {s.filters}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-30">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{s.filterCompensation}</p>
                {['PAID', 'GIFTED', 'PAID_PLUS_GIFT', 'AFFILIATE', 'NEGOTIABLE'].map((type) => (
                  <label key={type} className="flex items-center gap-2 py-1 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compFilter.includes(type)}
                      onChange={() => toggleComp(type)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    {compLabel(type)}
                  </label>
                ))}
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <label className="flex items-center gap-2 py-1 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={urgentOnly}
                      onChange={() => setUrgentOnly((v) => !v)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    {s.filterUrgentOnly}
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="bg-white/80 rounded-2xl shadow-sm p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">{s.empty}</p>
          <p className="text-gray-400 mb-6">{s.emptyDesc}</p>
          <Link
            href="/browse"
            className="inline-block px-6 py-2.5 bg-primary-600 text-white rounded-full font-medium hover:bg-primary-700 transition"
          >
            {s.browseCampaigns}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white/80 rounded-2xl shadow-sm p-10 text-center text-gray-500">{s.noMatches}</div>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <CampaignRowCard
              key={item.campaign.id}
              campaign={item.campaign}
              saved
              onRemove={remove}
              busy={removing === item.campaign.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
