'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useViewMode } from '@/lib/hooks/useViewMode'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function CreateCampaignFAB() {
  const { data: session } = useSession()
  const { isBrand } = useViewMode()
  const { t } = useLanguage()

  if (!session || !isBrand) return null

  const verificationStatus = (session.user as any)?.brandVerificationStatus
  if (verificationStatus !== 'APPROVED') return null

  return (
    <Link
      href="/dashboard/brand/campaigns/new"
      className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition flex items-center justify-center z-40 group"
    >
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <span className="absolute right-16 bg-gray-900 text-white text-sm px-3 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
        {t.nav?.createCampaign || 'Create Campaign'}
      </span>
    </Link>
  )
}
