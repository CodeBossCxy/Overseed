'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import CampaignRowCard from '../campaigns/CampaignRowCard'
import UGCTranslateToggle from '../UGCTranslateToggle'

export function BrowseTitle() {
  const { t } = useLanguage()
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">{t.browse.title}</h1>
      <p className="text-gray-500">{t.browse.subtitle}</p>
    </div>
  )
}

export function BrowseEmpty() {
  const { t } = useLanguage()
  return (
    <div className="text-center py-12 bg-white/85 backdrop-blur rounded-2xl shadow-sm">
      <p className="text-gray-500 text-lg mb-4">{t.browse.noResults}</p>
      <a href="/browse" className="text-primary-600 hover:underline">
        {t.browse.clearFilters}
      </a>
    </div>
  )
}

interface Category {
  id: number
  name: string
  slug: string
}

interface Platform {
  id: number
  name: string
  slug: string
}

interface Filters {
  category?: string
  platform?: string
  compensation?: string
  minFollowers?: string
  sort?: string
}

const FOLLOWER_RANGES = ['1000', '5000', '10000', '50000', '100000', '500000', '1000000']
const followerLabel = (v: string) =>
  Number(v) >= 1000000 ? `${Number(v) / 1000000}M+` : `${Number(v) / 1000}K+`

export function BrowseCampaignList({
  initialCampaigns,
  filters,
  categories = [],
  platforms = [],
  savedIds = [],
  canSave = false,
}: {
  initialCampaigns: any[]
  filters: Filters
  categories?: Category[]
  platforms?: Platform[]
  savedIds?: string[]
  canSave?: boolean
}) {
  const router = useRouter()
  const { t, locale, isUGCTranslated } = useLanguage()
  const ft = t.campaignFilters
  const [campaigns, setCampaigns] = useState<any[]>(initialCampaigns)
  const [isTranslating, setIsTranslating] = useState(false)
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draft, setDraft] = useState({
    category: filters.category || '',
    platform: filters.platform || '',
    compensation: filters.compensation || '',
    minFollowers: filters.minFollowers || '',
  })
  const [saved, setSaved] = useState<Set<string>>(new Set(savedIds))
  const [savePending, setSavePending] = useState<string | null>(null)
  const originalCampaignsRef = useRef<any[]>(initialCampaigns)

  useEffect(() => {
    if (!isUGCTranslated) {
      setCampaigns(originalCampaignsRef.current)
      return
    }

    const fetchTranslated = async () => {
      setIsTranslating(true)
      try {
        const params = new URLSearchParams()
        params.set('lang', locale)
        params.set('limit', '50')
        if (filters.category) params.set('category', filters.category)
        if (filters.platform) params.set('platform', filters.platform)
        if (filters.compensation) params.set('compensation', filters.compensation)
        if (filters.sort) params.set('sort', filters.sort)

        const res = await fetch(`/api/campaigns?${params.toString()}`)
        const result = await res.json()
        if (result.data) {
          setCampaigns(result.data)
        }
      } catch (error) {
        console.error('Translation failed:', error)
      } finally {
        setIsTranslating(false)
      }
    }

    fetchTranslated()
  }, [isUGCTranslated, locale, filters.category, filters.platform, filters.compensation, filters.sort])

  const pushWith = (overrides: Record<string, string>) => {
    const params = new URLSearchParams()
    const merged = { ...draft, sort: filters.sort || 'latest', ...overrides }
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value)
    }
    router.push(`/browse?${params.toString()}`)
  }

  const applyFilters = () => {
    setFiltersOpen(false)
    pushWith({})
  }

  const clearFilters = () => {
    setDraft({ category: '', platform: '', compensation: '', minFollowers: '' })
    setFiltersOpen(false)
    router.push('/browse')
  }

  const activeFilterCount = [filters.category, filters.platform, filters.compensation, filters.minFollowers].filter(Boolean).length

  const toggleSave = async (campaignId: string, next: boolean) => {
    setSavePending(campaignId)
    // Optimistic flip; revert on failure.
    setSaved((prev) => {
      const s = new Set(prev)
      next ? s.add(campaignId) : s.delete(campaignId)
      return s
    })
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/save`, {
        method: next ? 'POST' : 'DELETE',
      })
      if (!res.ok) throw new Error()
    } catch {
      setSaved((prev) => {
        const s = new Set(prev)
        next ? s.delete(campaignId) : s.add(campaignId)
        return s
      })
    } finally {
      setSavePending(null)
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.brand?.companyName?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    )
  }, [campaigns, query])

  return (
    <div>
      {/* Toolbar: count · search · sort · filters */}
      <div className="mb-6 bg-white/70 backdrop-blur rounded-2xl shadow-sm px-5 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
          {visible.length} {t.browse.campaignsFound}
        </span>
        <div className="relative flex-1 min-w-[200px]">
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.browse.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 bg-white rounded-full text-sm border border-transparent focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <UGCTranslateToggle isLoading={isTranslating} />
          <span className="text-sm text-gray-500 whitespace-nowrap">{t.browse.sortBy}</span>
          <select
            value={filters.sort || 'latest'}
            onChange={(e) => pushWith({ sort: e.target.value })}
            className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="latest">{t.browse.sortLatest}</option>
            <option value="deadline">{t.browse.sortDeadline}</option>
            <option value="payment">{t.browse.sortPay}</option>
          </select>
          <div className="relative">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`px-4 py-2 rounded-full text-sm font-medium shadow-sm flex items-center gap-2 transition ${
                activeFilterCount > 0
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              {ft.filters}
              {activeFilterCount > 0 && (
                <span className="bg-white/25 rounded-full px-1.5 text-xs">{activeFilterCount}</span>
              )}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 p-4 z-30">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">{ft.filters}</p>
                  <button onClick={clearFilters} className="text-xs text-primary-600 hover:underline">
                    {ft.clearAll}
                  </button>
                </div>

                <label className="block text-xs font-medium text-gray-500 mb-1">{ft.category}</label>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="w-full mb-3 px-3 py-2 bg-gray-50 rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">{ft.allCategories}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {t.categoryNames[cat.name] || cat.name}
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-medium text-gray-500 mb-1">{ft.platform}</label>
                <select
                  value={draft.platform}
                  onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
                  className="w-full mb-3 px-3 py-2 bg-gray-50 rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">{ft.allPlatforms}</option>
                  {platforms.map((plat) => (
                    <option key={plat.id} value={plat.slug}>
                      {plat.name}
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-medium text-gray-500 mb-1">{ft.compensation}</label>
                <select
                  value={draft.compensation}
                  onChange={(e) => setDraft({ ...draft, compensation: e.target.value })}
                  className="w-full mb-3 px-3 py-2 bg-gray-50 rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">{ft.allTypes}</option>
                  <option value="PAID">{ft.paid}</option>
                  <option value="GIFTED">{ft.gifted}</option>
                  <option value="PAID_PLUS_GIFT">{ft.paidPlusGift}</option>
                  <option value="AFFILIATE">{ft.affiliate}</option>
                  <option value="NEGOTIABLE">{ft.negotiable}</option>
                </select>

                <label className="block text-xs font-medium text-gray-500 mb-1">{ft.minFollowersRequired}</label>
                <select
                  value={draft.minFollowers}
                  onChange={(e) => setDraft({ ...draft, minFollowers: e.target.value })}
                  className="w-full mb-4 px-3 py-2 bg-gray-50 rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">{ft.any}</option>
                  {FOLLOWER_RANGES.map((v) => (
                    <option key={v} value={v}>
                      {followerLabel(v)}
                    </option>
                  ))}
                </select>

                <button
                  onClick={applyFilters}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition"
                >
                  {ft.applyFilters}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign cards */}
      {visible.length === 0 ? (
        <BrowseEmpty />
      ) : (
        <div className="space-y-4">
          {visible.map((campaign: any) => (
            <CampaignRowCard
              key={campaign.id}
              campaign={campaign}
              saved={saved.has(campaign.id)}
              onToggleSave={canSave ? toggleSave : undefined}
              busy={savePending === campaign.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function BrowseProGate({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { t } = useLanguage()
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-10">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{t.browsePro.title}</h2>
        <p className="text-gray-600 mb-6">{t.browsePro.description}</p>
        {!isLoggedIn ? (
          <Link
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
          >
            {t.browsePro.signIn}
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
          >
            {t.browsePro.upgradeToPro}
          </Link>
        )}
      </div>
    </div>
  )
}
