'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useViewMode } from '@/lib/hooks/useViewMode'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Mandatory first-login Language & Region setup (per spec: 必须在首次登录时选择,
// 之后可在 Settings 随时修改). Shows once per account until saved.

const CURRENCIES = ['USD', 'CNY', 'EUR', 'GBP', 'HKD', 'JPY', 'CAD', 'AUD', 'SGD']
const TIME_ZONES = [
  'UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Paris',
  'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
]
const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']

export default function LanguageSetupModal() {
  const { data: session } = useSession()
  const { isBrand } = useViewMode()
  const { locale, setLocale, t, autoTranslateUGC, setAutoTranslateUGC } = useLanguage()
  const st = t.settings

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState({
    preferredContentLanguage: '',
    timeZone: '',
    dateFormat: 'MM/DD/YYYY',
    displayCurrency: 'USD',
    defaultCampaignCurrency: 'USD',
  })

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/user/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        if (data.needsLanguageSetup) {
          setPrefs({
            preferredContentLanguage: data.preferredContentLanguage || '',
            timeZone: data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            dateFormat: data.dateFormat || 'MM/DD/YYYY',
            displayCurrency: data.displayCurrency || 'USD',
            defaultCampaignCurrency: data.defaultCampaignCurrency || 'USD',
          })
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [session?.user])

  if (!open) return null

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePreferences',
          preferredContentLanguage: prefs.preferredContentLanguage || null,
          timeZone: TIME_ZONES.includes(prefs.timeZone) ? prefs.timeZone : prefs.timeZone || null,
          dateFormat: prefs.dateFormat,
          displayCurrency: prefs.displayCurrency,
          ...(isBrand ? { defaultCampaignCurrency: prefs.defaultCampaignCurrency } : {}),
        }),
      })
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completeLanguageSetup' }),
      })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const selectClass =
    'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div data-solid className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900">{st.setupTitle}</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">{st.setupSubtitle}</p>

        {/* Interface language (required) */}
        <p className="text-sm font-medium text-gray-700 mb-2">{st.interfaceLanguage} *</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {([['en', 'English'], ['zh', '简体中文']] as const).map(([code, label]) => (
            <button
              key={code}
              onClick={() => setLocale(code)}
              className={`px-4 py-3 rounded-2xl text-sm font-semibold border-2 transition ${
                locale === code
                  ? 'border-primary-500 bg-primary-50/50 text-primary-700'
                  : 'border-gray-200 text-gray-700 hover:border-primary-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{st.preferredContentLanguage}</label>
            <select
              value={prefs.preferredContentLanguage}
              onChange={(e) => setPrefs({ ...prefs, preferredContentLanguage: e.target.value })}
              className={selectClass}
            >
              <option value="">{st.contentLanguageAuto}</option>
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{st.timeZone}</label>
            <select
              value={TIME_ZONES.includes(prefs.timeZone) ? prefs.timeZone : ''}
              onChange={(e) => setPrefs({ ...prefs, timeZone: e.target.value })}
              className={selectClass}
            >
              <option value="">—</option>
              {TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{st.dateFormat}</label>
            <select
              value={prefs.dateFormat}
              onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value })}
              className={selectClass}
            >
              {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{st.displayCurrency}</label>
            <select
              value={prefs.displayCurrency}
              onChange={(e) => setPrefs({ ...prefs, displayCurrency: e.target.value })}
              className={selectClass}
            >
              {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
            </select>
          </div>
          {isBrand && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{st.defaultCampaignCurrency}</label>
              <select
                value={prefs.defaultCampaignCurrency}
                onChange={(e) => setPrefs({ ...prefs, defaultCampaignCurrency: e.target.value })}
                className={selectClass}
              >
                {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">{st.defaultCampaignCurrencyDesc}</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 bg-gray-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">{st.autoTranslateUGC}</p>
            <p className="text-xs text-gray-400">{st.autoTranslateUGCDescription}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoTranslateUGC}
            onClick={() => setAutoTranslateUGC(!autoTranslateUGC)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
              autoTranslateUGC ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${autoTranslateUGC ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4">{st.setupChangeLater}</p>

        <button
          onClick={save}
          disabled={saving}
          className="mt-4 w-full px-6 py-3 bg-primary-600 text-white rounded-2xl text-sm font-bold hover:bg-primary-700 transition disabled:opacity-50"
        >
          {saving ? st.saving : st.setupGetStarted}
        </button>
      </div>
    </div>
  )
}
