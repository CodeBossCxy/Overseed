'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import { signOut } from 'next-auth/react'
import { useTheme, COLOR_THEMES, type ColorTheme } from '@/components/ThemeProvider'

const THEME_SWATCHES: Record<ColorTheme, string> = {
  default: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)',
  sunset: 'linear-gradient(135deg, #d7e6f5 0%, #f9d5b5 50%, #f0a877 100%)',
  sky: 'linear-gradient(135deg, #c9dff6 0%, #dcebf9 50%, #f8ddc2 100%)',
  cream: 'linear-gradient(135deg, #e8f0f9 0%, #f7efe4 50%, #f8d9ba 100%)',
  lavender: 'linear-gradient(135deg, #e3e2f9 0%, #ece5fa 50%, #f9e0d6 100%)',
}

interface SettingsUser {
  id: string
  name: string | null
  email: string
  image: string | null
  preferredLanguage: string
  subscriptionTier: string
  userType: string
  createdAt: string
}

export default function SettingsClient({ user }: { user: SettingsUser }) {
  const { locale, setLocale, t, autoTranslateUGC, setAutoTranslateUGC } = useLanguage()
  const { colorTheme, setColorTheme } = useTheme()
  const st = t.settings

  const themeLabels: Record<ColorTheme, string> = {
    default: st.themeDefault,
    sunset: st.themeSunset,
    sky: st.themeSky,
    cream: st.themeCream,
    lavender: st.themeLavender,
  }

  // Name editing
  const [name, setName] = useState(user.name || '')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Deactivation
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const handleNameSave = async () => {
    setNameSaving(true)
    setNameMsg(null)
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateName', name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNameMsg({ type: 'success', text: st.saved })
      setTimeout(() => setNameMsg(null), 3000)
    } catch (err: any) {
      setNameMsg({ type: 'error', text: err.message || st.errorGeneric })
    } finally {
      setNameSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMsg(null)

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: st.passwordMinLength })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: st.passwordMismatch })
      return
    }

    setPasswordSaving(true)
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changePassword', currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPasswordMsg({ type: 'success', text: st.passwordChanged })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMsg(null), 3000)
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || st.errorGeneric })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleDeactivate = async () => {
    setDeactivating(true)
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivateAccount' }),
      })
      if (res.ok) {
        signOut({ callbackUrl: '/' })
      }
    } catch {
      setDeactivating(false)
    }
  }

  const joinDate = formatDate(user.createdAt, locale)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{st.title}</h1>

      {/* Account Info Section */}
      <section className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{st.accountInfo}</h2>

        {/* Email (read-only) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{st.email}</label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full px-4 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{st.displayName}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={handleNameSave}
              disabled={nameSaving || name === (user.name || '')}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition disabled:opacity-50 text-sm"
            >
              {nameSaving ? st.saving : st.save}
            </button>
          </div>
          {nameMsg && (
            <p className={`mt-1 text-sm ${nameMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {nameMsg.text}
            </p>
          )}
        </div>

        {/* Account details */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <span className="text-sm text-gray-500">{st.plan}</span>
            <p className="font-medium">{user.subscriptionTier === 'PRO' ? 'Pro' : st.freePlan}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">{st.memberSince}</span>
            <p className="font-medium">{joinDate}</p>
          </div>
        </div>
      </section>

      {/* Language Preference Section */}
      <section className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{st.languagePreference}</h2>
        <p className="text-sm text-gray-500 mb-3">{st.languageDescription}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setLocale('en')}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
              locale === 'en'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLocale('zh')}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
              locale === 'zh'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            中文
          </button>
        </div>
      </section>

      {/* Theme Color Section */}
      <section className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{st.themeColor}</h2>
        <p className="text-sm text-gray-500 mb-4">{st.themeColorDescription}</p>
        <div className="flex flex-wrap gap-4">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme}
              onClick={() => setColorTheme(theme)}
              className="flex flex-col items-center gap-2 group"
              aria-pressed={colorTheme === theme}
            >
              <span
                className={`relative w-14 h-14 rounded-full border transition ${
                  colorTheme === theme
                    ? 'ring-2 ring-primary-500 ring-offset-2 border-transparent'
                    : 'border-gray-200 group-hover:ring-2 group-hover:ring-primary-200 group-hover:ring-offset-2'
                }`}
                style={{ background: THEME_SWATCHES[theme] }}
              >
                {colorTheme === theme && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </span>
              <span className={`text-xs font-medium ${colorTheme === theme ? 'text-primary-600' : 'text-gray-600'}`}>
                {themeLabels[theme]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Content Translation Section */}
      <section className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{st.autoTranslateUGC || 'Content Translation'}</h2>
        <p className="text-sm text-gray-500 mb-3">
          {st.autoTranslateUGCDescription || 'Automatically translate user-generated content (campaign descriptions, bios, etc.) to your preferred language.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setAutoTranslateUGC(true)}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
              autoTranslateUGC
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {st.autoTranslateUGCOn || 'Auto-translate'}
          </button>
          <button
            onClick={() => setAutoTranslateUGC(false)}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
              !autoTranslateUGC
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {st.autoTranslateUGCOff || 'Show Original'}
          </button>
        </div>
      </section>

      {/* Change Password Section */}
      <section className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{st.changePassword}</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{st.currentPassword}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={st.currentPasswordPlaceholder}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{st.newPassword}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={st.newPasswordPlaceholder}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{st.confirmPassword}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={st.confirmPasswordPlaceholder}
            />
          </div>
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {passwordMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={passwordSaving || !newPassword}
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition disabled:opacity-50 text-sm"
          >
            {passwordSaving ? st.saving : st.updatePassword}
          </button>
        </form>
      </section>

      {/* Danger Zone */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-red-100">
        <h2 className="text-lg font-semibold text-red-600 mb-2">{st.dangerZone}</h2>
        <p className="text-sm text-gray-500 mb-4">{st.deactivateDescription}</p>
        {!showDeactivate ? (
          <button
            onClick={() => setShowDeactivate(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition text-sm"
          >
            {st.deactivateAccount}
          </button>
        ) : (
          <div className="p-4 bg-red-50 rounded-md">
            <p className="text-sm text-red-700 font-medium mb-3">{st.deactivateConfirm}</p>
            <div className="flex gap-3">
              <button
                onClick={handleDeactivate}
                disabled={deactivating}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-sm disabled:opacity-50"
              >
                {deactivating ? st.saving : st.deactivateConfirmButton}
              </button>
              <button
                onClick={() => setShowDeactivate(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition text-sm"
              >
                {st.cancel}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
