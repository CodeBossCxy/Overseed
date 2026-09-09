'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ApplicationStatus from './ApplicationStatus'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import { formatNumber } from '@/lib/i18n/formatNumber'

interface ApplicationCardProps {
  application: {
    id: string
    status: string
    pitchMessage?: string | null
    proposedRate?: number | string | null
    appliedAt: string
    reviewedAt?: string | null
    approvedAt?: string | null
    campaign: {
      id: string
      title: string
      compensationType: string
      paymentMin?: number | string | null
      paymentMax?: number | string | null
      brand: {
        id: string
        companyName?: string | null
        logoUrl?: string | null
        isVerified: boolean
      }
      categories?: Array<{
        category: {
          name: string
        }
      }>
      platforms?: Array<{
        platform: {
          name: string
        }
      }>
    }
    socialAccount?: {
      platform: {
        name: string
      }
      username: string
    } | null
  }
  showActions?: boolean
  onWithdraw?: () => void
}

export default function ApplicationCard({
  application,
  showActions = true,
  onWithdraw,
}: ApplicationCardProps) {
  const router = useRouter()
  const { locale } = useLanguage()
  const canWithdraw = ['PENDING', 'UNDER_REVIEW'].includes(application.status)
  const canMessage = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED'].includes(application.status)

  const handleMessage = async () => {
    try {
      const res = await fetch('/api/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application.id }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/messages?conv=${data.conversationId}`)
      }
    } catch (error) {
      console.error('Error starting conversation:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 md:p-6">
        <div className="flex gap-4">
          {/* Brand Logo */}
          <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden">
            {application.campaign.brand.logoUrl ? (
              <img
                src={application.campaign.brand.logoUrl}
                alt={application.campaign.brand.companyName || 'Brand'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
                {application.campaign.brand.companyName?.charAt(0) || 'B'}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  href={`/campaign/${application.campaign.id}`}
                  className="text-lg font-semibold text-gray-900 hover:text-primary-600 line-clamp-1"
                >
                  {application.campaign.title}
                </Link>
                <div className="flex items-center gap-1 text-sm text-gray-600 mt-0.5">
                  <span>{application.campaign.brand.companyName || 'Anonymous Brand'}</span>
                  {application.campaign.brand.isVerified && (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <ApplicationStatus status={application.status} />
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-500">
              <span>Applied {formatDate(application.appliedAt, locale)}</span>
              {application.socialAccount && (
                <span>
                  via {application.socialAccount.platform.name} (@{application.socialAccount.username})
                </span>
              )}
              {application.proposedRate && (
                <span>
                  Proposed rate: ${formatNumber(Number(application.proposedRate), locale)}
                </span>
              )}
            </div>

            {/* Pitch message preview */}
            {application.pitchMessage && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                {application.pitchMessage}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <Link
              href={`/applications/${application.id}`}
              className="text-sm text-primary-600 hover:underline"
            >
              View Details
            </Link>
            <div className="flex items-center gap-4">
              {canMessage && (
                <button
                  onClick={handleMessage}
                  className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Message Brand
                </button>
              )}
              {canWithdraw && onWithdraw && (
                <button
                  onClick={onWithdraw}
                  className="text-sm text-red-600 hover:underline"
                >
                  Withdraw Application
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
