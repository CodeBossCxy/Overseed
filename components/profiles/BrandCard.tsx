'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface BrandCardProps {
  brand: {
    id: string
    companyName?: string | null
    logoUrl?: string | null
    description?: string | null
    industry?: string | null
    isVerified: boolean
    _count?: {
      campaigns: number
    }
    completedCollaborations?: number
  }
}

export default function BrandCard({ brand }: BrandCardProps) {
  const { t } = useLanguage()
  return (
    <Link
      href={`/brand/${brand.id}`}
      className="block bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.companyName || t.profileCards.brand.logoAltFallback}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                {brand.companyName?.charAt(0) || 'B'}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {brand.companyName || t.profileCards.brand.anonymousBrand}
              </h3>
              {brand.isVerified && (
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {brand.industry && (
              <span className="inline-block mt-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                {brand.industry}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {brand.description && (
          <p className="text-sm text-gray-600 mt-3 line-clamp-2">{brand.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-sm">
          {brand._count && (
            <div>
              <span className="text-gray-500">{t.profileCards.brand.campaigns}</span>
              <span className="ml-1 font-medium">{brand._count.campaigns}</span>
            </div>
          )}
          {brand.completedCollaborations !== undefined && (
            <div>
              <span className="text-gray-500">{t.profileCards.brand.collaborations}</span>
              <span className="ml-1 font-medium">{brand.completedCollaborations}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
