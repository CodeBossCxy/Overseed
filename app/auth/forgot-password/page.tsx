'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function ForgotPasswordPage() {
  const { t, locale } = useLanguage()
  const s = t.auth.signin

  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const inputClass =
    'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500'

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || s.errorGeneric)
      } else {
        setStep('reset')
      }
    } catch {
      setError(s.errorGeneric)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(s.errorPasswordLength)
      return
    }
    if (password !== confirm) {
      setError(s.errorPasswordMatch)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || s.errorGeneric)
      } else {
        setStep('done')
      }
    } catch {
      setError(s.errorGeneric)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.png" alt="Overseed" className="h-14 w-auto overseed-logo-ink" />
        </Link>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">{s.resetTitle}</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
          )}

          {step === 'email' && (
            <form onSubmit={sendCode} className="space-y-4">
              <p className="text-sm text-gray-600">{s.resetEmailDesc}</p>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  {s.email}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? s.sendingCode : s.sendCode}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={resetPassword} className="space-y-4">
              <p className="text-sm text-gray-600">{s.codeSentDesc}</p>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  {s.codeLabel}
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className={`${inputClass} tracking-widest`}
                  placeholder="123456"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                  {s.newPassword}
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                  {s.confirmPassword}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? s.resetting : s.resetSubmit}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-700">{s.resetSuccess}</p>
              <Link
                href="/auth/signin"
                className="inline-flex justify-center py-3 px-6 rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition"
              >
                {s.backToSignIn}
              </Link>
            </div>
          )}

          {step !== 'done' && (
            <div className="mt-6 text-center">
              <Link href="/auth/signin" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                {s.backToSignIn}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
