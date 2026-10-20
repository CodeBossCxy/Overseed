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

function Sparkles({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4" />
    </svg>
  )
}

export default function ImageGenerationPanel({ isProUser }: { isProUser: boolean }) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : ai.imageFailed)
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
          <div className="p-3 flex-shrink-0">
            <button
              type="button"
              onClick={startNewSession}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-xs font-semibold hover:from-primary-700 hover:to-primary-600 transition shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {zh ? '新建生成' : 'New Generation'}
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
        <fieldset disabled={disabled} className="min-w-0 space-y-4 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
          <section className="rounded-2xl border border-white/70 bg-white/35 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{studio.productImages}</h2>
                <p className="mt-1 text-xs text-gray-500">{studio.uploadSubtitle}</p>
              </div>
              <span className="text-xs text-gray-500 tabular-nums">{products.length}/{MAX_PRODUCT_IMAGES}</span>
            </div>
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
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">{studio.model}</p>
                <div className="mt-2 flex min-h-[42px] items-center gap-2 rounded-xl border border-white/70 bg-white/35 px-3 text-xs font-medium text-gray-700"><Sparkles className="h-4 w-4 flex-shrink-0 text-primary-500" />Overseed AI</div>
              </div>
              <label className="min-w-0 text-xs font-medium text-gray-500" htmlFor="image-size">{studio.ratio}
                <select id="image-size" value={size} onChange={event => setSize(event.target.value as ImageRequest['size'])} className={controlClass}>
                  <option value="1024x1024">1:1 {studio.square}</option><option value="1024x1536">3:4 {studio.portrait}</option><option value="1024x1280">4:5</option><option value="1536x1024">16:9 {studio.landscape}</option><option value="1280x720">16:9 HD</option>
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium text-gray-500" htmlFor="image-quality">{studio.quality}
                <select id="image-quality" value={quality} onChange={event => setQuality(event.target.value as ImageRequest['quality'])} className={controlClass}>
                  <option value="low">{studio.draft}</option><option value="medium">{studio.standard}</option><option value="high">{studio.high}</option>
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium text-gray-500" htmlFor="image-count">{studio.quantity}
                <select id="image-count" value={count} onChange={event => setCount(Number(event.target.value))} className={controlClass}>
                  {[1, 2, 4, 6].map(amount => <option key={amount} value={amount}>{amount} {studio.imagesUnit}</option>)}
                </select>
              </label>
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
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/55 bg-white/25 px-5 py-4">
          {/* Toggle sidebar button (desktop only) */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7' : 'M13 5l7 7-7 7M5 5l7 7-7 7'} />
            </svg>
          </button>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100/60 text-primary-600"><Sparkles /></span>
          <div><h2 className="text-sm font-semibold text-gray-900">{studio.results}</h2><p className="mt-0.5 text-xs text-gray-500">{studio.resultsSubtitle}</p></div>
          {images.length > 0 && <span className="ml-auto rounded-full border border-white/70 bg-white/50 px-2.5 py-1 text-xs text-gray-500">{images.length}</span>}
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
              {busy && <div role="status" className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/40 p-5 text-sm text-gray-500"><Sparkles className="h-5 w-5 animate-pulse text-primary-500" />{ai.generatingImage}</div>}
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
