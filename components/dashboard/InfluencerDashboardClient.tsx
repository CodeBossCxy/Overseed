'use client'

import { useState } from 'react'
import Link from 'next/link'
import ApplicationCard from '@/components/applications/ApplicationCard'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface SocialAccount {
  id: string
  followerCount: number
  platform: {
    name: string
  }
}

interface InfluencerProfile {
  id: string
  displayName: string | null
  bio: string | null
  socialAccounts: SocialAccount[]
}

interface Stats {
  totalApplications: number
  pendingApplications: number
  approvedApplications: number
  completedCampaigns: number
  savedCampaigns: number
}

interface InfluencerDashboardClientProps {
  stats: Stats
  recentApplications: any[]
  influencerProfile: InfluencerProfile
  totalFollowers: number
  userName: string
  stripeOnboardingComplete?: boolean
}

export default function InfluencerDashboardClient({
  stats,
  recentApplications,
  influencerProfile,
  totalFollowers,
  userName,
  stripeOnboardingComplete = false,
}: InfluencerDashboardClientProps) {
  const { t } = useLanguage()
  const [stripeLoading, setStripeLoading] = useState(false)

  const shortcutLinks = [
    { href: '/browse', label: t.influencer.dashboard.browseCampaigns, icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { href: '/dashboard/influencer/applications', label: t.influencer.dashboard.myApplications, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { href: '/dashboard/influencer/saved', label: `${t.influencer.dashboard.savedCampaigns} (${stats.savedCampaigns})`, icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-8-4-8 4V5z' },
    { href: '/dashboard/influencer/profile', label: t.influencer.dashboard.editProfile, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { href: '/dashboard/influencer/accounts', label: `${t.influencer.dashboard.manageSocialAccounts} (${influencerProfile.socialAccounts.length})`, icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    { href: '/dashboard/messages', label: t.messages?.title || 'Messages', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t.influencer.dashboard.title}</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">
          {t.influencer.dashboard.welcomeBack} {influencerProfile.displayName || userName}!
        </p>
      </div>

      {/* Stripe Connect Banner */}
      {!stripeOnboardingComplete && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-900">{t.payments.setupTitle}</p>
              <p className="text-xs text-purple-700">{t.payments.setupDesc}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              setStripeLoading(true)
              try {
                const res = await fetch('/api/stripe/connect', { method: 'POST' })
                if (res.ok) {
                  const data = await res.json()
                  window.location.href = data.url
                }
              } catch {} finally {
                setStripeLoading(false)
              }
            }}
            disabled={stripeLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition flex-shrink-0 disabled:opacity-50"
          >
            {stripeLoading ? t.common.loading : t.payments.setUp}
          </button>
        </div>
      )}

      <section className="mb-8 rounded-2xl border border-gray-100 bg-white shadow-sm p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">{t.influencer.dashboard.overview}</h2>
        <div className="grid gap-4 sm:gap-5">
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2.5">{t.influencer.dashboard.statGroupApplications}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {[
                { value: stats.totalApplications, label: t.influencer.dashboard.totalApplications, color: 'text-primary-600', bg: 'bg-primary-50', ring: 'ring-primary-100/80' },
                { value: stats.pendingApplications, label: t.influencer.dashboard.pending, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100/80' },
                { value: stats.approvedApplications, label: t.influencer.dashboard.approved, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100/80' },
                { value: stats.completedCampaigns, label: t.influencer.dashboard.completed, color: 'text-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-100/80' },
              ].map((stat) => (
                <div key={stat.label} className={`${stat.bg} ring-1 ${stat.ring} rounded-xl p-4 text-center`}>
                  <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-600 mt-1 leading-snug">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2.5">{t.influencer.dashboard.statGroupReach}</p>
            <div className="grid grid-cols-1 sm:max-w-xs">
              <div className="bg-blue-50 ring-1 ring-blue-100/80 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold tabular-nums text-blue-600">{totalFollowers.toLocaleString()}</div>
                <div className="text-xs text-gray-600 mt-1 leading-snug">{t.influencer.dashboard.totalFollowers}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t.influencer.dashboard.recentApplications}</h2>
            <Link href="/dashboard/influencer/applications" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              {t.influencer.dashboard.viewAll}
            </Link>
          </div>
          {recentApplications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <p className="text-gray-500 mb-4 text-sm">{t.influencer.dashboard.noApplications}</p>
              <Link
                href="/browse"
                className="inline-block px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition text-sm font-medium shadow-sm"
              >
                {t.influencer.dashboard.browseCampaigns}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application as any}
                  showActions={false}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-8 lg:self-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
              <h3 className="text-sm font-semibold text-gray-900">{t.influencer.dashboard.quickLinks}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t.influencer.dashboard.quickLinksHint}</p>
            </div>
            <nav className="p-2">
              {shortcutLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={link.icon} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">{link.label}</span>
                  <svg className="h-4 w-4 flex-shrink-0 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </nav>
          </div>

          {(!influencerProfile.bio || influencerProfile.socialAccounts.length === 0) && (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
              <h3 className="font-semibold text-yellow-800 mb-2">{t.influencer.dashboard.completeProfile}</h3>
              <p className="text-sm text-yellow-700 mb-4">{t.influencer.dashboard.completeProfileDesc}</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {!influencerProfile.bio && <li>{t.influencer.dashboard.addBio}</li>}
                {influencerProfile.socialAccounts.length === 0 && <li>{t.influencer.dashboard.linkSocialAccounts}</li>}
              </ul>
              <Link
                href="/dashboard/influencer/profile"
                className="inline-block mt-4 text-sm text-yellow-800 font-medium hover:underline"
              >
                {t.influencer.dashboard.completeProfileLink}
              </Link>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
              <h3 className="text-sm font-semibold text-gray-900">{t.influencer.dashboard.connectedPlatforms}</h3>
              <Link href="/dashboard/influencer/accounts" className="text-primary-600 hover:text-primary-700 text-xs font-medium">
                {t.influencer.dashboard.manage}
              </Link>
            </div>
            <div className="p-5">
              {influencerProfile.socialAccounts.length === 0 ? (
                <p className="text-sm text-gray-500">{t.influencer.dashboard.noAccountsLinked}</p>
              ) : (
                <div className="space-y-2">
                  {influencerProfile.socialAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span className="font-medium text-gray-800">{account.platform.name}</span>
                      <span className="tabular-nums text-gray-500">{account.followerCount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
