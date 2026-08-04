'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import CampaignRowCard from '@/components/campaigns/CampaignRowCard'
import UGCTranslateToggle from '@/components/UGCTranslateToggle'

interface BrandProfileWrapperProps {
  initialBrand: any
}

export default function BrandProfileWrapper({ initialBrand }: BrandProfileWrapperProps) {
  const { locale, isUGCTranslated } = useLanguage()
  const [brand, setBrand] = useState(initialBrand)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isUGCTranslated) {
      setBrand(initialBrand)
      return
    }

    async function fetchTranslatedBrand() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/brands/${initialBrand.id}?lang=${locale}`)
        const data = await response.json()
        if (data && !data.message) {
          // Overlay translated text onto the server-fetched objects so
          // relations the API response lacks (e.g. campaign.brand) survive
          const translatedCampaigns = new Map<string, any>(
            (data.campaigns || []).map((cp: any) => [cp.id, cp])
          )
          setBrand({
            ...initialBrand,
            description: data.description ?? initialBrand.description,
            campaigns: (initialBrand.campaigns || []).map((cp: any) => {
              const tr = translatedCampaigns.get(cp.id)
              return tr
                ? {
                    ...cp,
                    title: tr.title ?? cp.title,
                    description: tr.description ?? cp.description,
                    contentGuidelines: tr.contentGuidelines ?? cp.contentGuidelines,
                    giftDescription: tr.giftDescription ?? cp.giftDescription,
                  }
                : cp
            }),
          })
        }
      } catch (error) {
        console.error('Error fetching brand profile:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTranslatedBrand()
  }, [locale, isUGCTranslated, initialBrand])

  const isVerified = brand.brandVerificationStatus === 'APPROVED'
  const industries = brand.industries?.length ? brand.industries : brand.industry ? [brand.industry] : []
  const links = [brand.websiteUrl, brand.storeUrl, ...(brand.socialLinks || [])].filter(Boolean) as string[]

  return (
    <div className="max-w-5xl mx-auto pt-6 pb-8 px-4 sm:px-0">
      <div className="flex items-center justify-end mb-2">
        <UGCTranslateToggle isLoading={isLoading} />
      </div>
      {/* Header card */}
      <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6 sm:p-8 mb-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl font-bold text-gray-300">{(brand.companyName || 'B').charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{brand.companyName || '—'}</h1>
              {isVerified && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l2.4 2.4 3.3-.5.5 3.3L20.6 9.6 22 12l-1.4 2.4.6 3.3-3.3.5L15.4 21.6 12 20.2 8.6 21.6 6.1 18.2l-3.3-.5.6-3.3L2 12l1.4-2.4-.5-3.3 3.3.5L8.6 2.4 12 2zm-1.2 12.7l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" />
                  </svg>
                  Verified Business
                </span>
              )}
            </div>
            {brand.description && <p className="text-sm text-gray-600 mt-2 max-w-2xl">{brand.description}</p>}
            {(industries.length > 0 || (brand.countries || []).length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {industries.map((ind: string) => (
                  <span key={ind} className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">{ind}</span>
                ))}
                {(brand.countries || []).map((cn: string) => (
                  <span key={cn} className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{cn}</span>
                ))}
              </div>
            )}
            {links.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                {links.map((link: string, i: number) => (
                  <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline truncate max-w-[240px]">
                    {link}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live campaigns */}
      {brand.campaigns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Live Campaigns</h2>
            <Link href="/browse" className="text-xs font-medium text-gray-500 hover:text-primary-700 transition">→</Link>
          </div>
          <div className="space-y-4">
            {brand.campaigns.map((cp: any) => (
              <CampaignRowCard key={cp.id} campaign={cp} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
