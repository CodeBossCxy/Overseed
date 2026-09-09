'use client'

// Localized text fragments for the (server-rendered) apply page.
// Follows the LocaleDate pattern: server page composes, client leaf translates.

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function ApplyBackLink({ campaignId }: { campaignId: string }) {
  const { t } = useLanguage()
  return (
    <Link
      href={`/campaign/${campaignId}`}
      className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
    >
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {t.applyPage.backToCampaign}
    </Link>
  )
}

export function ApplyHeading({ campaignTitle }: { campaignTitle: string }) {
  const { t } = useLanguage()
  return (
    <>
      <h1 className="text-2xl font-bold mb-2">{t.applyPage.title}</h1>
      <p className="text-gray-600 mb-6">
        {t.applyPage.subtitle.replace('{title}', campaignTitle)}
      </p>
    </>
  )
}

export function CompleteProfileNotice() {
  const { t } = useLanguage()
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold mb-2">{t.applyPage.completeProfileTitle}</h2>
      <p className="text-gray-600 mb-4">{t.applyPage.completeProfileDesc}</p>
      <Link
        href="/dashboard/influencer/profile"
        className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
      >
        {t.applyPage.setUpProfile}
      </Link>
    </div>
  )
}
