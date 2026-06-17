'use client'

import { signIn } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type Step = 'form' | 'business-info' | 'otp'

export default function SignUpPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { locale, t } = useLanguage()
  const userType = searchParams.get('type') || null
  const [showWeChatPopup, setShowWeChatPopup] = useState(false)

  // Form state
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Business info state (for brand signup)
  const [businessLegalName, setBusinessLegalName] = useState('')
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState('')
  const [businessCountry, setBusinessCountry] = useState('')
  const [businessWebsite, setBusinessWebsite] = useState('')

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t.auth.signup.errorPasswordsMismatch)
      return
    }

    if (password.length < 8) {
      setError(t.auth.signup.errorPasswordLength)
      return
    }

    // For brand signups, collect business info first
    if (userType === 'brand') {
      setStep('business-info')
      return
    }

    await submitSignup()
  }

  const submitSignup = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, password, userType, locale,
          inviteCode: inviteCode.trim(),
          businessLegalName: businessLegalName || undefined,
          businessRegistrationNo: businessRegistrationNo || undefined,
          businessCountry: businessCountry || undefined,
          businessWebsite: businessWebsite || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t.errors?.somethingWrong)
        return
      }

      setStep('otp')
      setResendCooldown(60)
    } catch {
      setError(t.auth.signup.errorGeneric)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBusinessInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!businessLegalName.trim()) {
      setError(t.signupBusiness?.legalNameRequired || 'Business / Company name is required')
      return
    }
    if (!businessCountry.trim()) {
      setError(t.signupBusiness?.countryRequired || 'Country of registration is required')
      return
    }

    await submitSignup()
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 0) return

    const newOtp = [...otp]
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i]
    }
    setOtp(newOtp)

    // Focus the next empty input or the last one
    const nextEmpty = newOtp.findIndex((d) => !d)
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus()
  }

  const handleVerifyOtp = async () => {
    setError('')
    const code = otp.join('')
    if (code.length !== 6) {
      setError(t.auth.otp.errorFullCode)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t.auth.otp.errorVerification)
        return
      }

      // Auto sign in
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (signInResult?.error) {
        setError(t.auth.otp.errorSignIn)
        return
      }

      router.push(userType === 'brand' ? '/brand' : '/creator')
    } catch {
      setError(t.auth.signup.errorGeneric)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t.errors?.failedToResend)
        return
      }

      setOtp(['', '', '', '', '', ''])
      setResendCooldown(60)
    } catch {
      setError(t.auth.signup.errorGeneric)
    } finally {
      setIsLoading(false)
    }
  }

  const validateInviteCode = async (): Promise<boolean> => {
    if (!inviteCode.trim()) {
      setError(t.beta?.inviteRequired || 'An invite code is required to join the beta')
      return false
    }
    try {
      const res = await fetch('/api/beta/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      })
      const data = await res.json()
      if (!data.valid) {
        setError(data.error || 'Invalid invite code')
        return false
      }
      return true
    } catch {
      setError(t.errors?.failedToValidate || 'Failed to validate invite code')
      return false
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    const valid = await validateInviteCode()
    if (!valid) return
    // Store invite code in sessionStorage so we can record usage after OAuth callback
    sessionStorage.setItem('betaInviteCode', inviteCode.trim().toUpperCase())
    signIn('google', { callbackUrl: userType === 'brand' ? '/brand' : '/creator' })
  }

  const handleWeChatSignIn = async () => {
    setError('')
    const valid = await validateInviteCode()
    if (!valid) return
    sessionStorage.setItem('betaInviteCode', inviteCode.trim().toUpperCase())
    setShowWeChatPopup(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pink_logo_with_txt.png" alt="Overseed" className="h-20 w-auto" />
        </Link>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          {step === 'otp' ? t.auth.otp.title : step === 'business-info' ? (t.signupBusiness?.verificationTitle || 'Business Verification') : t.auth.signup.title}
        </h2>
        {step === 'otp' ? (
          <p className="mt-2 text-center text-sm text-gray-600">
            {t.auth.otp.sentCode} <span className="font-medium">{email}</span>
          </p>
        ) : (
          <>
            {userType && (
              <p className="mt-2 text-center text-sm text-gray-600">
                {t.auth.signup.joiningAs}{' '}
                <span className="font-semibold text-primary-600">
                  {userType === 'brand' ? t.auth.signup.brand : t.auth.signup.creator}
                </span>
              </p>
            )}
            <p className="mt-2 text-center text-sm text-gray-600">
              {t.auth.signup.alreadyHaveAccount}{' '}
              <Link href="/auth/signin" className="font-medium text-primary-600 hover:text-primary-500">
                {t.auth.signup.signIn}
              </Link>
            </p>
          </>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {step === 'business-info' ? (
            /* ===== BUSINESS INFO STEP (brand only) ===== */
            <div>
              <p className="text-sm text-gray-600 mb-4">
                {t.signupBusiness?.verificationDesc || 'To verify your brand, please provide your business details. Your account will be reviewed before you can create campaigns or message creators.'}
              </p>

              {error && (
                <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <form onSubmit={handleBusinessInfoSubmit} className="space-y-4">
                <div>
                  <label htmlFor="businessLegalName" className="block text-sm font-medium text-gray-700">
                    {t.signupBusiness?.legalName || 'Business / Company Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="businessLegalName"
                    type="text"
                    value={businessLegalName}
                    onChange={(e) => setBusinessLegalName(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder={t.signupBusiness?.legalNamePlaceholder || "Acme Inc."}
                  />
                </div>

                <div>
                  <label htmlFor="businessRegistrationNo" className="block text-sm font-medium text-gray-700">
                    {t.signupBusiness?.registrationNo || 'Business Registration Number'}
                  </label>
                  <input
                    id="businessRegistrationNo"
                    type="text"
                    value={businessRegistrationNo}
                    onChange={(e) => setBusinessRegistrationNo(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder={t.signupBusiness?.registrationNoPlaceholder || "e.g. 12345678"}
                  />
                </div>

                <div>
                  <label htmlFor="businessCountry" className="block text-sm font-medium text-gray-700">
                    {t.signupBusiness?.country || 'Country of Registration'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="businessCountry"
                    value={businessCountry}
                    onChange={(e) => setBusinessCountry(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">{t.signupBusiness?.selectCountry || 'Select a country'}</option>
                    <option value="US">{t.signupBusiness?.countries?.us || 'United States'}</option>
                    <option value="GB">{t.signupBusiness?.countries?.uk || 'United Kingdom'}</option>
                    <option value="CA">{t.signupBusiness?.countries?.ca || 'Canada'}</option>
                    <option value="AU">{t.signupBusiness?.countries?.au || 'Australia'}</option>
                    <option value="CN">{t.signupBusiness?.countries?.cn || 'China'}</option>
                    <option value="JP">{t.signupBusiness?.countries?.jp || 'Japan'}</option>
                    <option value="KR">{t.signupBusiness?.countries?.kr || 'South Korea'}</option>
                    <option value="SG">{t.signupBusiness?.countries?.sg || 'Singapore'}</option>
                    <option value="DE">{t.signupBusiness?.countries?.de || 'Germany'}</option>
                    <option value="FR">{t.signupBusiness?.countries?.fr || 'France'}</option>
                    <option value="NL">{t.signupBusiness?.countries?.nl || 'Netherlands'}</option>
                    <option value="SE">{t.signupBusiness?.countries?.se || 'Sweden'}</option>
                    <option value="BR">{t.signupBusiness?.countries?.br || 'Brazil'}</option>
                    <option value="MX">{t.signupBusiness?.countries?.mx || 'Mexico'}</option>
                    <option value="IN">{t.signupBusiness?.countries?.in || 'India'}</option>
                    <option value="AE">{t.signupBusiness?.countries?.ae || 'United Arab Emirates'}</option>
                    <option value="NZ">{t.signupBusiness?.countries?.nz || 'New Zealand'}</option>
                    <option value="IT">{t.signupBusiness?.countries?.it || 'Italy'}</option>
                    <option value="ES">{t.signupBusiness?.countries?.es || 'Spain'}</option>
                    <option value="OTHER">{t.signupBusiness?.countries?.other || 'Other'}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="businessWebsite" className="block text-sm font-medium text-gray-700">
                    {t.signupBusiness?.website || 'Business Website'}
                  </label>
                  <input
                    id="businessWebsite"
                    type="url"
                    value={businessWebsite}
                    onChange={(e) => setBusinessWebsite(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder={t.signupBusiness?.websitePlaceholder || "https://example.com"}
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-700">
                    {t.signupBusiness?.documentsHint || 'You can upload supporting documents (business license, registration certificate) after signing in from your brand profile page.'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? (t.signupBusiness?.submitting || 'Creating account...') : (t.signupBusiness?.submitButton || 'Submit & Create Account')}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setStep('form'); setError('') }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {t.signupBusiness?.back || 'Back'}
                </button>
              </div>
            </div>
          ) : step === 'otp' ? (
            /* ===== OTP VERIFICATION STEP ===== */
            <div>
              {error && (
                <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? t.auth.otp.verifying : t.auth.otp.verifyAndSignIn}
              </button>

              <div className="mt-4 text-center">
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-sm font-medium text-primary-600 hover:text-primary-500 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0
                    ? `${t.auth.otp.resendIn} ${resendCooldown}s`
                    : t.auth.otp.resendCode}
                </button>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setStep('form'); setError(''); setOtp(['', '', '', '', '', '']) }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {t.auth.otp.backToSignup}
                </button>
              </div>
            </div>
          ) : (
            /* ===== SIGNUP FORM STEP ===== */
            <>
              {/* User Type Selection (if not specified) */}
              {!userType && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t.auth.signup.iAmA}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href="/auth/signup?type=brand"
                      className="px-4 py-3 border-2 border-gray-300 rounded-md text-center hover:border-primary-500 hover:bg-primary-50 transition"
                    >
                      <div className="text-2xl mb-1">🏢</div>
                      <div className="font-medium">{t.auth.signup.brand}</div>
                    </Link>
                    <Link
                      href="/auth/signup?type=creator"
                      className="px-4 py-3 border-2 border-gray-300 rounded-md text-center hover:border-primary-500 hover:bg-primary-50 transition"
                    >
                      <div className="text-2xl mb-1">✨</div>
                      <div className="font-medium">{t.auth.signup.creator}</div>
                    </Link>
                  </div>
                </div>
              )}

              {/* Beta Invite Code — required for all signup methods */}
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-amber-800 font-medium">{t.beta?.inviteRequired || 'Beta Access — Invite code required to sign up'}</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="inviteCodeTop" className="block text-sm font-medium text-gray-700">
                  {t.beta?.inviteCode || 'Invite Code'}
                </label>
                <input
                  id="inviteCodeTop"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setError('') }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 font-mono tracking-wider"
                  placeholder="BETA-XXXXXXXX"
                />
              </div>

              {/* OAuth Providers */}
              <div className="space-y-3">
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {t.auth.signup.continueGoogle}
                </button>

                <button
                  onClick={handleWeChatSignIn}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-[#07C160] text-sm font-medium text-white hover:bg-[#06AD51] transition"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
                  </svg>
                  {t.auth.signup.continueWeChat}
                </button>
              </div>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">{t.auth.signup.divider}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    {t.auth.signup.fullName}
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    {t.auth.signup.email}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    {t.auth.signup.password}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    {t.auth.signup.confirmPassword}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? t.auth.signup.creatingAccount : t.auth.signup.createAccount}
                </button>
              </form>

              <div className="mt-6">
                <p className="text-xs text-center text-gray-500">
                  {t.auth.legal.prefix}{' '}
                  <Link href="/terms" className="underline">
                    {t.auth.legal.terms}
                  </Link>{' '}
                  {t.auth.legal.and}{' '}
                  <Link href="/privacy" className="underline">
                    {t.auth.legal.privacy}
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* WeChat Coming Soon Popup */}
      {showWeChatPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowWeChatPopup(false)}>
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-[#07C160] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">{t.auth.wechat.title}</h3>
            <p className="text-gray-600 text-sm mb-4">{t.auth.wechat.descSignup}</p>
            <button
              onClick={() => setShowWeChatPopup(false)}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
            >
              {t.auth.wechat.ok}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
