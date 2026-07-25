'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function InfluencerProfilePage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    locationCity: '',
    locationState: '',
    locationCountry: 'USA',
    primaryNiche: '',
    secondaryNiches: [] as string[],
    languages: [] as string[],
  })

  const nicheKeys = [
    'Food & Beverage',
    'Beauty & Skincare',
    'Fashion',
    'Lifestyle',
    'Tech & Gaming',
    'Health & Fitness',
    'Travel',
    'Parenting & Family',
    'Home & Decor',
    'Finance',
    'Pets',
    'Entertainment',
  ]

  const languageKeys = ['English', 'Spanish', 'Chinese', 'French', 'German', 'Japanese', 'Korean', 'Portuguese', 'Arabic', 'Hindi']

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        if (data.influencerProfile) {
          setFormData({
            displayName: data.influencerProfile.displayName || data.name || '',
            bio: data.influencerProfile.bio || '',
            locationCity: data.influencerProfile.locationCity || '',
            locationState: data.influencerProfile.locationState || '',
            locationCountry: data.influencerProfile.locationCountry || 'USA',
            primaryNiche: data.influencerProfile.primaryNiche || '',
            secondaryNiches: data.influencerProfile.secondaryNiches || [],
            languages: data.influencerProfile.languages || [],
          })
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerProfile: formData,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSecondaryNiche = (niche: string) => {
    setFormData((prev) => ({
      ...prev,
      secondaryNiches: prev.secondaryNiches.includes(niche)
        ? prev.secondaryNiches.filter((n) => n !== niche)
        : [...prev.secondaryNiches, niche],
    }))
  }

  const toggleLanguage = (lang: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }))
  }

  if (isLoading) {
    return (
      <CreatorWorkspaceLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">{t.influencer.profile.loading}</p>
        </div>
      </CreatorWorkspaceLayout>
    )
  }

  return (
    <CreatorWorkspaceLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t.influencer.profile.title}</h1>
          <p className="text-gray-600 mt-1">{t.influencer.profile.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
              {t.influencer.profile.success}
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.influencer.profile.displayName}</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t.influencer.profile.displayNamePlaceholder}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.influencer.profile.bio}</label>
            <textarea
              rows={4}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t.influencer.profile.bioPlaceholder}
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t.influencer.profile.city}</label>
              <input
                type="text"
                value={formData.locationCity}
                onChange={(e) => setFormData({ ...formData, locationCity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t.influencer.profile.city}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.influencer.profile.stateProvince}</label>
              <input
                type="text"
                value={formData.locationState}
                onChange={(e) => setFormData({ ...formData, locationState: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t.influencer.profile.stateProvince}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.influencer.profile.country}</label>
              <input
                type="text"
                value={formData.locationCountry}
                onChange={(e) => setFormData({ ...formData, locationCountry: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t.influencer.profile.country}
              />
            </div>
          </div>

          {/* Primary Niche */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.influencer.profile.primaryNiche}</label>
            <select
              value={formData.primaryNiche}
              onChange={(e) => setFormData({ ...formData, primaryNiche: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">{t.influencer.profile.selectNiche}</option>
              {nicheKeys.map((niche) => (
                <option key={niche} value={niche}>
                  {t.niches[niche] || niche}
                </option>
              ))}
            </select>
          </div>

          {/* Secondary Niches */}
          <div>
            <label className="block text-sm font-medium mb-2">{t.influencer.profile.secondaryNiches}</label>
            <div className="flex flex-wrap gap-2">
              {nicheKeys
                .filter((n) => n !== formData.primaryNiche)
                .map((niche) => (
                  <button
                    key={niche}
                    type="button"
                    onClick={() => toggleSecondaryNiche(niche)}
                    className={`px-3 py-1 rounded-full text-sm transition ${
                      formData.secondaryNiches.includes(niche)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t.niches[niche] || niche}
                  </button>
                ))}
            </div>
          </div>

          {/* Languages */}
          <div>
            <label className="block text-sm font-medium mb-2">{t.influencer.profile.languages}</label>
            <div className="flex flex-wrap gap-2">
              {languageKeys.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    formData.languages.includes(lang)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t.spokenLanguages[lang] || lang}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition font-medium disabled:opacity-50"
            >
              {isSaving ? t.influencer.profile.saving : t.influencer.profile.saveChanges}
            </button>
          </div>
        </form>
      </div>
    </CreatorWorkspaceLayout>
  )
}
