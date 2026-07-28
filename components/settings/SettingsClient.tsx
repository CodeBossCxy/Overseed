'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import { signOut } from 'next-auth/react'
import { useTheme, COLOR_THEMES, type ColorTheme } from '@/components/ThemeProvider'

// Kept in sync with the --user-theme-gradient definitions in globals.css so
// the preview cards show exactly what the workspace background will be.
const THEME_SWATCHES: Record<ColorTheme, string> = {
  default: 'linear-gradient(135deg, #eaf2fb 0%, #f2f6fc 50%, #e7eefb 100%)',
  dawn: 'linear-gradient(45deg, #b9c7ee 0%, #dde1f0 20%, #f1eeeb 45%, #f6ede1 70%, #f5e3d0 100%)',
  sunset: 'linear-gradient(180deg, #a3cbe9 0%, #d9e2e1 22%, #efe5d3 33%, #f8d1a2 52%, #f5b87f 75%, #f1a76c 100%)',
}

const CURRENCIES = ['USD', 'CNY', 'EUR', 'GBP', 'HKD', 'JPY', 'CAD', 'AUD', 'SGD']
const TIME_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]
const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']

interface SettingsUser {
  id: string
  name: string | null
  email: string
  emailVerified: boolean
  image: string | null
  preferredLanguage: string
  subscriptionTier: string
  userType: string
  createdAt: string
  hasPassword: boolean
  connectedProviders: string[]
  preferredContentLanguage: string | null
  timeZone: string | null
  dateFormat: string
  displayCurrency: string
  defaultCampaignCurrency: string
  emailNotifications: boolean
  emailCampaignUpdates: boolean
  emailCollaborationUpdates: boolean
  emailPaymentUpdates: boolean
  emailProductUpdates: boolean
  profileDiscoverable: boolean
  allowContactSharing: boolean
  allowBusinessContactSharing: boolean
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
        checked ? 'bg-primary-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function SectionHeader({ n, title, chip, right }: { n: number; title: string; chip?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-1">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold flex items-center justify-center flex-shrink-0">
          {n}
        </span>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {chip}
      </div>
      {right}
    </div>
  )
}

function AccountRow({ title, value, action }: { title: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 border-b border-gray-100 last:border-b-0">
      <p className="text-sm font-medium text-gray-900 w-52 flex-shrink-0">{title}</p>
      <div className="flex-1 min-w-[180px] text-sm text-gray-700 flex items-center gap-2">{value}</div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

const selectClass =
  'px-3 py-2 bg-white rounded-lg text-sm border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300'

export default function SettingsClient({ user }: { user: SettingsUser }) {
  const { locale, setLocale, t, autoTranslateUGC, setAutoTranslateUGC } = useLanguage()
  const { colorTheme, setColorTheme } = useTheme()
  const st = t.settings

  const isBrandSide = user.userType === 'BRAND' || user.userType === 'AGENCY'
  const isCreator = user.userType === 'INFLUENCER'

  const [savedFlash, setSavedFlash] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const themeLabels: Record<ColorTheme, string> = {
    default: st.themeDefault,
    dawn: st.themeDawn,
    sunset: st.themeSunset,
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

  const [prefs, setPrefs] = useState({
    preferredContentLanguage: user.preferredContentLanguage || '',
    timeZone: user.timeZone || '',
    dateFormat: user.dateFormat,
    displayCurrency: user.displayCurrency,
    defaultCampaignCurrency: user.defaultCampaignCurrency,
    emailNotifications: user.emailNotifications,
    emailCampaignUpdates: user.emailCampaignUpdates,
    emailCollaborationUpdates: user.emailCollaborationUpdates,
    emailPaymentUpdates: user.emailPaymentUpdates,
    emailProductUpdates: user.emailProductUpdates,
    profileDiscoverable: user.profileDiscoverable,
    allowContactSharing: user.allowContactSharing,
    allowBusinessContactSharing: user.allowBusinessContactSharing,
  })

  const flashSaved = () => {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const savePreference = async (patch: Partial<typeof prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }))
    try {
      const payload: Record<string, any> = {}
      for (const [k, v] of Object.entries(patch)) {
        payload[k] = k === 'preferredContentLanguage' || k === 'timeZone' ? (v === '' ? null : v) : v
      }
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updatePreferences', ...payload }),
      })
      if (res.ok) flashSaved()
    } catch {}
  }

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

  const notifTiles = [
    {
      key: 'emailCampaignUpdates' as const,
      title: st.notifCampaign,
      desc: st.notifCampaignDesc,
      icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
    },
    {
      key: 'emailCollaborationUpdates' as const,
      title: st.notifCollab,
      desc: st.notifCollabDesc,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    },
    {
      key: 'emailPaymentUpdates' as const,
      title: st.notifPayment,
      desc: st.notifPaymentDesc,
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      key: 'emailProductUpdates' as const,
      title: st.notifProduct,
      desc: st.notifProductDesc,
      icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
    },
  ]

  const joinDate = formatDate(user.createdAt, locale)

  return (
    <div className="max-w-6xl mx-auto pt-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{st.title}</h1>
          <p className="text-gray-500 mt-1">{st.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm text-green-600 transition-opacity ${savedFlash ? 'opacity-100' : 'opacity-0'}`}>
            ✓ {st.saved}
          </span>
          <button
            onClick={() => setColorTheme('default')}
            className="px-4 py-2 bg-white shadow-sm rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            {st.resetToDefault}
          </button>
        </div>
      </div>

      {/* ── 1 Appearance + Preview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <section className="lg:col-span-2 bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
          <SectionHeader
            n={1}
            title={st.sectionAppearance}
            right={
              <button
                onClick={() => setColorTheme('default')}
                className="px-3.5 py-1.5 bg-white shadow-sm rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                {st.resetToDefault}
              </button>
            }
          />
          <p className="text-sm text-gray-500 mb-5 ml-10">{st.appearanceDesc}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {COLOR_THEMES.map((theme) => {
              const selected = colorTheme === theme
              return (
                <button
                  key={theme}
                  onClick={() => setColorTheme(theme)}
                  aria-pressed={selected}
                  className={`relative rounded-2xl border-2 p-2 pb-3 transition text-center ${
                    selected ? 'border-primary-500 bg-primary-50/40' : 'border-transparent bg-white shadow-sm hover:border-primary-200'
                  }`}
                >
                  {selected && (
                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center z-10">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                  {/* Mini workspace preview */}
                  <div className="rounded-xl overflow-hidden p-2 h-24 flex gap-1.5" style={{ background: THEME_SWATCHES[theme] }}>
                    <div className="w-1/3 rounded-md bg-white/75 p-1 space-y-1">
                      <div className="h-1.5 rounded-sm bg-primary-500/60" />
                      <div className="h-1.5 rounded-sm bg-gray-300/80" />
                      <div className="h-1.5 rounded-sm bg-gray-300/80" />
                      <div className="h-1.5 rounded-sm bg-gray-300/80" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="rounded-md bg-white/75 h-9 p-1.5 space-y-1">
                        <div className="h-1.5 w-2/3 rounded-sm bg-gray-400/70" />
                        <div className="h-1.5 w-full rounded-sm bg-gray-300/70" />
                      </div>
                      <div className="rounded-md bg-white/60 h-6" />
                    </div>
                  </div>
                  <p className={`text-xs font-medium mt-2 ${selected ? 'text-primary-700' : 'text-gray-600'}`}>
                    {themeLabels[theme]}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Preview */}
        <section className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900">{st.previewTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{st.previewRealtime}</p>

          <div className="rounded-2xl p-4 space-y-4" style={{ background: THEME_SWATCHES[colorTheme] }}>
            <div className="bg-white/85 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">{st.previewSidebar}</p>
              <div className="space-y-1">
                <div className="px-2 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium">{t.workspace.dashboard}</div>
                <div className="px-2 py-1.5 rounded-lg text-gray-500 text-xs">{t.workspace.messages}</div>
                <div className="px-2 py-1.5 rounded-lg text-gray-500 text-xs">{t.workspace.settings}</div>
              </div>
            </div>
            <div className="bg-white/85 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">{st.previewButton}</p>
              <div className="space-y-2">
                <button type="button" className="w-full px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold shadow-sm">
                  {st.previewPrimaryButton}
                </button>
                <button type="button" className="w-full px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold shadow-sm">
                  {st.previewSecondaryButton}
                </button>
              </div>
            </div>
            <div className="bg-white/85 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">{st.previewCard}</p>
              <p className="text-xs font-bold text-gray-900">{st.previewCardTitle}</p>
              <p className="text-[11px] text-gray-500 mt-1">{st.previewCardBody}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-semibold">
                {st.previewAction}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* ── 2 Language & Region ── */}
      <section className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6 mb-6">
        <SectionHeader
          n={2}
          title={st.sectionLanguageRegion}
          chip={
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
              {st.firstLoginRequired}
            </span>
          }
        />
        <p className="text-sm text-gray-500 mb-5 ml-10">{st.accountRegionNote}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-6 ml-0 lg:ml-10">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">{st.interfaceLanguage}</p>
              <div className="inline-flex bg-gray-100 rounded-full p-1">
                <button
                  onClick={() => setLocale('en')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    locale === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setLocale('zh')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    locale === 'zh' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                  }`}
                >
                  简体中文
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">{st.preferredContentLanguage}</p>
              <select
                className={`${selectClass} w-full max-w-xs`}
                value={prefs.preferredContentLanguage}
                onChange={(e) => savePreference({ preferredContentLanguage: e.target.value })}
              >
                <option value="">{st.contentLanguageAuto}</option>
                <option value="en">English</option>
                <option value="zh">简体中文</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 max-w-xs">
              <p className="text-sm font-medium text-gray-900">{st.autoTranslateUGC}</p>
              <Toggle checked={autoTranslateUGC} onChange={setAutoTranslateUGC} />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">{st.timeZone}</p>
              <select
                className={`${selectClass} w-full max-w-xs`}
                value={prefs.timeZone}
                onChange={(e) => savePreference({ timeZone: e.target.value })}
              >
                <option value="">—</option>
                {TIME_ZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">{st.dateFormat}</p>
              <select
                className={`${selectClass} w-full max-w-xs`}
                value={prefs.dateFormat}
                onChange={(e) => savePreference({ dateFormat: e.target.value })}
              >
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">{st.displayCurrency}</p>
              <select
                className={`${selectClass} w-full max-w-xs`}
                value={prefs.displayCurrency}
                onChange={(e) => savePreference({ displayCurrency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {isCreator && <p className="text-xs text-gray-400 mt-2 max-w-xs">{st.displayCurrencyDesc}</p>}
            </div>
          </div>

          {isBrandSide && (
            <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 self-start">
              <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold mb-2">
                ⚑ {st.brandOnly}
              </span>
              <p className="text-sm font-medium text-gray-900 mb-2">{st.defaultCampaignCurrency}</p>
              <select
                className={`${selectClass} w-full`}
                value={prefs.defaultCampaignCurrency}
                onChange={(e) => savePreference({ defaultCampaignCurrency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">{st.defaultCampaignCurrencyDesc}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── 3 Notifications ── */}
      <section className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6 mb-6">
        <SectionHeader n={3} title={st.sectionNotifications} />
        <div className="flex flex-col xl:flex-row gap-6 mt-4 ml-0 lg:ml-10">
          <div className="xl:w-56 flex-shrink-0">
            <div className="flex items-center justify-between gap-4 xl:block">
              <div>
                <p className="text-sm font-medium text-gray-900">{st.emailNotifications}</p>
                <p className="text-xs text-gray-500 mt-1">{st.emailNotificationsDesc}</p>
              </div>
              <div className="xl:mt-3">
                <Toggle
                  checked={prefs.emailNotifications}
                  onChange={(v) => savePreference({ emailNotifications: v })}
                />
              </div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {notifTiles.map((tile) => (
              <div key={tile.key} className={`flex items-start gap-3 bg-white rounded-2xl shadow-sm p-4 ${prefs.emailNotifications ? '' : 'opacity-50'}`}>
                <div className="w-9 h-9 rounded-full bg-gray-50 shadow-sm flex items-center justify-center text-gray-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={tile.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{tile.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tile.desc}</p>
                </div>
                <Toggle
                  checked={prefs[tile.key]}
                  disabled={!prefs.emailNotifications}
                  onChange={(v) => savePreference({ [tile.key]: v } as any)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4 Account & Privacy ── */}
      <section className="bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
        <SectionHeader n={4} title={st.sectionAccountPrivacy} />

        <div className="mt-2 ml-0 lg:ml-10">
          <AccountRow
            title={st.email}
            value={
              <>
                {user.email}
                {user.emailVerified && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-semibold">
                    {st.verified}
                  </span>
                )}
              </>
            }
          />

          <AccountRow
            title={st.displayName}
            value={
              <div className="flex items-center gap-2 w-full max-w-sm">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                {nameMsg && (
                  <span className={`text-xs ${nameMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{nameMsg.text}</span>
                )}
              </div>
            }
            action={
              <button
                onClick={handleNameSave}
                disabled={nameSaving || name === (user.name || '')}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-40 transition"
              >
                {nameSaving ? st.saving : st.save} ›
              </button>
            }
          />

          <AccountRow
            title={st.connectedLoginMethods}
            value={
              <div className="flex flex-wrap gap-2">
                {user.hasPassword && (
                  <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700">{st.emailPasswordMethod}</span>
                )}
                {user.connectedProviders.map((p) => (
                  <span key={p} className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">{p}</span>
                ))}
                {!user.hasPassword && user.connectedProviders.length === 0 && (
                  <span className="text-sm text-gray-400">{st.notConnected}</span>
                )}
              </div>
            }
          />

          <AccountRow
            title={st.changePassword}
            value={<span className="tracking-widest text-gray-400">••••••••••••</span>}
            action={
              <button
                onClick={() => setShowPasswordForm((v) => !v)}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition"
              >
                {st.updatePassword} ›
              </button>
            }
          />

          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="bg-white rounded-2xl shadow-sm p-4 my-3 space-y-3 max-w-md">
              {user.hasPassword && (
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder={st.currentPasswordPlaceholder}
                />
              )}
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder={st.newPasswordPlaceholder}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder={st.confirmPasswordPlaceholder}
              />
              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{passwordMsg.text}</p>
              )}
              <button
                type="submit"
                disabled={passwordSaving || !newPassword}
                className="px-5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition disabled:opacity-50 text-sm font-medium"
              >
                {passwordSaving ? st.saving : st.updatePassword}
              </button>
            </form>
          )}

          <AccountRow
            title={st.twoStepVerification}
            value={
              <span className="px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-500">{st.comingSoon}</span>
            }
          />

          {/* Privacy toggles */}
          {isCreator && (
            <>
              <AccountRow
                title={st.profileDiscoverability}
                value={<span className="text-xs text-gray-500">{st.profileDiscoverabilityDesc}</span>}
                action={<Toggle checked={prefs.profileDiscoverable} onChange={(v) => savePreference({ profileDiscoverable: v })} />}
              />
              <AccountRow
                title={st.contactSharing}
                value={<span className="text-xs text-gray-500">{st.contactSharingDesc}</span>}
                action={<Toggle checked={prefs.allowContactSharing} onChange={(v) => savePreference({ allowContactSharing: v })} />}
              />
            </>
          )}
          {isBrandSide && (
            <AccountRow
              title={st.campaignContactPreferences}
              value={<span className="text-xs text-gray-500">{st.campaignContactPreferencesDesc}</span>}
              action={<Toggle checked={prefs.allowBusinessContactSharing} onChange={(v) => savePreference({ allowBusinessContactSharing: v })} />}
            />
          )}

          <AccountRow
            title={st.memberSince}
            value={
              <>
                {joinDate}
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-semibold">
                  {user.subscriptionTier === 'PRO' ? 'Pro' : st.freePlan}
                </span>
              </>
            }
          />

          {/* Danger zone */}
          <div className="mt-5 pt-4 border-t border-red-100">
            <p className="text-sm font-semibold text-red-600 mb-1">{st.dangerZone}</p>
            <p className="text-xs text-gray-500 mb-3">{st.deactivateDescription}</p>
            {!showDeactivate ? (
              <button
                onClick={() => setShowDeactivate(true)}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition text-sm font-medium"
              >
                {st.deactivateAccount}
              </button>
            ) : (
              <div className="p-4 bg-red-50 rounded-xl max-w-md">
                <p className="text-sm text-red-700 font-medium mb-3">{st.deactivateConfirm}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeactivate}
                    disabled={deactivating}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-sm disabled:opacity-50"
                  >
                    {deactivating ? st.saving : st.deactivateConfirmButton}
                  </button>
                  <button
                    onClick={() => setShowDeactivate(false)}
                    className="px-4 py-2 border border-gray-300 bg-white rounded-xl hover:bg-gray-50 transition text-sm"
                  >
                    {st.cancel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
