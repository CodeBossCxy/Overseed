'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import { PlatformIcon } from '@/components/campaigns/CampaignRowCard'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Creator Profile per spec 4.5 — two tabs: Public Profile (brand-visible
// info + live preview) and Social Accounts (per-platform cards; at least one
// verified account is required before applying to campaigns).

const CATEGORY_OPTIONS = [
  'Beauty & Skincare', 'Fashion', 'Lifestyle', 'Tech & Gaming', 'Food & Beverage',
  'Health & Fitness', 'Travel', 'Parenting & Family', 'Home & Decor', 'Finance', 'Pets', 'Entertainment',
]
const LANGUAGE_OPTIONS = ['English', 'Chinese', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Portuguese', 'Arabic', 'Hindi']
const COUNTRY_OPTIONS = ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'China', 'Hong Kong', 'Singapore', 'Japan', 'Korea', 'UAE', 'Brazil', 'Mexico']
const COLLAB_TYPES = ['gifted', 'paid', 'performance'] as const

function accountVerifState(acc: any): string {
  if (acc.isVerified) return 'VERIFIED'
  if (acc.screenshotUrl || acc.verificationMethod) return 'UNDER_REVIEW'
  return 'NOT_VERIFIED'
}

export default function CreatorProfilePage() {
  const { t } = useLanguage()
  const p = t.creatorProfile
  const [tab, setTab] = useState<'public' | 'social'>('public')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [form, setForm] = useState({
    displayName: '',
    avatarUrl: '',
    bio: '',
    locationCountry: '',
    languages: [] as string[],
    categories: [] as string[],
    preferredCollabTypes: [] as string[],
  })

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const inf = data?.influencerProfile
        if (inf) {
          setProfile(inf)
          setAccounts(inf.socialAccounts || [])
          setForm({
            displayName: inf.displayName || '',
            avatarUrl: inf.avatarUrl || '',
            bio: inf.bio || '',
            locationCountry: inf.locationCountry || '',
            languages: inf.languages || [],
            categories: [inf.primaryNiche, ...(inf.secondaryNiches || [])].filter(
              (v: any, i: number, arr: any[]) => v && arr.indexOf(v) === i
            ),
            preferredCollabTypes: inf.preferredCollabTypes || [],
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasVerifiedAccount = accounts.some((a) => a.isVerified)
  const handle = `@${(form.displayName || 'creator').replace(/\s+/g, '').toLowerCase()}`

  const completionChecks = [
    !!form.avatarUrl,
    !!form.displayName,
    !!form.bio,
    !!form.locationCountry,
    form.languages.length > 0,
    form.categories.length > 0,
    accounts.length > 0,
  ]
  const completionPct = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)

  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const uploadPhoto = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('files', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.urls?.[0]) setForm((f) => ({ ...f, avatarUrl: data.urls[0] }))
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerProfile: {
            displayName: form.displayName,
            avatarUrl: form.avatarUrl,
            bio: form.bio,
            locationCountry: form.locationCountry,
            languages: form.languages,
            primaryNiche: form.categories[0] || null,
            secondaryNiches: form.categories.slice(1),
            preferredCollabTypes: form.preferredCollabTypes,
          },
        }),
      })
      if (!res.ok) throw new Error(p.errorSave)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const removeAccount = async (accountId: string) => {
    if (!confirm(p.confirmRemove)) return
    const res = await fetch(`/api/social-accounts/${accountId}`, { method: 'DELETE' })
    if (res.ok) setAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }

  const compact = (n: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

  const collabLabel = (v: string) =>
    v === 'gifted' ? p.collabGifted : v === 'paid' ? p.collabPaid : p.collabPerformance

  const inputClass =
    'w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300'

  if (loading) {
    return (
      <CreatorWorkspaceLayout>
        <div className="max-w-6xl mx-auto pt-16 text-center text-gray-400">…</div>
      </CreatorWorkspaceLayout>
    )
  }

  return (
    <CreatorWorkspaceLayout>
      <div className="max-w-6xl mx-auto pt-6 pb-8">
        {/* Header + top bar */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{p.title}</h1>
            <p className="text-gray-500 mt-1">{p.subtitle}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white shadow-sm rounded-full px-4 py-2 flex items-center gap-2.5">
              <span className="text-xs text-gray-500">{p.completion}</span>
              <span className="text-sm font-bold text-gray-900 tabular-nums">{completionPct}%</span>
              <span className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                <span className="block h-full bg-primary-500 rounded-full" style={{ width: `${completionPct}%` }} />
              </span>
            </div>
            {hasVerifiedAccount && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {p.verifiedBadge}
              </span>
            )}
            {profile?.id && (
              <Link
                href={`/influencer/${profile.id}`}
                target="_blank"
                className="px-4 py-2 bg-white shadow-sm rounded-full text-sm font-semibold text-gray-700 hover:text-primary-700 transition"
              >
                👁 {p.previewProfile}
              </Link>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 bg-primary-600 text-white rounded-full text-sm font-semibold shadow-sm hover:bg-primary-700 transition disabled:opacity-50"
            >
              {saving ? p.saving : saved ? `✓ ${p.saved}` : p.saveChanges}
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

        {/* Tabs */}
        <div className="border-b border-gray-200/80 flex gap-8 mb-6">
          {([['public', p.tabPublic], ['social', p.tabSocial]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 -mb-px text-sm font-medium border-b-2 transition ${
                tab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'public' ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Form */}
            <div className="lg:col-span-3 bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
              <h2 className="font-bold text-gray-900">{p.tabPublic}</h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-5">{p.publicNote}</p>

              <div className="flex flex-col sm:flex-row gap-5 mb-5">
                {/* Photo */}
                <div className="flex-shrink-0">
                  <p className="text-sm font-medium text-gray-700 mb-2">{p.profilePhoto}</p>
                  <div className="relative w-24 h-24">
                    <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                      {form.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-gray-300">{(form.displayName || '?').charAt(0)}</span>
                      )}
                    </div>
                    <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
                    <button
                      onClick={() => photoRef.current?.click()}
                      disabled={uploading}
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-gray-500 hover:text-primary-600 transition disabled:opacity-50"
                      title={p.uploadPhoto}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{p.displayName}</label>
                    <input type="text" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{p.username}</label>
                    <input type="text" value={handle} disabled className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{p.bio}</label>
                    <textarea
                      rows={3}
                      maxLength={160}
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder={p.bioPlaceholder}
                      className={inputClass}
                    />
                    <p className="text-right text-[11px] text-gray-400">{form.bio.length}/160</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{p.countryRegion}</label>
                  <select value={form.locationCountry} onChange={(e) => setForm({ ...form, locationCountry: e.target.value })} className={inputClass}>
                    <option value="">—</option>
                    {COUNTRY_OPTIONS.map((cn) => <option key={cn} value={cn}>{cn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{p.languages}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setForm({ ...form, languages: toggleIn(form.languages, lang) })}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                          form.languages.includes(lang) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">{p.contentCategories}</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm({ ...form, categories: toggleIn(form.categories, cat) })}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        form.categories.includes(cat) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t.categoryNames[cat] || cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{p.preferredPlatforms}</label>
                  {accounts.length === 0 ? (
                    <p className="text-xs text-gray-400">{p.platformsHint}</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      {accounts.map((acc) => <PlatformIcon key={acc.id} name={acc.platform?.name || ''} />)}
                      <span className="text-[11px] text-gray-400 ml-1">{p.platformsHint}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{p.collabTypes}</label>
                  <div className="flex flex-wrap gap-4">
                    {COLLAB_TYPES.map((ct) => (
                      <label key={ct} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.preferredCollabTypes.includes(ct)}
                          onChange={() => setForm({ ...form, preferredCollabTypes: toggleIn(form.preferredCollabTypes, ct) })}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        {collabLabel(ct)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="lg:col-span-2 bg-white/85 backdrop-blur rounded-3xl shadow-sm p-6">
              <h2 className="font-bold text-gray-900">{p.previewTitle}</h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-5">{p.previewNote}</p>

              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {form.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-gray-300">{(form.displayName || '?').charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{form.displayName || '—'}</p>
                      <p className="text-xs text-gray-500">{handle}</p>
                    </div>
                  </div>
                  {hasVerifiedAccount && (
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-semibold whitespace-nowrap">
                      ✓ {p.verifiedBadge}
                    </span>
                  )}
                </div>

                {form.bio && <p className="text-sm text-gray-600 mt-3">{form.bio}</p>}

                <p className="text-xs text-gray-500 mt-3 flex items-center gap-2 flex-wrap">
                  {form.locationCountry && <span>📍 {form.locationCountry}</span>}
                  {form.languages.length > 0 && <span>🌐 {form.languages.join(', ')}</span>}
                </p>

                {form.categories.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{p.contentCategories}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {form.categories.map((cat) => (
                        <span key={cat} className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{t.categoryNames[cat] || cat}</span>
                      ))}
                    </div>
                  </div>
                )}

                {accounts.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{p.preferredPlatforms}</p>
                    <div className="flex gap-1.5">
                      {accounts.map((acc) => <PlatformIcon key={acc.id} name={acc.platform?.name || ''} />)}
                    </div>
                  </div>
                )}

                {form.preferredCollabTypes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{p.collabTypes}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {form.preferredCollabTypes.map((ct) => (
                        <span key={ct} className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{collabLabel(ct)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Social Accounts tab ── */
          <div>
            <div className="mb-5 bg-white/70 backdrop-blur rounded-2xl shadow-sm px-5 py-3.5 flex items-center gap-3 text-sm text-gray-600">
              <svg className="w-5 h-5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {p.socialNote}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {accounts.map((acc) => {
                const state = accountVerifState(acc)
                return (
                  <div key={acc.id} className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-5">
                    <div className="flex items-start gap-3">
                      <PlatformIcon name={acc.platform?.name || ''} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{acc.platform?.name}</p>
                        <p className="text-xs text-gray-500 truncate">@{acc.username}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {compact(acc.followerCount || 0)} {p.followers}
                        </p>
                      </div>
                      {state === 'VERIFIED' ? (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-semibold whitespace-nowrap">
                          ✓ {p.connectedVerified}
                        </span>
                      ) : (
                        <StatusBadge machine="verification" status={state} size="sm" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {state === 'VERIFIED' ? (
                        <Link href="/dashboard/influencer/accounts" className="flex-1 text-center px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:text-primary-700 transition">
                          ⚙ {p.manageBtn}
                        </Link>
                      ) : (
                        <>
                          <Link href="/dashboard/influencer/accounts" className="flex-1 text-center px-3 py-2 bg-primary-600 text-white rounded-xl text-xs font-semibold hover:bg-primary-700 transition whitespace-nowrap">
                            {p.verifyOwnership}
                          </Link>
                          <Link href="/dashboard/influencer/accounts" className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:text-primary-700 transition whitespace-nowrap">
                            {p.updateData}
                          </Link>
                          <button
                            onClick={() => removeAccount(acc.id)}
                            className="px-3 py-2 bg-white border border-red-100 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition whitespace-nowrap"
                          >
                            {p.removeAccount}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Connect new */}
              <Link
                href="/dashboard/influencer/accounts"
                className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary-600 hover:border-primary-200 transition min-h-[140px]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-semibold">{p.connectAccount}</span>
              </Link>
            </div>
            {accounts.length === 0 && <p className="mt-4 text-sm text-gray-400">{p.noAccounts}</p>}
          </div>
        )}
      </div>
    </CreatorWorkspaceLayout>
  )
}
