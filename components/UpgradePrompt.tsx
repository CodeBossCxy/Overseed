'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface UpgradePromptProps {
  feature: 'apply' | 'social-accounts'
  title?: string
  description?: string
}

export default function UpgradePrompt({ feature, title, description }: UpgradePromptProps) {
  const { t } = useLanguage()

  const defaultContent = {
    apply: {
      title: t.upgrade?.applyCampaignsTitle || 'Pro Feature: Apply to Campaigns',
      description: t.upgrade?.applyCampaignsDesc || 'Upgrade to a Pro account to apply to campaigns and start collaborating with brands.',
    },
    'social-accounts': {
      title: t.upgrade?.linkAccountsTitle || 'Pro Feature: Link Social Accounts',
      description: t.upgrade?.linkAccountsDesc || 'Upgrade to a Pro account to link your social media accounts and showcase your reach to brands.',
    },
  }

  const content = defaultContent[feature]

  return (
    <div className="text-center py-12 px-6">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold mb-2">{title || content.title}</h2>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {description || content.description}
      </p>
      <Link
        href="/dashboard/upgrade"
        className="inline-block px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition font-medium shadow-md"
      >
        {t.upgrade?.upgradeToPro || 'Upgrade to Pro'}
      </Link>
    </div>
  )
}
