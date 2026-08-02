'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Brand-only actions on a creator profile: bookmark (Saved Creators) and
// report (complaint link), per spec.
export default function CreatorSaveBar({ influencerId }: { influencerId: string }) {
  const { t } = useLanguage()
  const s = t.brand.savedCreators

  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/saved-creators?idsOnly=1')
      .then((res) => (res.ok ? res.json() : { ids: [] }))
      .then((data) => setSaved((data.ids || []).includes(influencerId)))
      .catch(() => {})
  }, [influencerId])

  const toggle = async () => {
    setBusy(true)
    const next = !saved
    setSaved(next)
    try {
      const res = next
        ? await fetch('/api/saved-creators', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ influencerId }),
          })
        : await fetch(`/api/saved-creators?influencerId=${influencerId}`, { method: 'DELETE' })
      if (!res.ok) setSaved(!next)
    } catch {
      setSaved(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex justify-end gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm shadow-sm transition disabled:opacity-50 ${
          saved ? 'bg-white text-gray-900 font-bold ring-1 ring-gray-200 hover:bg-gray-50' : 'bg-white text-gray-700 font-semibold hover:text-gray-900'
        }`}
      >
        <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        {saved ? s.savedState : s.save}
      </button>
      <Link
        href="/contact"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-white text-gray-600 shadow-sm hover:text-red-600 transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
        </svg>
        {s.report}
      </Link>
    </div>
  )
}
