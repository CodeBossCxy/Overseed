'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import SocialAccountList from '@/components/profiles/SocialAccountList'
import SocialAccountForm from '@/components/profiles/SocialAccountForm'
import UpgradePrompt from '@/components/UpgradePrompt'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface SocialAccount {
  id: string
  platform: {
    id: number
    name: string
    slug: string
  }
  username: string
  profileUrl?: string | null
  followerCount: number
  engagementRate?: number | string | null
  isVerified: boolean
  verificationMethod?: string | null
  verifiedAt?: string | null
}

interface Platform {
  id: number
  name: string
  slug: string
}

export default function SocialAccountsPage() {
  const { t } = useLanguage()
  const { data: session } = useSession()
  const subscriptionTier = (session?.user as any)?.subscriptionTier || 'FREE'
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [accountsRes, platformsRes] = await Promise.all([
        fetch('/api/social-accounts'),
        fetch('/api/platforms'),
      ])

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json()
        setAccounts(accountsData)
      }

      if (platformsRes.ok) {
        const platformsData = await platformsRes.json()
        setPlatforms(platformsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDialogs.removeAccount)) {
      return
    }

    try {
      const response = await fetch(`/api/social-accounts/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setAccounts((prev) => prev.filter((acc) => acc.id !== id))
      }
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  const handleAddSuccess = () => {
    setShowForm(false)
    fetchData()
  }

  const existingPlatformIds = accounts.map((acc) => acc.platform.id)

  if (isLoading) {
    return (
      <CreatorWorkspaceLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">{t.influencer.accounts.loading}</p>
        </div>
      </CreatorWorkspaceLayout>
    )
  }

  if (subscriptionTier === 'FREE') {
    return (
      <CreatorWorkspaceLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold mb-8">{t.influencer.accounts.title}</h1>
          <div className="bg-white rounded-lg shadow-md">
            <UpgradePrompt feature="social-accounts" />
          </div>
        </div>
      </CreatorWorkspaceLayout>
    )
  }

  return (
    <CreatorWorkspaceLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t.influencer.accounts.title}</h1>
            <p className="text-gray-600 mt-1">{t.influencer.accounts.subtitle}</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
            >
              {t.influencer.accounts.addAccount}
            </button>
          )}
        </div>

        {showForm ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{t.influencer.accounts.linkNew}</h2>
            <SocialAccountForm
              platforms={platforms}
              existingPlatformIds={existingPlatformIds}
              onSuccess={handleAddSuccess}
              onCancel={() => setShowForm(false)}
              translations={t.influencer.accounts as unknown as Record<string, string>}
            />
          </div>
        ) : null}

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">{t.influencer.accounts.connectedAccounts}</h2>
          <SocialAccountList
            accounts={accounts as any}
            isPublicView={false}
            onDelete={handleDelete}
            onAdd={() => setShowForm(true)}
          />
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">{t.influencer.accounts.whyLink}</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>{t.influencer.accounts.reason1}</li>
            <li>{t.influencer.accounts.reason2}</li>
            <li>{t.influencer.accounts.reason3}</li>
          </ul>
        </div>
      </div>
    </CreatorWorkspaceLayout>
  )
}
