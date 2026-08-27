'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { deriveVerificationStatus } from '@/lib/status'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const COUNTRY_OPTIONS = [
  { value: 'CN', flag: '🇨🇳', en: "People's Republic of China (Mainland)", zh: '中国大陆' },
  { value: 'HK', flag: '🇭🇰', en: 'Hong Kong SAR', zh: '中国香港特别行政区' },
  { value: 'MO', flag: '🇲🇴', en: 'Macao SAR', zh: '中国澳门特别行政区' },
  { value: 'TW', flag: '', en: 'Taiwan, Province of China', zh: '台湾省' },
  { value: 'UK', flag: '🇬🇧', en: 'United Kingdom', zh: '英国' },
  { value: 'CA', flag: '🇨🇦', en: 'Canada', zh: '加拿大' },
  { value: 'US', flag: '🇺🇸', en: 'United States', zh: '美国' },
]

type AccountType = 'brand' | 'agency' | 'individual_pr'

const cardClass = 'workspace-glass-card rounded-3xl p-6 mb-6'
const inputClass =
  'w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300'

// ── Small reusable pieces ────────────────────────────────────────────────

function ChoicePill({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  title: string
  desc?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition ${
        active
          ? 'border-primary-400 bg-primary-50/60 ring-1 ring-primary-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
            active ? 'border-primary-500' : 'border-gray-300'
          }`}
        >
          {active && <span className="w-2 h-2 rounded-full bg-primary-500" />}
        </span>
        <span>
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          {desc && <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>}
        </span>
      </span>
    </button>
  )
}

function useDocUpload(setError: (e: string | null) => void, errUpload: string) {
  const [isUploading, setIsUploading] = useState(false)
  const upload = useCallback(
    async (files: FileList, current: string[], max: number): Promise<string[]> => {
      setError(null)
      const selected = Array.from(files).slice(0, max - current.length)
      if (selected.length === 0) return current
      setIsUploading(true)
      try {
        const fd = new FormData()
        selected.forEach((f) => fd.append('files', f))
        const res = await fetch('/api/brand-verification/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok || !data.urls) throw new Error(data.error || errUpload)
        return [...current, ...data.urls].slice(0, max)
      } catch (err: any) {
        setError(err.message || errUpload)
        return current
      } finally {
        setIsUploading(false)
      }
    },
    [setError, errUpload]
  )
  return { isUploading, upload }
}

function FileField({
  label,
  urls,
  onChange,
  upload,
  isUploading,
  max = 3,
  hint,
  addLabel,
  uploadingLabel,
  removeLabel,
}: {
  label: string
  urls: string[]
  onChange: (urls: string[]) => void
  upload: (files: FileList, current: string[], max: number) => Promise<string[]>
  isUploading: boolean
  max?: number
  hint: string
  addLabel: string
  uploadingLabel: string
  removeLabel: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {urls.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {urls.map((url, i) => (
            <li key={url} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="text-xs text-gray-700 truncate">📄 {url.split('/').pop()}</span>
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
                className="text-xs text-gray-400 hover:text-red-500 transition ml-3 flex-shrink-0"
              >
                {removeLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (e.target.files) {
            const next = await upload(e.target.files, urls, max)
            onChange(next)
          }
          if (ref.current) ref.current.value = ''
        }}
      />
      {urls.length < max && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={isUploading}
          className="px-3.5 py-1.5 bg-white shadow-sm rounded-full text-xs font-semibold text-gray-700 hover:text-primary-700 transition disabled:opacity-50"
        >
          {isUploading ? uploadingLabel : `+ ${addLabel}`}
        </button>
      )}
      <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
    </div>
  )
}

function Field({
  label,
  required,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && '*'}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function BrandVerificationPage() {
  const { t, locale } = useLanguage()
  const v = t.brand.verification
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [country, setCountry] = useState('')

  // Brand/Merchant state
  const [brandProofMethod, setBrandProofMethod] = useState<'trademark' | 'store'>('trademark')
  const [brandName, setBrandName] = useState('')
  const [trademarkRegistryLink, setTrademarkRegistryLink] = useState('')
  const [trademarkDocs, setTrademarkDocs] = useState<string[]>([])
  const [storeName, setStoreName] = useState('')
  const [storeScreenshots, setStoreScreenshots] = useState<string[]>([])
  const [legalName, setLegalName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [creditCode, setCreditCode] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [companyProofMethod, setCompanyProofMethod] = useState<'registryLink' | 'document'>('registryLink')
  const [registryLink, setRegistryLink] = useState('')
  const [companyDocs, setCompanyDocs] = useState<string[]>([])
  const [authMethod, setAuthMethod] = useState<'face' | 'letter' | 'director' | 'tin'>('letter')
  const [faceName, setFaceName] = useState('')
  const [faceIdNo, setFaceIdNo] = useState('')
  const [letterDocs, setLetterDocs] = useState<string[]>([])
  const [applicantName, setApplicantName] = useState('')
  const [applicantPosition, setApplicantPosition] = useState('')
  const [declaration, setDeclaration] = useState(false)
  const [tin, setTin] = useState('')

  // Agency state
  const [agencyLegalName, setAgencyLegalName] = useState('')
  const [agencyRegNumber, setAgencyRegNumber] = useState('')
  const [agencyCountry, setAgencyCountry] = useState('')
  const [agencyWebsite, setAgencyWebsite] = useState('')
  const [representedBrand, setRepresentedBrand] = useState('')
  const [brandWebsite, setBrandWebsite] = useState('')
  const [authProofMethod, setAuthProofMethod] = useState<'brandEmail' | 'letter' | 'chat'>('brandEmail')
  const [authProofDocs, setAuthProofDocs] = useState<string[]>([])

  // Individual PR state
  const [fullName, setFullName] = useState('')

  // Contact (shared)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const { isUploading, upload } = useDocUpload(setError, v.errUpload)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile')
        if (response.ok) {
          const data = await response.json()
          if (data.brandProfile) {
            const b = data.brandProfile
            setProfile(b)
            setContactName(b.contactName || '')
            setContactEmail(b.contactEmail || '')
            setContactPhone(b.contactPhone || '')
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
  const isCn = country === 'CN'
  const isBrandType = accountType === 'brand'

  const countryLabel = (c: (typeof COUNTRY_OPTIONS)[number]) =>
    `${c.flag ? c.flag + ' ' : ''}${locale === 'zh' ? c.zh : c.en}`

  const fileFieldProps = {
    upload,
    isUploading,
    hint: v.uploadHint,
    addLabel: v.addFiles,
    uploadingLabel: v.uploading,
    removeLabel: v.removeDoc,
  }

  const handleSubmit = async () => {
    setError(null)

    // Client-side validation mirrors the server
    if (accountType === 'brand') {
      if (!country || !contactName.trim() || !contactPhone.trim() || (!isCn && !contactEmail.trim())) {
        setError(v.errRequired)
        return
      }
      if (brandProofMethod === 'trademark') {
        if (!brandName.trim()) return setError(v.errRequired)
        if (trademarkDocs.length === 0 && !trademarkRegistryLink.trim()) return setError(v.errChoiceDocs)
      } else {
        if (!storeName.trim()) return setError(v.errRequired)
        if (storeScreenshots.length === 0) return setError(v.errChoiceDocs)
      }
      if (isCn) {
        if (!legalName.trim() || !creditCode.trim()) return setError(v.errRequired)
        if (companyDocs.length === 0) return setError(v.errChoiceDocs)
        if (authMethod === 'face' && (!faceName.trim() || !faceIdNo.trim())) return setError(v.errRequired)
        if (authMethod === 'letter' && letterDocs.length === 0) return setError(v.errChoiceDocs)
      } else {
        if (!legalName.trim() || !regNumber.trim() || !stateProvince.trim()) return setError(v.errRequired)
        if (companyProofMethod === 'registryLink' && !registryLink.trim()) return setError(v.errRequired)
        if (companyProofMethod === 'document' && companyDocs.length === 0) return setError(v.errChoiceDocs)
        if (authMethod === 'director' && (!applicantName.trim() || !applicantPosition.trim() || !declaration))
          return setError(v.errRequired)
        if (authMethod === 'letter' && letterDocs.length === 0) return setError(v.errChoiceDocs)
        if (authMethod === 'tin' && !tin.trim()) return setError(v.errRequired)
      }
    } else if (accountType === 'agency') {
      if (!agencyLegalName.trim() || !representedBrand.trim() || !brandWebsite.trim() || !contactName.trim() || !contactEmail.trim())
        return setError(v.errRequired)
      if (authProofDocs.length === 0) return setError(v.errChoiceDocs)
    } else if (accountType === 'individual_pr') {
      if (!fullName.trim() || !contactEmail.trim() || !contactPhone.trim() || !representedBrand.trim() || !brandWebsite.trim())
        return setError(v.errRequired)
      if (authProofDocs.length === 0) return setError(v.errChoiceDocs)
    } else {
      return
    }

    const payload = {
      type: accountType,
      country: accountType === 'brand' ? country : undefined,
      brandProof:
        accountType === 'brand'
          ? brandProofMethod === 'trademark'
            ? { method: 'trademark', brandName, registryLink: trademarkRegistryLink || undefined, docUrls: trademarkDocs }
            : { method: 'store', storeName, docUrls: storeScreenshots }
          : undefined,
      business:
        accountType === 'brand'
          ? isCn
            ? { legalName, creditCode }
            : { legalName, registrationNo: regNumber, stateProvince }
          : undefined,
      companyProof:
        accountType === 'brand'
          ? isCn
            ? { method: 'document', docUrls: companyDocs }
            : companyProofMethod === 'registryLink'
              ? { method: 'registryLink', registryLink }
              : { method: 'document', docUrls: companyDocs }
          : undefined,
      applicantAuth:
        accountType === 'brand'
          ? authMethod === 'face'
            ? { method: 'face', legalRepName: faceName, legalRepIdNo: faceIdNo }
            : authMethod === 'letter'
              ? { method: 'letter', docUrls: letterDocs }
              : authMethod === 'director'
                ? { method: 'director', applicantName, applicantPosition, declaration }
                : { method: 'tin', tin }
          : undefined,
      agency:
        accountType === 'agency'
          ? { legalName: agencyLegalName, registrationNo: agencyRegNumber || undefined, country: agencyCountry || undefined, website: agencyWebsite || undefined }
          : undefined,
      representedBrand: accountType !== 'brand' ? representedBrand : undefined,
      brandWebsite: accountType !== 'brand' ? brandWebsite : undefined,
      authProof: accountType !== 'brand' ? { method: authProofMethod, docUrls: authProofDocs } : undefined,
      fullName: accountType === 'individual_pr' ? fullName : undefined,
      contact: { name: accountType === 'individual_pr' ? fullName : contactName, email: contactEmail || undefined, phone: contactPhone || undefined },
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/brand-verification/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  if (isLoading) {
    return (
      <BrandWorkspaceLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </BrandWorkspaceLayout>
    )
  }

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

  const typeCards: { value: AccountType; title: string; desc: string }[] = [
    { value: 'brand', title: v.typeBrand, desc: v.typeBrandDesc },
    { value: 'agency', title: v.typeAgency, desc: v.typeAgencyDesc },
    { value: 'individual_pr', title: v.typeIndividual, desc: v.typeIndividualDesc },
  ]

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

        {/* Identity selection */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">{v.stepIdentity}</h2>
            {accountType && (
              <button
                type="button"
                onClick={() => setAccountType(null)}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition"
              >
                {v.changeType}
              </button>
            )}
          </div>
          {accountType === null ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {typeCards.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setAccountType(c.value)}
                  className="text-left p-4 rounded-2xl border border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm transition"
                >
                  <p className="text-sm font-bold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-primary-700">
              {typeCards.find((c) => c.value === accountType)?.title}
            </p>
          )}
        </div>

        {/* ── Brand / Merchant flow ── */}
        {isBrandType && (
          <>
            <div className={cardClass}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{v.regCountry} *</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass}>
                <option value="">{v.selectCountry}</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {countryLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            {country && (
              <>
                {/* 1. Brand or store proof */}
                <div className={cardClass}>
                  <h2 className="font-bold text-gray-900 mb-1">1. {v.secBrandProof} *</h2>
                  <p className="text-xs text-gray-500 mb-4">{v.chooseOne}</p>
                  <div className="space-y-2 mb-4">
                    <ChoicePill
                      active={brandProofMethod === 'trademark'}
                      onClick={() => setBrandProofMethod('trademark')}
                      title={v.optTrademark}
                      desc={isCn ? v.optTrademarkDescCn : v.optTrademarkDescIntl}
                    />
                    <ChoicePill
                      active={brandProofMethod === 'store'}
                      onClick={() => setBrandProofMethod('store')}
                      title={v.optStore}
                    />
                  </div>
                  {brandProofMethod === 'trademark' ? (
                    <div className="space-y-4">
                      <Field label={v.brandNameLabel} required value={brandName} onChange={setBrandName} />
                      {!isCn && (
                        <Field
                          label={v.trademarkRegistryLink}
                          value={trademarkRegistryLink}
                          onChange={setTrademarkRegistryLink}
                          type="url"
                          placeholder="https://"
                        />
                      )}
                      <FileField label={v.trademarkDocs} urls={trademarkDocs} onChange={setTrademarkDocs} {...fileFieldProps} />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Field label={v.storeNameLabel} required value={storeName} onChange={setStoreName} />
                      <FileField label={v.storeScreenshot} urls={storeScreenshots} onChange={setStoreScreenshots} {...fileFieldProps} />
                    </div>
                  )}
                </div>

                {/* 2. Business info */}
                <div className={cardClass}>
                  <h2 className="font-bold text-gray-900 mb-4">2. {v.secBusinessInfo}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isCn ? (
                      <>
                        <Field label={v.companyNameCn} required value={legalName} onChange={setLegalName} />
                        <Field label={v.creditCode} required value={creditCode} onChange={setCreditCode} />
                      </>
                    ) : (
                      <>
                        <Field label={v.legalName} required value={legalName} onChange={setLegalName} />
                        <Field label={v.regNumber} required value={regNumber} onChange={setRegNumber} />
                        <div className="md:col-span-2">
                          <Field
                            label={v.stateProvince}
                            required
                            value={stateProvince}
                            onChange={setStateProvince}
                            hint={v.stateHint}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 3. Company proof */}
                <div className={cardClass}>
                  <h2 className="font-bold text-gray-900 mb-1">3. {v.secCompanyProof} *</h2>
                  {isCn ? (
                    <div className="mt-3">
                      <FileField label={v.cnLicense} urls={companyDocs} onChange={setCompanyDocs} {...fileFieldProps} />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-4">{v.chooseOne}</p>
                      <div className="space-y-2 mb-4">
                        <ChoicePill
                          active={companyProofMethod === 'registryLink'}
                          onClick={() => setCompanyProofMethod('registryLink')}
                          title={v.optRegistryLink}
                        />
                        <ChoicePill
                          active={companyProofMethod === 'document'}
                          onClick={() => setCompanyProofMethod('document')}
                          title={v.optIncorpDoc}
                        />
                      </div>
                      {companyProofMethod === 'registryLink' ? (
                        <Field label={v.registryLink} required value={registryLink} onChange={setRegistryLink} type="url" placeholder="https://" hint={v.stateHint} />
                      ) : (
                        <FileField label={v.incorpDocs} urls={companyDocs} onChange={setCompanyDocs} {...fileFieldProps} />
                      )}
                    </>
                  )}
                </div>

                {/* 4. Applicant authority */}
                <div className={cardClass}>
                  <h2 className="font-bold text-gray-900 mb-1">4. {v.secApplicantAuth} *</h2>
                  <p className="text-xs text-gray-500 mb-4">{v.chooseOne}</p>
                  <div className="space-y-2 mb-4">
                    {isCn ? (
                      <>
                        <ChoicePill active={authMethod === 'face'} onClick={() => setAuthMethod('face')} title={v.optFace} desc={v.optFaceDesc} />
                        <ChoicePill active={authMethod === 'letter'} onClick={() => setAuthMethod('letter')} title={v.optAuthLetter} desc={v.authLetterDescCn} />
                      </>
                    ) : (
                      <>
                        <ChoicePill active={authMethod === 'director'} onClick={() => setAuthMethod('director')} title={v.optDirector} desc={v.optDirectorDesc} />
                        <ChoicePill active={authMethod === 'letter'} onClick={() => setAuthMethod('letter')} title={v.optAuthLetter} desc={v.authLetterDescIntl} />
                        <ChoicePill active={authMethod === 'tin'} onClick={() => setAuthMethod('tin')} title={v.optTin} />
                      </>
                    )}
                  </div>
                  {authMethod === 'face' && isCn && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label={v.faceName} required value={faceName} onChange={setFaceName} />
                      <Field label={v.faceIdNo} required value={faceIdNo} onChange={setFaceIdNo} />
                    </div>
                  )}
                  {authMethod === 'letter' && (
                    <FileField label={v.authLetterDocs} urls={letterDocs} onChange={setLetterDocs} {...fileFieldProps} />
                  )}
                  {authMethod === 'director' && !isCn && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label={v.applicantName} required value={applicantName} onChange={setApplicantName} />
                        <Field label={v.applicantPosition} required value={applicantPosition} onChange={setApplicantPosition} hint={v.directorHint} />
                      </div>
                      <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={declaration}
                          onChange={(e) => setDeclaration(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-xs leading-relaxed">{v.declaration} *</span>
                      </label>
                    </div>
                  )}
                  {authMethod === 'tin' && !isCn && (
                    <Field label={v.tinLabel} required value={tin} onChange={setTin} />
                  )}
                </div>

                {/* 5. Contact */}
                <div className={cardClass}>
                  <h2 className="font-bold text-gray-900 mb-4">5. {v.secContact}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={v.contactName} required value={contactName} onChange={setContactName} />
                    <Field label={v.contactPhone} required value={contactPhone} onChange={setContactPhone} type="tel" placeholder="+1 (555) 123-4567" />
                    <Field label={isCn ? v.contactEmail : v.workEmail} required={!isCn} value={contactEmail} onChange={setContactEmail} type="email" placeholder="contact@company.com" />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Agency / PR flow ── */}
        {accountType === 'agency' && (
          <>
            <div className={cardClass}>
              <h2 className="font-bold text-gray-900 mb-4">1. {v.secAgencyInfo}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={v.agencyLegalName} required value={agencyLegalName} onChange={setAgencyLegalName} />
                <Field label={v.agencyRegNumber} value={agencyRegNumber} onChange={setAgencyRegNumber} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{v.agencyCountry}</label>
                  <select value={agencyCountry} onChange={(e) => setAgencyCountry(e.target.value)} className={inputClass}>
                    <option value="">{v.selectCountry}</option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {countryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <Field label={v.agencyWebsite} value={agencyWebsite} onChange={setAgencyWebsite} type="url" placeholder="https://" />
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="font-bold text-gray-900 mb-4">2. {v.representedBrand}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={v.representedBrand} required value={representedBrand} onChange={setRepresentedBrand} />
                <Field label={v.brandWebsite} required value={brandWebsite} onChange={setBrandWebsite} type="url" placeholder="https://" />
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="font-bold text-gray-900 mb-1">3. {v.secAuthProof} *</h2>
              <p className="text-xs text-gray-500 mb-4">{v.authProofNote}</p>
              <div className="space-y-2 mb-4">
                <ChoicePill
                  active={authProofMethod === 'brandEmail'}
                  onClick={() => setAuthProofMethod('brandEmail')}
                  title={v.optBrandEmail}
                  desc={v.optBrandEmailDesc}
                />
                <ChoicePill active={authProofMethod === 'letter'} onClick={() => setAuthProofMethod('letter')} title={v.optAgencyLetter} />
              </div>
              <FileField label={v.proofUpload} urls={authProofDocs} onChange={setAuthProofDocs} {...fileFieldProps} />
            </div>

            <div className={cardClass}>
              <h2 className="font-bold text-gray-900 mb-4">4. {v.secContact}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={v.contactName} required value={contactName} onChange={setContactName} />
                <Field label={v.workEmail} required value={contactEmail} onChange={setContactEmail} type="email" placeholder="contact@company.com" />
                <Field label={v.contactPhone} value={contactPhone} onChange={setContactPhone} type="tel" />
              </div>
            </div>
          </>
        )}

        {/* ── Individual PR flow ── */}
        {accountType === 'individual_pr' && (
          <>
            <div className={cardClass}>
              <h2 className="font-bold text-gray-900 mb-4">1. {v.secContact}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={v.fullName} required value={fullName} onChange={setFullName} />
                <Field label={v.contactEmail} required value={contactEmail} onChange={setContactEmail} type="email" />
                <Field label={v.contactPhone} required value={contactPhone} onChange={setContactPhone} type="tel" />
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="font-bold text-gray-900 mb-4">2. {v.representedBrand}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={v.brandNameRepresented} required value={representedBrand} onChange={setRepresentedBrand} />
                <Field label={v.brandWebsite} required value={brandWebsite} onChange={setBrandWebsite} type="url" placeholder="https://" />
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="font-bold text-gray-900 mb-1">3. {v.secAuthProof} *</h2>
              <p className="text-xs text-gray-500 mb-4">{v.chooseOne}</p>
              <div className="space-y-2 mb-4">
                <ChoicePill
                  active={authProofMethod === 'brandEmail'}
                  onClick={() => setAuthProofMethod('brandEmail')}
                  title={v.optBrandEmail}
                  desc={v.optBrandEmailDesc}
                />
                <ChoicePill active={authProofMethod === 'letter'} onClick={() => setAuthProofMethod('letter')} title={v.optAgencyLetter} />
                <ChoicePill active={authProofMethod === 'chat'} onClick={() => setAuthProofMethod('chat')} title={v.optChatRecords} />
              </div>
              <FileField label={v.proofUpload} urls={authProofDocs} onChange={setAuthProofDocs} {...fileFieldProps} />
              <p className="mt-3 text-xs text-gray-500">{v.individualBadgeNote}</p>
            </div>
          </>
        )}

        {/* Submit */}
        {accountType && (accountType !== 'brand' || country) && (
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
        )}
      </div>
    </BrandWorkspaceLayout>
  )
}
