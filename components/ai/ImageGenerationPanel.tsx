'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { MAX_PRODUCT_IMAGES, MAX_PRODUCT_IMAGE_BYTES, PRODUCT_IMAGE_TYPES, type ImageRequest } from '@/lib/ai-image-options'

interface GeneratedImage {
  id: string
  url: string
  prompt: string
}

interface SessionSummary {
  id: string
  title: string
  prompt: string
  imageType: string
  imageCount: number
  thumbnail: string | null
  createdAt: string
}

interface ProductImage {
  id: string
  file: File
  preview: string
}

// Persist generation state across navigation so the user sees a "still generating"
// indicator when returning to the page mid-generation.
const GENERATING_KEY = 'overseed:image-generating'

function markGenerating(sessionCount: number) {
  try {
    sessionStorage.setItem(GENERATING_KEY, JSON.stringify({ at: Date.now(), sessionCount }))
  } catch {}
}

function clearGenerating() {
  try { sessionStorage.removeItem(GENERATING_KEY) } catch {}
}

function getGeneratingState(): { at: number; sessionCount: number } | null {
  try {
    const raw = sessionStorage.getItem(GENERATING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Expire after 10 minutes
    if (Date.now() - parsed.at > 10 * 60 * 1000) {
      sessionStorage.removeItem(GENERATING_KEY)
      return null
    }
    return parsed
  } catch { return null }
}

function Sparkles({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4" />
    </svg>
  )
}

export default function ImageGenerationPanel({ isProUser, activeTab, onTabChange }: { isProUser: boolean; activeTab?: 'chat' | 'image'; onTabChange?: (tab: 'chat' | 'image') => void }) {
  const { t, locale } = useLanguage()
  const zh = locale === 'zh'
  const ai = t.aiAssistant
  const studio = ai.imageStudio
  const [prompt, setPrompt] = useState('')
  const [imageType, setImageType] = useState<ImageRequest['imageType']>('main')
  const [language, setLanguage] = useState<ImageRequest['language']>('none')
  const [size, setSize] = useState<ImageRequest['size']>('1024x1024')
  const [quality, setQuality] = useState<ImageRequest['quality']>('medium')
  const [count, setCount] = useState(1)
  const [products, setProducts] = useState<ProductImage[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insufficientCredits, setInsufficientCredits] = useState(false)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrls = useRef(new Set<string>())
  const disabled = !isProUser || busy
  const controlClass = 'mt-2 w-full min-w-0 rounded-xl border border-white/70 bg-white/50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50'

  // Session history
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-image/history')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {}
    setSessionsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isProUser || sessionsLoaded) return
    loadSessions()
  }, [isProUser, sessionsLoaded, loadSessions])

  // Detect in-progress generation after remount (user navigated away and back)
  useEffect(() => {
    if (!isProUser || !sessionsLoaded || busy) return
    const gen = getGeneratingState()
    if (!gen) return

    // If sessions grew since we started generating, the generation completed
    if (sessions.length > gen.sessionCount) {
      clearGenerating()
      return
    }

    // Otherwise, show busy state and poll until new session appears
    setBusy(true)
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/ai-image/history')
        if (!res.ok) return
        const data = await res.json()
        const newSessions: SessionSummary[] = data.sessions || []
        if (newSessions.length > gen.sessionCount) {
          // Generation completed — load the newest session
          setSessions(newSessions)
          clearGenerating()
          setBusy(false)
          const newest = newSessions[0]
          if (newest) {
            setActiveSessionId(newest.id)
            // Load its images
            const sRes = await fetch(`/api/ai-image/history?sessionId=${newest.id}`)
            if (sRes.ok) {
              const sData = await sRes.json()
              if (sData.session?.images) {
                setImages(sData.session.images.map((i: any) => ({ id: i.id, url: i.url, prompt: i.prompt })))
              }
            }
          }
          clearInterval(interval)
          window.dispatchEvent(new Event('credits:refresh'))
        }
      } catch {}
    }, 5000) // Poll every 5 seconds

    // Also check if the generating flag expired
    const timeout = setTimeout(() => {
      clearInterval(interval)
      clearGenerating()
      setBusy(false)
    }, 10 * 60 * 1000) // 10 minute max

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProUser, sessionsLoaded])

  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/ai-image/history?sessionId=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        const s = data.session
        if (s) {
          setActiveSessionId(s.id)
          setPrompt(s.prompt || '')
          setImageType(s.imageType || 'main')
          setLanguage(s.language || 'none')
          setSize(s.size || '1024x1024')
          setQuality(s.quality || 'medium')
          setImages(s.images?.map((i: any) => ({ id: i.id, url: i.url, prompt: i.prompt })) || [])
        }
      }
    } catch {}
  }

  const startNewSession = () => {
    setActiveSessionId(null)
    setImages([])
    setPrompt('')
    setProducts([])
    setError(null)
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (activeSessionId === sessionId) startNewSession()
    fetch('/api/ai-image/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {})
  }

  useEffect(() => {
    const urls = previewUrls.current
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [])

  const addProducts = (files: File[]) => {
    if (disabled) return
    setError(null)
    if (files.some(file => !PRODUCT_IMAGE_TYPES.includes(file.type) || file.size > MAX_PRODUCT_IMAGE_BYTES)) {
      setError(studio.uploadError)
      return
    }
    if (products.length + files.length > MAX_PRODUCT_IMAGES) {
      setError(studio.uploadLimit)
      return
    }
    const additions = files.map(file => {
      const preview = URL.createObjectURL(file)
      previewUrls.current.add(preview)
      return { id: crypto.randomUUID(), file, preview }
    })
    setProducts(previous => [...previous, ...additions])
  }

  const removeProduct = (product: ProductImage) => {
    URL.revokeObjectURL(product.preview)
    previewUrls.current.delete(product.preview)
    setProducts(previous => previous.filter(item => item.id !== product.id))
  }

  const deleteImage = async (imageId: string) => {
    setImages(prev => prev.filter(i => i.id !== imageId))
    fetch('/api/ai-image/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: imageId }),
    }).catch(() => {})
  }

  const generate = async () => {
    if (prompt.trim().length < 3 || disabled) return
    setBusy(true)
    setError(null)
    setInsufficientCredits(false)
    markGenerating(sessions.length)
    const submittedPrompt = prompt.trim()
    try {
      const form = new FormData()
      Object.entries({ prompt: submittedPrompt, imageType, language, size, quality, count }).forEach(([key, value]) => form.set(key, String(value)))
      products.forEach(product => form.append('images', product.file))
      const res = await fetch('/api/ai-image', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS') {
          setInsufficientCredits(true)
          throw new Error(ai.insufficientCredits)
        }
        throw new Error(data.message || ai.imageFailed)
      }
      const urls: string[] = data.urls || (data.url ? [data.url] : [])
      if (!urls.length) throw new Error(ai.imageFailed)
      const newImages = urls.map(url => ({ id: crypto.randomUUID(), url, prompt: submittedPrompt }))
      setImages(previous => [...newImages, ...previous])
      if (data.saveError) {
        console.warn('Image history save failed:', data.saveError)
        setError(zh ? '图片已生成，但历史记录保存失败' : 'Images generated, but history could not be saved')
      }
      if (data.sessionId) {
        setActiveSessionId(data.sessionId)
        loadSessions() // Refresh session list
      }
      clearGenerating()
    } catch (err) {
      setError(err instanceof Error ? err.message : ai.imageFailed)
      clearGenerating()
    } finally {
      setBusy(false)
      window.dispatchEvent(new Event('credits:refresh'))
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return zh ? '今天' : 'Today'
    if (diffDays === 1) return zh ? '昨天' : 'Yesterday'
    if (diffDays < 7) return zh ? `${diffDays}天前` : `${diffDays}d ago`
    return d.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <form onSubmit={event => { event.preventDefault(); generate() }} className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      {/* Session history sidebar */}
      {isProUser && sidebarOpen && (
        <div className="hidden md:flex w-[220px] flex-shrink-0 flex-col border-r border-white/60 bg-white/15 min-h-0">
          <div className="h-14 px-3 flex-shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={startNewSession}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-xs font-semibold hover:from-primary-700 hover:to-primary-600 transition shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {zh ? '新建生成' : 'New Generation'}
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/70 transition text-gray-400 flex-shrink-0"
              aria-label={zh ? '收起侧栏' : 'Collapse sidebar'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
            {sessions.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">{zh ? '暂无生成记录' : 'No generations yet'}</p>
            ) : (
              <div className="space-y-0.5">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition ${
                      activeSessionId === s.id
                        ? 'selected-option-glass text-gray-900'
                        : 'hover:bg-white/40 text-gray-700'
                    }`}
                  >
                    {s.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-primary-100/50 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate leading-tight">{s.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.imageCount} {zh ? '张' : 'img'} · {formatDate(s.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSession(s.id, e)}
                      className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 transition text-gray-300 hover:text-red-500 flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings panel */}
      <aside aria-label={studio.settings} className="flex w-full flex-shrink-0 flex-col border-b border-white/60 bg-white/20 md:min-h-0 md:w-[300px] md:border-b-0 md:border-r lg:w-[320px]">
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/55 bg-white/25 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">{studio.productImages}</h2>
            <p className="text-xs text-gray-500">{studio.uploadSubtitle}</p>
          </div>
          <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">{products.length}/{MAX_PRODUCT_IMAGES}</span>
        </div>
        <fieldset disabled={disabled} className="min-w-0 space-y-4 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
          <section className="rounded-2xl border border-white/70 bg-white/35 p-4">
            <input ref={fileInputRef} id="product-images" type="file" aria-label={studio.productImages} accept={PRODUCT_IMAGE_TYPES.join(',')} multiple className="sr-only" onChange={event => { addProducts(Array.from(event.target.files || [])); event.target.value = '' }} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => { event.preventDefault(); setDragging(false); addProducts(Array.from(event.dataTransfer.files)) }}
              disabled={products.length >= MAX_PRODUCT_IMAGES}
              className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-5 text-center transition disabled:cursor-not-allowed disabled:opacity-50 ${dragging ? 'border-primary-400 bg-primary-50/60' : 'border-primary-200/70 bg-white/20 hover:bg-white/50'}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100/70 text-primary-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
              </span>
              <span className="text-xs font-medium text-gray-700">{studio.uploadAction}</span>
              <span className="text-[11px] leading-relaxed text-gray-400">{studio.uploadHint}</span>
            </button>
            {products.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {products.map(product => (
                  <div key={product.id} className="relative aspect-square rounded-xl border border-white/70 bg-white/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.preview} alt={product.file.name} className="h-full w-full rounded-xl object-contain p-1" />
                    <button type="button" onClick={() => removeProduct(product)} aria-label={`${studio.removeImage}: ${product.file.name}`} className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white text-gray-500 shadow-sm hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-5 rounded-2xl border border-white/70 bg-white/35 p-4">
            <div role="group" aria-label={studio.imageType} className="grid grid-cols-2 gap-1.5">
              {(['main', 'detail'] as const).map(type => (
                <button key={type} type="button" aria-pressed={imageType === type} onClick={() => setImageType(type)} className={`whitespace-nowrap rounded-xl px-1.5 py-2 text-[11px] font-semibold transition ${imageType === type ? 'bg-primary-600 text-white shadow-sm' : 'border border-white/70 bg-white/40 text-gray-600 hover:bg-white/80'}`}>{studio.types[type]}</button>
              ))}
            </div>
            <div>
              <label htmlFor="image-requirements" className="text-xs font-semibold text-gray-700">{studio.requirements}</label>
              <div className="mt-2 overflow-hidden rounded-xl border border-white/70 bg-white/45 focus-within:ring-2 focus-within:ring-primary-400">
                <textarea id="image-requirements" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={studio.requirementsPlaceholder} minLength={3} maxLength={1500} required rows={3} className="block w-full resize-y bg-transparent px-3 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none" />
                <div className="flex items-center justify-between gap-2 px-3 pb-2">
                  <span className="text-[10px] text-gray-400">{prompt.length}/1500</span>
                  <button type="button" onClick={() => setPrompt(studio.examplePrompt)} className="rounded-lg border border-white/70 bg-white/60 px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-white">{studio.useExample}</button>
                </div>
              </div>
            </div>
            <label className="block text-xs font-semibold text-gray-700" htmlFor="image-language">
              {studio.language}
              <select id="image-language" value={language} onChange={event => setLanguage(event.target.value as ImageRequest['language'])} className={controlClass}>
                <option value="none">{studio.noText}</option>
                <option value="en">English</option><option value="zh">中文</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="ja">日本語</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-1.5">{studio.model}</p>
                <div className="flex h-[42px] items-center gap-2 rounded-xl border border-white/70 bg-white/35 px-3 text-xs font-medium text-gray-700"><Sparkles className="h-4 w-4 flex-shrink-0 text-primary-500" />Overseed AI</div>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-gray-500 mb-1.5 block" htmlFor="image-size">{studio.ratio}</label>
                <select id="image-size" value={size} onChange={event => setSize(event.target.value as ImageRequest['size'])} className={`${controlClass} !mt-0 h-[42px]`}>
                  <option value="1024x1024">{zh ? '1:1 正方形' : '1:1 Square'}</option>
                  <option value="683x1024">{zh ? '2:3 竖版' : '2:3 Portrait'}</option>
                  <option value="1024x683">{zh ? '3:2 横版' : '3:2 Landscape'}</option>
                  <option value="768x1024">{zh ? '3:4 竖版' : '3:4 Portrait'}</option>
                  <option value="1024x768">{zh ? '4:3 横版' : '4:3 Landscape'}</option>
                  <option value="820x1024">{zh ? '4:5 竖版' : '4:5 Portrait'}</option>
                  <option value="1024x820">{zh ? '5:4 横版' : '5:4 Landscape'}</option>
                  <option value="576x1024">{zh ? '9:16 手机竖屏' : '9:16 Mobile'}</option>
                  <option value="1024x576">{zh ? '16:9 宽屏' : '16:9 Widescreen'}</option>
                  <option value="1024x439">{zh ? '21:9 超宽屏' : '21:9 Ultra-wide'}</option>
                  <option value="1024x256">{zh ? '4:1 超宽横版' : '4:1 Banner'}</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-gray-500 mb-1.5 block" htmlFor="image-quality">{studio.quality}</label>
                <select id="image-quality" value={quality} onChange={event => setQuality(event.target.value as ImageRequest['quality'])} className={`${controlClass} !mt-0 h-[42px]`}>
                  <option value="low">{studio.draft}</option><option value="medium">{studio.standard}</option><option value="high">{studio.high}</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-gray-500 mb-1.5 block" htmlFor="image-count">{studio.quantity}</label>
                <select id="image-count" value={count} onChange={event => setCount(Number(event.target.value))} className={`${controlClass} !mt-0 h-[42px]`}>
                  {[1, 2, 4, 6].map(amount => <option key={amount} value={amount}>{amount} {studio.imagesUnit}</option>)}
                </select>
              </div>
            </div>
          </section>
        </fieldset>
        <div className="flex-shrink-0 border-t border-white/60 bg-white/30 p-4">
          {error && <p role="alert" className="mb-3 text-xs text-red-600">{error} {insufficientCredits && <Link href="/pricing/brand" className="font-semibold underline">{ai.buyCreditsCta}</Link>}</p>}
          <button type="submit" disabled={prompt.trim().length < 3 || disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Sparkles className={`h-4 w-4 ${busy ? 'animate-pulse' : ''}`} />{busy ? ai.generating : studio.generate}
          </button>
          {!isProUser && <Link href="/dashboard/upgrade" className="mt-2 block text-center text-xs font-medium text-primary-600">{t.upgrade.upgradeToPro}</Link>}
        </div>
      </aside>

      {/* Results panel */}
      <section aria-label={studio.results} aria-busy={busy} className="flex min-h-[360px] min-w-0 flex-1 flex-shrink-0 flex-col bg-white/10 md:min-h-0">
        <div className="h-14 flex flex-shrink-0 items-center gap-3 border-b border-white/55 bg-white/25 px-5">
          {/* Toggle sidebar button (desktop only) */}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100/60 text-primary-600"><Sparkles className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0"><h2 className="text-sm font-semibold text-gray-900">{studio.results}</h2><p className="mt-0.5 text-xs text-gray-500">{studio.resultsSubtitle}</p></div>
          {images.length > 0 && <span className="rounded-full border border-white/70 bg-white/50 px-2.5 py-1 text-xs text-gray-500">{images.length}</span>}
          {onTabChange && (
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/40 border border-white/60 ml-2">
              <button
                type="button"
                onClick={() => onTabChange('chat')}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm transition ${
                  activeTab === 'chat'
                    ? 'bg-white shadow-sm text-gray-900 font-bold'
                    : 'text-gray-500 font-medium hover:text-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {zh ? '聊天' : 'Chat'}
              </button>
              <button
                type="button"
                onClick={() => onTabChange('image')}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm transition ${
                  activeTab === 'image'
                    ? 'bg-white shadow-sm text-gray-900 font-bold'
                    : 'text-gray-500 font-medium hover:text-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
                </svg>
                {zh ? '图片生成' : 'Image Generation'}
              </button>
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5" aria-live="polite">
          {images.length === 0 && !busy ? (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/70 bg-primary-100/40 text-primary-400"><Sparkles className="h-9 w-9" /></div>
              <h3 className="text-base font-semibold text-gray-800">{ai.imageEmptyTitle}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-500">{studio.emptyHint}</p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-4">
              {busy && (
                <div role="status" className="rounded-2xl border border-primary-200/50 bg-gradient-to-r from-primary-50/60 to-white p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Sparkles className="h-6 w-6 text-primary-500 animate-pulse" />
                      <span className="absolute inset-0 rounded-full animate-ping bg-primary-400/20" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{zh ? '正在生成图片...' : 'Generating images...'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{zh ? '这可能需要几分钟，您可以浏览其他页面' : 'This may take a few minutes. You can browse other pages.'}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-200/70 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full animate-[indeterminate_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
                  </div>
                </div>
              )}
              {images.map(image => (
                <article key={image.id} className="overflow-hidden rounded-2xl border border-white/70 bg-white/50 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.prompt} className="max-h-[480px] w-full object-contain" />
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <p className="min-w-0 flex-1 break-words text-xs leading-relaxed text-gray-600">{image.prompt}</p>
                    <div className="flex items-center gap-2">
                      <a href={image.url} target="_blank" rel="noreferrer" download className="workspace-glass-control rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">{ai.downloadImage} ↓</a>
                      <button type="button" onClick={() => deleteImage(image.id)} className="workspace-glass-control rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-700">×</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <p className="flex-shrink-0 px-5 pb-4 text-center text-[10px] text-gray-400">{ai.imageDisclaimer}</p>
      </section>
    </form>
  )
}
