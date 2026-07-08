'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MainLayout from '@/components/MainLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function BrandProfilePage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    companyName: '',
    description: '',
    websiteUrl: '',
    logoUrl: '',
    industry: '',
    companySize: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  })

  const industryKeys = [
    'Beauty & Cosmetics',
    'Fashion & Apparel',
    'Food & Beverage',
    'Health & Wellness',
    'Technology',
    'Travel & Hospitality',
    'Entertainment',
    'Retail',
    'Finance',
    'Education',
    'Other',
  ]

  const companySizeKeys = ['startup', 'small', 'medium', 'enterprise']

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        if (data.brandProfile) {
          setFormData({
            companyName: data.brandProfile.companyName || '',
            description: data.brandProfile.description || '',
            websiteUrl: data.brandProfile.websiteUrl || '',
            logoUrl: data.brandProfile.logoUrl || '',
            industry: data.brandProfile.industry || '',
            companySize: data.brandProfile.companySize || '',
            contactName: data.brandProfile.contactName || '',
            contactEmail: data.brandProfile.contactEmail || '',
            contactPhone: data.brandProfile.contactPhone || '',
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
          brandProfile: formData,
        }),
      })

      if (!response.ok) {
        throw new Error(t.brand.profile.errorUpdate)
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">{t.brand.profile.loading}</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/dashboard/brand')}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.common.backToDashboard}
          </button>
          <h1 className="text-3xl font-bold">{t.brand.profile.title}</h1>
          <p className="text-gray-600 mt-1">{t.brand.profile.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
              {t.brand.profile.success}
            </div>
          )}

          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.brand.profile.companyName}</label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t.brand.profile.companyNamePlaceholder}
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.brand.profile.logoUrl}</label>
            <input
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://example.com/logo.png"
            />
            {formData.logoUrl && (
              <div className="mt-2">
                <img
                  src={formData.logoUrl}
                  alt={t.brand.profile.logoPreviewAlt}
                  className="h-16 object-contain rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.brand.profile.description}</label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t.brand.profile.descriptionPlaceholder}
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.brand.profile.websiteUrl}</label>
            <input
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://yourcompany.com"
            />
          </div>

          {/* Industry & Company Size */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t.brand.profile.industry}</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t.brand.profile.selectIndustry}</option>
                {industryKeys.map((industry) => (
                  <option key={industry} value={industry}>
                    {t.industries[industry] || industry}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.brand.profile.companySize}</label>
              <select
                value={formData.companySize}
                onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t.brand.profile.selectSize}</option>
                {companySizeKeys.map((key) => (
                  <option key={key} value={key}>
                    {t.companySizes[key] || key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Information */}
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium mb-4">{t.brand.profile.contactInfo}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">{t.brand.profile.contactName}</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={t.brand.profile.contactNamePlaceholder}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.brand.profile.contactEmail}</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="contact@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.brand.profile.contactPhone}</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition font-medium disabled:opacity-50"
            >
              {isSaving ? t.brand.profile.saving : t.brand.profile.saveChanges}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
