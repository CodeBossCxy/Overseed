'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface SocialAccount {
  id: string
  platform: {
    name: string
  }
  username: string
  followerCount: number
}

interface ApplicationFormProps {
  campaignId: string
  campaignTitle: string
  socialAccounts: SocialAccount[]
  isNegotiable: boolean
}

export default function ApplicationForm({
  campaignId,
  campaignTitle,
  socialAccounts,
  isNegotiable,
}: ApplicationFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    socialAccountId: socialAccounts.length > 0 ? socialAccounts[0].id : '',
    pitchMessage: '',
    proposedRate: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socialAccountId: formData.socialAccountId || null,
          pitchMessage: formData.pitchMessage,
          proposedRate: formData.proposedRate ? parseFloat(formData.proposedRate) : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to submit application')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard/influencer/applications')
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-green-600 mb-2">{t.applicationForm?.submitted || 'Application Submitted!'}</h2>
        <p className="text-gray-600 mb-4">
          {(t.applicationForm?.submittedMessage || 'Your application for "{title}" has been sent to the brand.').replace('{title}', campaignTitle)}
        </p>
        <p className="text-sm text-gray-500">{t.applicationForm?.redirecting || 'Redirecting to your applications...'}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Social Account Selection */}
      {socialAccounts.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            {t.applicationForm?.selectAccount || 'Select Social Account for This Campaign'}
          </label>
          <div className="space-y-2">
            {socialAccounts.map((account) => (
              <label
                key={account.id}
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition ${
                  formData.socialAccountId === account.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="socialAccount"
                  value={account.id}
                  checked={formData.socialAccountId === account.id}
                  onChange={(e) => setFormData({ ...formData, socialAccountId: e.target.value })}
                  className="text-primary-600"
                />
                <div>
                  <span className="font-medium">{account.platform.name}</span>
                  <span className="text-gray-500 ml-2">@{account.username}</span>
                  <span className="text-gray-400 ml-2">
                    ({account.followerCount.toLocaleString()} followers)
                  </span>
                </div>
              </label>
            ))}
          </div>
          {socialAccounts.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              No social accounts linked.{' '}
              <a href="/dashboard/influencer/accounts" className="text-primary-600 hover:underline">
                {t.applicationForm?.addAccountFirst || 'Add one first'}
              </a>
            </p>
          )}
        </div>
      )}

      {/* Pitch Message */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t.applicationForm?.pitchLabel || 'Why are you a good fit for this campaign?'}
        </label>
        <textarea
          rows={6}
          value={formData.pitchMessage}
          onChange={(e) => setFormData({ ...formData, pitchMessage: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder={t.applicationForm?.pitchPlaceholder || "Tell the brand about yourself, your audience, and why you'd be perfect for this campaign..."}
        />
        <p className="text-xs text-gray-500 mt-1">
          {t.applicationForm?.pitchHint || 'A compelling pitch increases your chances of being selected'}
        </p>
      </div>

      {/* Proposed Rate (for negotiable campaigns) */}
      {isNegotiable && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Your Proposed Rate (optional)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              min="0"
              value={formData.proposedRate}
              onChange={(e) => setFormData({ ...formData, proposedRate: e.target.value })}
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This campaign has negotiable compensation. Suggest your rate.
          </p>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </button>
        <p className="text-xs text-center text-gray-500 mt-3">
          By submitting, you agree to our terms of service
        </p>
      </div>
    </form>
  )
}
