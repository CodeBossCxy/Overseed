'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import CampaignRowCard from '../campaigns/CampaignRowCard'
import UGCTranslateToggle from '../UGCTranslateToggle'

export function BrowseTitle({ recommended = false }: { recommended?: boolean }) {
  const { t } = useLanguage()
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">
        {recommended ? t.browse.recommendedTitle : t.browse.title}
      </h1>
      <p className="text-gray-500">{recommended ? t.browse.recommendedSubtitle : t.browse.subtitle}</p>
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
  recommendedAvailable = false,
}: {
  initialCampaigns: any[]
  filters: Filters
  categories?: Category[]
  platforms?: Platform[]
  savedIds?: string[]
  canSave?: boolean
  recommendedAvailable?: boolean
}) {
  const router = useRouter()
  const { t, locale, isUGCTranslated } = useLanguage()
  const ft = t.campaignFilters
  const [campaigns, setCampaigns] = useState<any[]>(initialCampaigns)
  const [isTranslating, setIsTranslating] = useState(false)
  const [query, setQuery] = useState('')
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
    const merged = {
      category: filters.category || '',
      platform: filters.platform || '',
      compensation: filters.compensation || '',
      minFollowers: filters.minFollowers || '',
      sort: filters.sort || '',
      ...overrides,
    }
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value)
    }
    router.push(`/browse?${params.toString()}`)
  }

  const clearFilters = () => {
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
      {/* Toolbar per mockup: search + inline filters, then count + sort */}
      <div className="mb-4 bg-white/70 backdrop-blur rounded-2xl shadow-sm px-5 py-3 flex flex-wrap items-center gap-3">
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
        <select
          value={filters.category || ''}
          onChange={(e) => pushWith({ category: e.target.value })}
          className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          <option value="">{ft.allCategories}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>{t.categoryNames[cat.name] || cat.name}</option>
          ))}
        </select>
        <select
          value={filters.platform || ''}
          onChange={(e) => pushWith({ platform: e.target.value })}
          className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          <option value="">{ft.allPlatforms}</option>
          {platforms.map((plat) => (
            <option key={plat.id} value={plat.slug}>{plat.name}</option>
          ))}
        </select>
        <select
          value={filters.compensation || ''}
          onChange={(e) => pushWith({ compensation: e.target.value })}
          className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          <option value="">{ft.compensation}</option>
          <option value="PAID">{ft.paid}</option>
          <option value="GIFTED">{ft.gifted}</option>
          <option value="PAID_PLUS_GIFT">{ft.paidPlusGift}</option>
          <option value="AFFILIATE">{ft.affiliate}</option>
          <option value="NEGOTIABLE">{ft.negotiable}</option>
        </select>
        <select
          value={filters.minFollowers || ''}
          onChange={(e) => pushWith({ minFollowers: e.target.value })}
          className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          <option value="">{t.browse.minFollowersLabel}</option>
          {FOLLOWER_RANGES.map((v) => (
            <option key={v} value={v}>{followerLabel(v)}</option>
          ))}
        </select>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 rounded-full text-sm font-medium text-primary-600 hover:bg-white transition"
          >
            ↺ {ft.clearAll}
          </button>
        )}
      </div>

      {/* Count + sort row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-1">
        <span className="text-sm text-gray-600 font-medium">
          {visible.length} {t.browse.campaignsFound}
        </span>
        <div className="flex items-center gap-2">
          <UGCTranslateToggle isLoading={isTranslating} />
          <span className="text-sm text-gray-500 whitespace-nowrap">{t.browse.sortBy}</span>
          <select
            value={filters.sort || (recommendedAvailable ? 'recommended' : 'latest')}
            onChange={(e) => pushWith({ sort: e.target.value })}
            className="px-3 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            {recommendedAvailable && <option value="recommended">{t.browse.sortRecommended}</option>}
            <option value="latest">{t.browse.sortLatest}</option>
            <option value="deadline">{t.browse.sortDeadline}</option>
            <option value="payment">{t.browse.sortPay}</option>
          </select>
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
