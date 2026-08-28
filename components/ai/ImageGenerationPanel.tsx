'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  createdAt: Date
}

export default function ImageGenerationPanel({ isProUser }: { isProUser: boolean }) {
  const { t } = useLanguage()
  const ai = t.aiAssistant

  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<GeneratedImage[]>([])

  const generate = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || ai.imageFailed)
      setImages(prev => [
        { id: `img-${Date.now()}`, url: data.url, prompt: prompt.trim(), createdAt: new Date() },
        ...prev,
      ])
      setPrompt('')
    } catch (err: any) {
      setError(err.message || ai.imageFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 relative">
      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {images.length === 0 && !busy ? (
            <div className="flex justify-center items-center min-h-[50vh]">
              <div className="text-center max-w-md">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{ai.imageEmptyTitle}</h2>
                <p className="text-sm text-gray-500">{ai.imageEmptyDesc}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {busy && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <p className="text-sm text-gray-500">{ai.generatingImage}</p>
                </div>
              )}
              {images.map(img => (
                <div key={img.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.prompt} className="w-full max-h-[480px] object-contain bg-gray-50" />
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <p className="text-sm text-gray-600 leading-snug">{img.prompt}</p>
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full workspace-glass-control text-xs font-semibold text-gray-700"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {ai.downloadImage}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pro gate */}
      {!isProUser && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center px-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">{ai.proOnly}</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">{ai.proOnlyDesc}</p>
            <Link
              href="/dashboard/upgrade"
              className="inline-block px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition font-medium shadow-md"
            >
              {t.upgrade.upgradeToPro}
            </Link>
          </div>
        </div>
      )}

      {/* Prompt input */}
      <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <form
            onSubmit={(e) => { e.preventDefault(); generate() }}
            className="flex items-stretch gap-2"
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate() }
              }}
              placeholder={ai.imagePromptPlaceholder}
              disabled={!isProUser || busy}
              rows={1}
              className="flex-1 min-w-0 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white resize-none disabled:opacity-50 disabled:cursor-not-allowed text-sm transition"
              style={{ maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || busy || !isProUser}
              className="flex-shrink-0 px-5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {busy ? ai.generating : `✦ ${ai.generateImage}`}
            </button>
          </form>
          <p className="text-[10px] text-gray-400 text-center mt-2">{ai.imageDisclaimer}</p>
        </div>
      </div>
    </div>
  )
}
