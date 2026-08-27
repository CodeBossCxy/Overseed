'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { deriveVerificationStatus } from '@/lib/status'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const COUNTRY_OPTIONS = [
  { value: 'US', flag: '🇺🇸', en: 'United States', zh: '美国' },
  { value: 'UK', flag: '🇬🇧', en: 'United Kingdom', zh: '英国' },
  { value: 'CA', flag: '🇨🇦', en: 'Canada', zh: '加拿大' },
  { value: 'AU', flag: '🇦🇺', en: 'Australia', zh: '澳大利亚' },
  { value: 'DE', flag: '🇩🇪', en: 'Germany', zh: '德国' },
  { value: 'FR', flag: '🇫🇷', en: 'France', zh: '法国' },
  { value: 'ES', flag: '🇪🇸', en: 'Spain', zh: '西班牙' },
  { value: 'IT', flag: '🇮🇹', en: 'Italy', zh: '意大利' },
  { value: 'CN', flag: '🇨🇳', en: 'China', zh: '中国' },
  { value: 'HK', flag: '🇭🇰', en: 'Hong Kong SAR', zh: '中国香港特别行政区' },
  { value: 'MO', flag: '🇲🇴', en: 'Macao SAR', zh: '中国澳门特别行政区' },
  { value: 'SG', flag: '🇸🇬', en: 'Singapore', zh: '新加坡' },
  { value: 'JP', flag: '🇯🇵', en: 'Japan', zh: '日本' },
  { value: 'KR', flag: '🇰🇷', en: 'South Korea', zh: '韩国' },
  { value: 'AE', flag: '🇦🇪', en: 'United Arab Emirates', zh: '阿联酋' },
  { value: 'BR', flag: '🇧🇷', en: 'Brazil', zh: '巴西' },
  { value: 'MX', flag: '🇲🇽', en: 'Mexico', zh: '墨西哥' },
]

const MAX_DOCS = 5

export default function BrandVerificationPage() {
  const { t, locale } = useLanguage()
  const v = t.brand.verification
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    accountType: 'brand',
    businessLegalName: '',
    businessRegistrationNo: '',
    businessCountry: '',
    businessWebsite: '',
    contactName: '',
    contactJobTitle: '',
    contactEmail: '',
    contactPhone: '',
  })
  const [documentUrls, setDocumentUrls] = useState<string[]>([])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile')
        if (response.ok) {
          const data = await response.json()
          if (data.brandProfile) {
            const b = data.brandProfile
            setProfile(b)
            setFormData({
              accountType: b.accountType || 'brand',
              businessLegalName: b.businessLegalName || '',
              businessRegistrationNo: b.businessRegistrationNo || '',
              businessCountry: b.businessCountry || '',
              businessWebsite: b.businessWebsite || '',
              contactName: b.contactName || '',
              contactJobTitle: b.contactJobTitle || '',
              contactEmail: b.contactEmail || '',
              contactPhone: b.contactPhone || '',
            })
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const verifState = deriveVerificationStatus(
    profile?.brandVerificationStatus,
    !!profile?.verificationSubmittedAt
  )
  const isVerified = verifState === 'VERIFIED'
  const isUnderReview = verifState === 'UNDER_REVIEW'

  const uploadDocuments = async (files: FileList) => {
    setError(null)
    const remaining = MAX_DOCS - documentUrls.length
    const selected = Array.from(files).slice(0, remaining)
    if (selected.length === 0) return
    setIsUploading(true)
    try {
      const fd = new FormData()
      selected.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/brand-verification/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.urls) throw new Error(data.error || v.errUpload)
      setDocumentUrls((urls) => [...urls, ...data.urls].slice(0, MAX_DOCS))
    } catch (err: any) {
      setError(err.message || v.errUpload)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    setError(null)
    const { accountType, businessLegalName, businessRegistrationNo, businessCountry, contactName, contactEmail } = formData
    if (!accountType || !businessLegalName.trim() || !businessRegistrationNo.trim() || !businessCountry || !contactName.trim() || !contactEmail.trim()) {
      setError(v.errRequired)
      return
    }
    if (documentUrls.length === 0) {
      setError(v.docsRequired)
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/brand-verification/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, documentUrls }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || v.errSubmit)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      setError(err.message || v.errSubmit)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300'

  if (isLoading) {
    return (
      <BrandWorkspaceLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </BrandWorkspaceLayout>
    )
  }

  // Verified / under review / just submitted — show status card instead of the form
  if (isVerified || isUnderReview || submitted) {
    const title = isVerified ? v.alreadyVerifiedTitle : submitted ? v.successTitle : v.underReviewTitle
    const desc = isVerified ? v.alreadyVerifiedDesc : submitted ? v.successDesc : v.underReviewDesc
    return (
      <BrandWorkspaceLayout>
        <div className="max-w-3xl mx-auto workspace-page-tight pb-8">
          <div className="workspace-glass-card rounded-3xl p-10 text-center">
            <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${isVerified ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              {isVerified ? (
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
            <p className="text-sm text-gray-500 mb-6">{desc}</p>
            <Link
              href="/dashboard/brand/profile"
              className="inline-block px-5 py-2.5 bg-primary-600 text-white rounded-full text-sm font-semibold hover:bg-primary-700 transition"
            >
              {v.backToProfile}
            </Link>
          </div>
        </div>
      </BrandWorkspaceLayout>
    )
  }

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-3xl mx-auto workspace-page-tight pb-8">
        <div className="mb-6">
          <Link href="/dashboard/brand/profile" className="text-sm text-gray-500 hover:text-primary-700 transition">
            ← {v.backToProfile}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{v.title}</h1>
          <p className="text-gray-500 mt-1">{v.subtitle}</p>
        </div>

        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

        {/* Business Information */}
        <div className="workspace-glass-card rounded-3xl p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">{v.sectionBusiness}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.accountType} *</label>
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                className={inputClass}
              >
                <option value="brand">{v.accountTypeBrand}</option>
                <option value="agency">{v.accountTypeAgency}</option>
                <option value="individual_pr">{v.accountTypeIndividual}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.regCountry} *</label>
              <select
                value={formData.businessCountry}
                onChange={(e) => setFormData({ ...formData, businessCountry: e.target.value })}
                className={inputClass}
              >
                <option value="">{v.selectCountry}</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.flag} {locale === 'zh' ? c.zh : c.en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.legalName} *</label>
              <input
                type="text"
                value={formData.businessLegalName}
                onChange={(e) => setFormData({ ...formData, businessLegalName: e.target.value })}
                className={inputClass}
                placeholder={v.legalNamePlaceholder}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.regNumber} *</label>
              <input
                type="text"
                value={formData.businessRegistrationNo}
                onChange={(e) => setFormData({ ...formData, businessRegistrationNo: e.target.value })}
                className={inputClass}
                placeholder={v.regNumberPlaceholder}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.businessWebsite}</label>
              <input
                type="url"
                value={formData.businessWebsite}
                onChange={(e) => setFormData({ ...formData, businessWebsite: e.target.value })}
                className={inputClass}
                placeholder="https://yourcompany.com"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="workspace-glass-card rounded-3xl p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">{v.sectionContact}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.contactName} *</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className={inputClass}
                placeholder={v.contactNamePlaceholder}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.jobTitle}</label>
              <input
                type="text"
                value={formData.contactJobTitle}
                onChange={(e) => setFormData({ ...formData, contactJobTitle: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.workEmail} *</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className={inputClass}
                placeholder="contact@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.contactPhone}</label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className={inputClass}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="workspace-glass-card rounded-3xl p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-1">{v.sectionDocuments} *</h2>
          <p className="text-xs text-gray-500 mb-4">{v.documentsHelp}</p>

          {documentUrls.length > 0 && (
            <ul className="space-y-2 mb-4">
              {documentUrls.map((url, i) => (
                <li key={url} className="flex items-center justify-between px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-sm text-gray-700 truncate">
                    📄 {url.split('/').pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDocumentUrls(documentUrls.filter((_, j) => j !== i))}
                    className="text-xs text-gray-400 hover:text-red-500 transition ml-3 flex-shrink-0"
                  >
                    {v.removeDoc}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadDocuments(e.target.files)}
          />
          {documentUrls.length < MAX_DOCS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 bg-white shadow-sm rounded-full text-sm font-semibold text-gray-700 hover:text-primary-700 transition disabled:opacity-50"
            >
              {isUploading ? v.uploading : `+ ${v.addDocuments}`}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-gray-400">
            <p>{v.requiredNote}</p>
            <p className="mt-1">{v.privacyNote}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-full text-sm font-semibold shadow-sm hover:bg-primary-700 transition disabled:opacity-50 whitespace-nowrap"
          >
            {isSubmitting ? v.submitting : v.submit}
          </button>
        </div>
      </div>
    </BrandWorkspaceLayout>
  )
}
