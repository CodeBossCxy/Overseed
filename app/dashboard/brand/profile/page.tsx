'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import { deriveVerificationStatus } from '@/lib/status'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Company Profile per spec: (1) Account & Verification summary card;
// (2) Public Profile (creator-visible, always editable, logo upload) +
// Business Information (from the verification submission, locked fields,
// never shown to creators).

const INDUSTRY_KEYS = [
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
const COMPANY_SIZE_KEYS = ['startup', 'small', 'medium', 'enterprise']
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

const LEGACY_COUNTRY_LABELS: Record<string, { en: string; zh: string }> = {
  USA: { en: 'United States', zh: '美国' },
  'United States': { en: 'United States', zh: '美国' },
  'United Kingdom': { en: 'United Kingdom', zh: '英国' },
  Canada: { en: 'Canada', zh: '加拿大' },
  Australia: { en: 'Australia', zh: '澳大利亚' },
  Germany: { en: 'Germany', zh: '德国' },
  France: { en: 'France', zh: '法国' },
  Spain: { en: 'Spain', zh: '西班牙' },
  Italy: { en: 'Italy', zh: '意大利' },
  China: { en: 'China', zh: '中国' },
  'Hong Kong': { en: 'Hong Kong SAR', zh: '中国香港特别行政区' },
  Macau: { en: 'Macao SAR', zh: '中国澳门特别行政区' },
  Korea: { en: 'South Korea', zh: '韩国' },
  UAE: { en: 'United Arab Emirates', zh: '阿联酋' },
  Brazil: { en: 'Brazil', zh: '巴西' },
  Mexico: { en: 'Mexico', zh: '墨西哥' },
}

export default function BrandProfilePage() {
  const { t, locale } = useLanguage()
  const p = t.brand.profile
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<any>(null)
  const [formData, setFormData] = useState({
    companyName: '',
    description: '',
    websiteUrl: '',
    storeUrl: '',
    logoUrl: '',
    countries: [] as string[],
    industries: [] as string[],
    socialLinks: [] as string[],
    companySize: '',
    accountType: '',
    contactName: '',
    contactJobTitle: '',
    contactEmail: '',
    contactPhone: '',
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        if (data.brandProfile) {
          const b = data.brandProfile
          setProfile(b)
          setFormData({
            companyName: b.companyName || '',
            description: b.description || '',
            websiteUrl: b.websiteUrl || '',
            storeUrl: b.storeUrl || '',
            logoUrl: b.logoUrl || '',
            countries: b.countries || [],
            industries: b.industries || (b.industry ? [b.industry] : []),
            socialLinks: b.socialLinks || [],
            companySize: b.companySize || '',
            accountType: b.accountType || '',
            contactName: b.contactName || '',
            contactJobTitle: b.contactJobTitle || '',
            contactEmail: b.contactEmail || '',
            contactPhone: b.contactPhone || '',
          })
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isVerified = profile?.brandVerificationStatus === 'APPROVED'
  const verifState = deriveVerificationStatus(profile?.brandVerificationStatus, !!profile?.verificationSubmittedAt)

  // Public-profile completion for the summary card
  const completionChecks = [
    !!formData.logoUrl,
    !!formData.companyName,
    !!formData.description,
    formData.countries.length > 0,
    formData.industries.length > 0,
  ]
  const completionPct = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const uploadLogo = async (file: File) => {
    setIsUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('files', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.urls?.[0]) throw new Error(data.message || p.errorUpdate)
      setFormData((f) => ({ ...f, logoUrl: data.urls[0] }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandProfile: formData }),
      })
      if (!response.ok) throw new Error(p.errorUpdate)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass =
    'w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300'
  const lockedClass =
    'w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed'

  const accountTypeLabel = (v: string) =>
    v === 'agency' ? p.accountTypeAgency : v === 'individual_pr' ? p.accountTypeIndividual : v === 'brand' ? p.accountTypeBrand : '—'
  const countryOptionLabel = (option: (typeof COUNTRY_OPTIONS)[number]) =>
    `${option.flag} ${locale === 'zh' ? option.zh : option.en}`
  const countryLabel = (value?: string | null) => {
    if (!value) return '—'
    const byCode = COUNTRY_OPTIONS.find((c) => c.value === value)
    if (byCode) return countryOptionLabel(byCode)
    const legacy = LEGACY_COUNTRY_LABELS[value]
    return legacy ? legacy[locale === 'zh' ? 'zh' : 'en'] : value
  }

  if (isLoading) {
    return (
      <BrandWorkspaceLayout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">{p.loading}</p>
        </div>
      </BrandWorkspaceLayout>
    )
  }

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-4xl mx-auto workspace-page-tight pb-8">
        {/* Header + actions */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{p.title}</h1>
            <p className="text-gray-500 mt-1">{p.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(true)}
              className="px-4 py-2.5 bg-white shadow-sm rounded-xl text-sm font-semibold text-gray-700 hover:text-primary-700 transition"
            >
              {p.previewProfile}
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}
        {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600">{p.success}</div>}

        {/* ── Card 1: Account & Verification ── */}
        <div className="workspace-glass-card rounded-3xl p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">{p.accountVerification}</h2>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-gray-700">{p.businessVerification}</span>
              <StatusBadge machine="verification" status={verifState} size="sm" dot />
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-gray-700">{p.paymentMethod}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${profile?.stripeCustomerId ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                {profile?.stripeCustomerId ? t.brand.dashboard.stepAdded : t.brand.dashboard.stepNotStarted}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-gray-700">{p.profileCompletion}</span>
              <div className="flex items-center gap-3">
                <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
                </div>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{completionPct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2a: Public Profile ── */}
        <div className="workspace-glass-card rounded-3xl p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="font-bold text-gray-900">{p.publicProfile}</h2>
              <p className="text-xs text-gray-500 mt-1">{p.publicProfileNote}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-full text-sm font-semibold shadow-sm hover:bg-primary-700 transition disabled:opacity-50"
            >
              {isSaving ? p.saving : p.saveChanges}
            </button>
          </div>

          <div className="space-y-5">
            {/* Logo upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{p.logo}</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {formData.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={formData.logoUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-white shadow-sm rounded-full text-sm font-semibold text-gray-700 hover:text-primary-700 transition disabled:opacity-50"
                >
                  {isUploading ? p.uploading : p.uploadLogo}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{p.displayName} *</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className={inputClass}
                  placeholder={p.companyNamePlaceholder}
                />
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{p.displayNameHelp}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{p.companySize} <span className="text-gray-400 font-normal">({p.optionalTag})</span></label>
                <select
                  value={formData.companySize}
                  onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                  className={inputClass}
                >
                  <option value="">{p.selectSize}</option>
                  {COMPANY_SIZE_KEYS.map((key) => (
                    <option key={key} value={key}>{t.companySizes[key] || key}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{p.description}</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={inputClass}
                placeholder={p.descriptionPlaceholder}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{p.websiteUrl} <span className="text-gray-400 font-normal">({p.optionalTag})</span></label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className={inputClass}
                  placeholder="https://yourcompany.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{p.storeUrl} <span className="text-gray-400 font-normal">({p.optionalTag})</span></label>
                <input
                  type="url"
                  value={formData.storeUrl}
                  onChange={(e) => setFormData({ ...formData, storeUrl: e.target.value })}
                  className={inputClass}
                  placeholder="https://store.yourcompany.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{p.countryRegion} <span className="text-gray-400 font-normal">({p.multipleSelections})</span> *</label>
              <div className="flex flex-wrap gap-2">
                {COUNTRY_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, countries: toggleIn(formData.countries, c.value) })}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${
                      formData.countries.includes(c.value) ? 'selected-option-glass text-gray-900 font-bold' : 'bg-gray-100 text-gray-700 font-medium hover:bg-gray-200'
                    }`}
                  >
                    {countryOptionLabel(c)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{p.industryCategory} <span className="text-gray-400 font-normal">({p.multipleSelections})</span> *</label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRY_KEYS.map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setFormData({ ...formData, industries: toggleIn(formData.industries, ind) })}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${
                      formData.industries.includes(ind) ? 'selected-option-glass text-gray-900 font-bold' : 'bg-gray-100 text-gray-700 font-medium hover:bg-gray-200'
                    }`}
                  >
                    {t.industries[ind] || ind}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {p.socialLinksLabel} <span className="text-gray-400 font-normal">({p.optionalTag})</span>
              </label>
              <div className="space-y-2">
                {formData.socialLinks.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => {
                        const links = [...formData.socialLinks]
                        links[i] = e.target.value
                        setFormData({ ...formData, socialLinks: links })
                      }}
                      className={inputClass}
                      placeholder="https://instagram.com/yourbrand"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, socialLinks: formData.socialLinks.filter((_, j) => j !== i) })}
                      className="px-3 text-gray-400 hover:text-red-500 transition"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {formData.socialLinks.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, socialLinks: [...formData.socialLinks, ''] })}
                    className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition"
                  >
                    + {p.addLink}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2b: Business Information ── */}
        <div className="workspace-glass-card rounded-3xl p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900">{p.businessInfo}</h2>
              <p className="text-xs text-gray-500 mt-1">{p.businessInfoNote}</p>
            </div>
            {!isVerified && (
              <Link
                href="/contact"
                className="px-4 py-2 bg-primary-600 text-white rounded-full text-xs font-semibold hover:bg-primary-700 transition whitespace-nowrap"
              >
                {p.startVerification}
              </Link>
            )}
          </div>

          {!isVerified && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
              {p.verifyToPublish}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {p.accountType}
                {isVerified && <span className="ml-2 text-[11px] text-gray-400">🔒 {p.lockedAfterVerification}</span>}
              </label>
              {isVerified ? (
                <p className={lockedClass}>{accountTypeLabel(formData.accountType)}</p>
              ) : (
                <select
                  value={formData.accountType}
                  onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="brand">{p.accountTypeBrand}</option>
                  <option value="agency">{p.accountTypeAgency}</option>
                  <option value="individual_pr">{p.accountTypeIndividual}</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{p.regCountry}</label>
              <p className={lockedClass}>{countryLabel(profile?.businessCountry)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {p.legalName}
                {isVerified && <span className="ml-2 text-[11px] text-gray-400">🔒 {p.lockedAfterVerification}</span>}
              </label>
              <p className={lockedClass}>{profile?.businessLegalName || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {p.regNumber}
                {isVerified && <span className="ml-2 text-[11px] text-gray-400">🔒 {p.lockedAfterVerification}</span>}
              </label>
              <p className={lockedClass}>{profile?.businessRegistrationNo || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{p.contactName}</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className={inputClass}
                placeholder={p.contactNamePlaceholder}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{p.jobTitle}</label>
              <input
                type="text"
                value={formData.contactJobTitle}
                onChange={(e) => setFormData({ ...formData, contactJobTitle: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{p.workEmail}</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className={inputClass}
                placeholder="contact@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{p.contactPhone}</label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className={inputClass}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-5">{p.verifMaterialsNote}</p>
        </div>
      </div>

      {/* Preview modal — the creator-facing view */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPreview(false)}>
          <div data-solid className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900">{p.previewTitle}</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-700" aria-label={p.close}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-5">{p.previewNote}</p>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                {formData.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xl font-bold text-gray-300">{(formData.companyName || '?').charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="font-bold text-gray-900 flex items-center gap-1.5">
                  {formData.companyName || '—'}
                  {isVerified && (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l2.4 2.4 3.3-.5.5 3.3L20.6 9.6 22 12l-1.4 2.4.6 3.3-3.3.5L15.4 21.6 12 20.2 8.6 21.6 6.1 18.2l-3.3-.5.6-3.3L2 12l1.4-2.4-.5-3.3 3.3.5L8.6 2.4 12 2zm-1.2 12.7l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" />
                    </svg>
                  )}
                </p>
                {isVerified && <p className="text-xs text-gray-500">{t.brand.dashboard.verifiedBusiness}</p>}
              </div>
            </div>

            {formData.description && <p className="text-sm text-gray-600 mt-4">{formData.description}</p>}

            {(formData.countries.length > 0 || formData.industries.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {formData.industries.map((ind) => (
                  <span key={ind} className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                    {t.industries[ind] || ind}
                  </span>
                ))}
                {formData.countries.map((c) => (
                  <span key={c} className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{countryLabel(c)}</span>
                ))}
              </div>
            )}

            {(formData.websiteUrl || formData.storeUrl || formData.socialLinks.filter(Boolean).length > 0) && (
              <div className="mt-4 space-y-1">
                {[formData.websiteUrl, formData.storeUrl, ...formData.socialLinks].filter(Boolean).map((link, i) => (
                  <p key={i} className="text-xs text-primary-600 truncate">{link}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </BrandWorkspaceLayout>
  )
}
