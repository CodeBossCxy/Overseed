'use client'

import { useState, useEffect, useMemo, useRef, useId } from 'react'

// ── Shared type ──────────────────────────────────────────────────────────────
export interface DiscoveredCreator {
  id: string
  platform: string
  handle: string | null
  display_name: string | null
  bio: string | null
  country: string | null
  language?: string | null
  follower_count: number | null
  engagement_rate: string | number | null
  niche_tags: string[]
  profile_url: string | null
  avatar_url: string | null
  score: number | null
}

// ── Shared constants ─────────────────────────────────────────────────────────
export const QUOTA_CODES = ['DISCOVERY_QUOTA_EXCEEDED', 'OUTREACH_QUOTA_EXCEEDED', 'INSUFFICIENT_CREDITS']

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'X / Twitter',
  twitch: 'Twitch',
  onlyfans: 'OnlyFans',
}

const FEATURE_COSTS: Record<string, number> = {
  audience_gender: 4,
  audience_age: 4,
  audience_country: 4,
  audience_bundle: 10,
  brand_collaborations: 6,
}

const FEATURE_LABELS: Record<string, [string, string]> = {
  audience_gender: ['受众性别', 'Audience Gender'],
  audience_age: ['受众年龄', 'Audience Age'],
  audience_country: ['受众地区', 'Audience Country'],
  audience_bundle: ['全部受众洞察（性别+年龄+地区）', 'All Audience Insights (Gender + Age + Country)'],
  brand_collaborations: ['品牌合作', 'Brand Collaborations'],
}

const AUDIENCE_BUNDLE_FEATURES = ['audience_gender', 'audience_age', 'audience_country'] as const
const AUDIENCE_BUNDLE_COST = 10

// ── Utilities ────────────────────────────────────────────────────────────────
export function proxyAvatarUrl(url: string | null): string | null {
  if (!url) return null
  if (url.includes('firebasestorage.googleapis.com') || url.includes('googleusercontent.com')) return url
  try {
    const hostname = new URL(url).hostname
    const PROXY_HOSTS = ['tiktokcdn.com', 'instagram.com', 'cdninstagram.com', 'fbcdn.net', 'ggpht.com', 'ytimg.com']
    if (PROXY_HOSTS.some((h) => hostname.endsWith(h))) {
      return `/api/avatar?url=${encodeURIComponent(url)}`
    }
  } catch { /* invalid URL — use directly */ }
  return url
}

export function formatFollowers(count: number | null, locale: string): string {
  if (count == null) return '—'
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(count)
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CreatorAvatarLocal({ url, name, textSize = '' }: { url: string | null; name: string; textSize?: string }) {
  const [failed, setFailed] = useState(false)
  const proxied = useMemo(() => proxyAvatarUrl(url), [url])
  useEffect(() => setFailed(false), [url])
  if (!proxied || failed) {
    return (
      <div className={`w-full h-full flex items-center justify-center text-gray-400 font-bold ${textSize}`}>
        {(name || '?').charAt(0)}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxied}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  )
}

// Muted autoplay is required by browsers. Falls back to thumbnail on unsupported platforms.
function AutoplayEmbed({
  platform, contentId, coverImageUrl, contentUrl,
}: {
  platform: string; contentId: string | null; coverImageUrl: string | null; contentUrl: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !contentId) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [contentId])

  const embedUrl = useMemo(() => {
    if (!contentId) return null
    switch (platform) {
      case 'youtube':
        return `https://www.youtube.com/embed/${contentId}?autoplay=1&mute=1&loop=1&playlist=${contentId}&controls=0&modestbranding=1&rel=0&showinfo=0`
      case 'tiktok':
        // TikTok embeds frequently show "Video currently unavailable" — use thumbnail + link instead
        return null
      case 'instagram':
        return null
      default:
        return null
    }
  }, [platform, contentId])

  const linkUrl = contentUrl || (platform === 'tiktok' && contentId ? `https://www.tiktok.com/video/${contentId}` : null)

  const thumbnail = (
    <>
      {coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyAvatarUrl(coverImageUrl) || coverImageUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div className="absolute bottom-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </>
  )

  return (
    <div ref={containerRef} className="relative w-full h-full rounded-xl overflow-hidden bg-gray-100">
      {inView && embedUrl ? (
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
          loading="lazy"
        />
      ) : linkUrl ? (
        <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
          {thumbnail}
        </a>
      ) : (
        thumbnail
      )}
    </div>
  )
}

function RelatedCreatorChip({
  handle,
  platform,
  clickToViewLabel,
  onOpen,
}: {
  handle: string
  platform: string
  clickToViewLabel: string
  onOpen: (creator: DiscoveredCreator) => void
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-primary-50 hover:text-primary-700 transition cursor-pointer"
        onMouseEnter={(e) => {
          const rect = (e.target as HTMLElement).getBoundingClientRect()
          setTooltip({ x: rect.left + rect.width / 2, y: rect.top })
        }}
        onMouseLeave={() => setTooltip(null)}
        onClick={(e) => {
          e.stopPropagation()
          setTooltip(null)
          onOpen({
            id: `cdb:${platform}:${handle}`,
            platform,
            handle,
            display_name: handle,
            bio: null,
            country: null,
            follower_count: null,
            engagement_rate: null,
            niche_tags: [],
            profile_url: null,
            avatar_url: null,
            score: null,
          })
        }}
      >
        @{handle}
      </button>
      {tooltip && (
        <span
          className="fixed z-[100] px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-medium shadow-lg whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          {clickToViewLabel}
        </span>
      )}
    </span>
  )
}

// ── useCreatorDetail hook ─────────────────────────────────────────────────────
export interface UseCreatorDetailResult {
  detailFor: DiscoveredCreator | null
  detail: any | null
  detailLoading: boolean
  detailError: string | null
  detailBlocked: boolean
  analytics: any | null
  analyticsLoading: boolean
  analyticsError: string | null
  analyticsBlocked: boolean
  featureUnlocks: Record<string, any>
  featureUnlocked: Set<string>
  featureLoading: string | null
  featureError: string | null
  featureConfirm: string | null
  openDetail: (creator: DiscoveredCreator, onAvatarUpdate?: (creatorId: string, avatarUrl: string) => void) => Promise<void>
  closeDetail: () => void
  setDetailFor: React.Dispatch<React.SetStateAction<DiscoveredCreator | null>>
  unlockFeature: (feature: string) => Promise<void>
  unlockAudienceBundle: () => Promise<void>
  promptUnlock: (feature: string) => void
  dismissConfirm: () => void
  profileCacheRef: React.MutableRefObject<Record<string, any>>
}

export function useCreatorDetail(): UseCreatorDetailResult {
  const [detailFor, setDetailFor] = useState<DiscoveredCreator | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailBlocked, setDetailBlocked] = useState(false)

  const [analytics, setAnalytics] = useState<any | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsBlocked, setAnalyticsBlocked] = useState(false)

  const [featureUnlocks, setFeatureUnlocks] = useState<Record<string, any>>({})
  const [featureUnlocked, setFeatureUnlocked] = useState<Set<string>>(new Set())
  const [featureLoading, setFeatureLoading] = useState<string | null>(null)
  const [featureError, setFeatureError] = useState<string | null>(null)
  const [featureConfirm, setFeatureConfirm] = useState<string | null>(null)

  const profileCacheRef = useRef<Record<string, any>>({})

  const loadExistingUnlocks = async (platform: string, handle: string) => {
    try {
      const qs = new URLSearchParams({ platform, handle })
      const res = await fetch(`/api/discovery/creator-unlock?${qs}`)
      if (res.ok) {
        const data = await res.json()
        setFeatureUnlocked(new Set(data.unlocked || []))
        setFeatureUnlocks(data.data || {})
      }
    } catch { /* best effort */ }
  }

  const unlockFeature = async (feature: string) => {
    if (!detailFor?.handle || featureLoading) return
    setFeatureConfirm(null)
    setFeatureError(null)
    setFeatureLoading(feature)
    try {
      const res = await fetch('/api/discovery/creator-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: detailFor.platform,
          handle: detailFor.handle,
          feature,
        }),
      })
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (data?.code === 'NO_DATA') {
          setFeatureUnlocked((prev) => new Set([...prev, feature]))
          setFeatureUnlocks((prev) => ({ ...prev, [feature]: { _empty: true } }))
        } else {
          throw new Error(data?.message || 'Unlock failed')
        }
        return
      }
      setFeatureUnlocked((prev) => new Set([...prev, feature]))
      setFeatureUnlocks((prev) => ({ ...prev, [feature]: data.data }))
    } catch (err: any) {
      setFeatureError(err.message || 'Unlock failed')
      setTimeout(() => setFeatureError(null), 5000)
    } finally {
      setFeatureLoading(null)
    }
  }

  const unlockAudienceBundle = async () => {
    if (!detailFor?.handle || featureLoading) return
    setFeatureConfirm(null)
    setFeatureError(null)
    setFeatureLoading('audience_bundle')
    try {
      const toUnlock = AUDIENCE_BUNDLE_FEATURES.filter((f) => !featureUnlocked.has(f))
      const perFeature = Math.floor(AUDIENCE_BUNDLE_COST / toUnlock.length)
      const remainder = AUDIENCE_BUNDLE_COST - perFeature * toUnlock.length

      for (let i = 0; i < toUnlock.length; i++) {
        const feature = toUnlock[i]
        const cost = perFeature + (i === toUnlock.length - 1 ? remainder : 0)
        const res = await fetch('/api/discovery/creator-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: detailFor.platform,
            handle: detailFor.handle,
            feature,
            costOverride: cost,
          }),
        })
        window.dispatchEvent(new Event('credits:refresh'))
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          if (data?.code !== 'NO_DATA') throw new Error(data?.message || 'Unlock failed')
          continue
        }
        setFeatureUnlocked((prev) => new Set([...prev, feature]))
        setFeatureUnlocks((prev) => ({ ...prev, [feature]: data.data }))
      }
    } catch (err: any) {
      setFeatureError(err.message || 'Bundle unlock failed')
    } finally {
      setFeatureLoading(null)
    }
  }

  const promptUnlock = (feature: string) => {
    if (featureLoading) return
    setFeatureError(null)
    setFeatureConfirm(feature)
  }

  const dismissConfirm = () => setFeatureConfirm(null)

  const openDetail = async (
    creator: DiscoveredCreator,
    onAvatarUpdate?: (creatorId: string, avatarUrl: string) => void,
  ) => {
    if (!creator.handle) return
    openedAtRef.current = Date.now()
    setDetailFor(creator)
    setDetailError(null)
    setDetailBlocked(false)
    setAnalytics(null)
    setAnalyticsError(null)
    setAnalyticsBlocked(false)
    setFeatureUnlocks({})
    setFeatureUnlocked(new Set())
    setFeatureLoading(null)
    setFeatureError(null)
    setFeatureConfirm(null)
    loadExistingUnlocks(creator.platform, creator.handle)

    const cacheKey = `${creator.platform}:${creator.handle.replace(/^@/, '').toLowerCase()}`
    const cached = profileCacheRef.current[cacheKey]
    if (cached) {
      setDetail(cached)
      return
    }

    setDetail(null)
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams({
        platform: creator.platform,
        handle: creator.handle,
      })
      const res = await fetch(`/api/discovery/club-enrich?${qs}`)
      window.dispatchEvent(new Event('credits:refresh'))
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setDetailBlocked(QUOTA_CODES.includes(data?.code))
        throw new Error(data?.message || 'Failed to load creator details')
      }
      profileCacheRef.current[cacheKey] = data
      setDetail(data)
      if (data?.avatar_url && data.avatar_url !== creator.avatar_url) {
        setDetailFor((prev) => prev ? { ...prev, avatar_url: data.avatar_url } : prev)
        onAvatarUpdate?.(creator.id, data.avatar_url)
      }
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load creator details')
    } finally {
      setDetailLoading(false)
    }
  }

  const openedAtRef = useRef(0)

  const closeDetail = () => {
    // Guard: ignore close attempts within 500ms of opening (prevents
    // stray click events from immediately dismissing the modal).
    if (Date.now() - openedAtRef.current < 500) return
    setDetailFor(null)
    setDetail(null)
    setDetailError(null)
  }

  return {
    detailFor,
    detail,
    detailLoading,
    detailError,
    detailBlocked,
    analytics,
    analyticsLoading,
    analyticsError,
    analyticsBlocked,
    featureUnlocks,
    featureUnlocked,
    featureLoading,
    featureError,
    featureConfirm,
    openDetail,
    closeDetail,
    setDetailFor,
    unlockFeature,
    unlockAudienceBundle,
    promptUnlock,
    dismissConfirm,
    profileCacheRef,
  }
}

// ── CreatorDetailModal component ─────────────────────────────────────────────
export interface CreatorDetailModalProps {
  creator: DiscoveredCreator | null
  detail: any | null
  detailLoading: boolean
  detailError: string | null
  detailBlocked: boolean
  featureUnlocks: Record<string, any>
  featureUnlocked: Set<string>
  featureLoading: string | null
  featureError: string | null
  featureConfirm: string | null
  onClose: () => void
  onUnlockFeature: (feature: string) => Promise<void>
  onUnlockAudienceBundle: () => Promise<void>
  onPromptUnlock: (feature: string) => void
  onDismissConfirm: () => void
  onDismissFeatureError: () => void
  onOpenRelated?: (creator: DiscoveredCreator) => void
  savedKeys: Set<string>
  onToggleSave: (creator: DiscoveredCreator) => void
  onOpenContact: (creator?: DiscoveredCreator) => void
  nicheMap: Record<string, string[]>
  zh: boolean
  locale: string
  t: any
}

export default function CreatorDetailModal({
  creator: detailFor,
  detail,
  detailLoading,
  detailError,
  detailBlocked,
  featureUnlocks,
  featureUnlocked,
  featureLoading,
  featureError,
  featureConfirm,
  onClose: closeDetail,
  onUnlockFeature: unlockFeature,
  onUnlockAudienceBundle: unlockAudienceBundle,
  onPromptUnlock: promptUnlock,
  onDismissConfirm,
  onDismissFeatureError,
  onOpenRelated,
  savedKeys,
  onToggleSave: toggleSaveCreator,
  onOpenContact: openContact,
  nicheMap,
  zh,
  locale,
  t,
}: CreatorDetailModalProps) {
  const igGradId = useId()

  // Lock body scroll while the modal is open — use overflow:hidden instead
  // of position:fixed to avoid shifting the coordinate system for the
  // fixed-positioned overlay.
  useEffect(() => {
    const html = document.documentElement
    const scrollbarWidth = window.innerWidth - html.clientWidth
    html.style.overflow = 'hidden'
    // Compensate for scrollbar disappearing to prevent layout shift
    html.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      html.style.overflow = ''
      html.style.paddingRight = ''
    }
  }, [])

  const PlatformLogo = ({ platform, size = 20 }: { platform: string; size?: number }) => {
    switch (platform) {
      case 'instagram':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Instagram">
            <defs>
              <radialGradient id={igGradId} cx="30%" cy="107%" r="150%">
                <stop offset="0%" stopColor="#fdf497" />
                <stop offset="5%" stopColor="#fdf497" />
                <stop offset="45%" stopColor="#fd5949" />
                <stop offset="60%" stopColor="#d6249f" />
                <stop offset="90%" stopColor="#285AEB" />
              </radialGradient>
            </defs>
            <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${igGradId})`} />
            <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
            <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
          </svg>
        )
      case 'youtube':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="YouTube">
            <rect x="1" y="4" width="22" height="16" rx="4" fill="#FF0000" />
            <polygon points="10,8.5 16,12 10,15.5" fill="white" />
          </svg>
        )
      case 'tiktok':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="TikTok">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="black" />
            <path d="M16.5 7.5c-.8-.5-1.3-1.4-1.3-2.5h-2.2v10.2a2.3 2.3 0 1 1-1.6-2.2V10.7a4.5 4.5 0 1 0 3.8 4.5V10a5.3 5.3 0 0 0 3.1 1V8.8a3.3 3.3 0 0 1-1.8-.3z" fill="white" />
            <path d="M16.2 7.2c-.7-.5-1.2-1.3-1.2-2.2h-2v10a2.2 2.2 0 1 1-1.5-2.1v-2.2a4.3 4.3 0 1 0 3.7 4.4V9.7a5.1 5.1 0 0 0 3 1V8.5a3.2 3.2 0 0 1-2-1.3z" fill="#25F4EE" opacity="0.7" />
          </svg>
        )
      case 'twitter':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="X / Twitter">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="black" />
            <path d="M7 7l4.5 5.5L7 17h1.2l3.8-3.8L15 17h3l-4.8-5.8L17 7h-1.2l-3.5 3.5L9.5 7H7z" fill="white" />
          </svg>
        )
      case 'twitch':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Twitch">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="#9146FF" />
            <path d="M7 6l-1 3v8h3v2h2l2-2h3l4-4V6H7zm11 6.5l-2 2h-3l-1.5 1.5V14.5H8.5V7.5h9.5v5z" fill="white" />
            <rect x="14" y="9" width="1.5" height="3.5" rx="0.5" fill="white" />
            <rect x="11" y="9" width="1.5" height="3.5" rx="0.5" fill="white" />
          </svg>
        )
      case 'onlyfans':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="OnlyFans">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="#00AFF0" />
            <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="1.8" fill="none" />
            <circle cx="12" cy="12" r="1.5" fill="white" />
          </svg>
        )
      default:
        return <span className="text-sm font-medium text-gray-600">{platform}</span>
    }
  }

  const PlansCta = () => (
    <a href="/pricing/brand" className="font-semibold underline whitespace-nowrap">
      {t.aiAssistant.buyCreditsCta}
    </a>
  )

  const d = t.brand.discover

  if (!detailFor) return null

  return (
    <>
      {/* TEMP: influencers.club creator detail popup */}
      <div
        data-solid
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={closeDetail}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Top header: banner + avatar overlapping boundary + name/bio/actions ── */}
          <div className="relative flex-shrink-0">
            <div className="h-16 bg-gradient-to-r from-primary-600 via-rose-500 to-orange-400" />
            <button
              onClick={closeDetail}
              className="absolute top-3 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-600 text-lg leading-none transition z-10 shadow"
              aria-label="Close"
            >
              ×
            </button>
            <div className="px-6 pb-4 flex items-start gap-5">
              {/* Avatar: half above banner boundary, half below */}
              <div className="-mt-14 w-[112px] h-[112px] rounded-full ring-4 ring-white bg-gray-200 overflow-hidden shadow-md flex-shrink-0">
                <CreatorAvatarLocal
                  key={detailFor.id}
                  url={detailFor.avatar_url || detail?.avatar_url || null}
                  name={detailFor.display_name || detailFor.handle || '?'}
                  textSize="text-3xl"
                />
              </div>
              <div className="flex-1 min-w-0 pt-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900 truncate">
                    {detailFor.handle?.replace(/^@+/, '') || detailFor.display_name}
                  </h3>
                  <span className="px-2.5 py-0.5 bg-gray-900 text-white rounded-full text-[11px] font-medium flex-shrink-0 inline-flex items-center gap-1">
                    <PlatformLogo platform={detailFor.platform} size={14} />
                    {PLATFORM_LABELS[detailFor.platform] || detailFor.platform}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  @{detailFor.handle?.replace(/^@+/, '')}
                </p>
                {/* Category badges */}
                {detail?.category && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">{detail.category}</span>
                    {/* Niche tags from discovery */}
                    {(() => {
                      const key = detailFor.handle ? `${detailFor.platform}:${detailFor.handle.replace(/^@/, '').toLowerCase()}` : null
                      const niches = key ? nicheMap[key] : null
                      if (!niches) return null
                      return niches.slice(0, 4).map((n, i) => {
                        const label = n.replace(/^[Ii]d_/, '').replace(/_[Aa]ll$/i, '').replace(/_/g, ' ').trim()
                        if (!label) return null
                        return <span key={`${label}-${i}`} className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium capitalize">{label}</span>
                      })
                    })()}
                  </div>
                )}
              </div>
              {/* Top-right actions */}
              <div className="flex items-center gap-2 pt-3 flex-shrink-0">
                {(() => {
                  const h = (detailFor.handle || '').replace(/^@/, '').toLowerCase()
                  const k = `${detailFor.platform}:${h}`
                  const saved = h ? savedKeys.has(k) : false
                  return (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSaveCreator(detailFor) }}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl border transition ${saved ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-gray-200 text-gray-400 hover:text-amber-600'}`}
                    >
                      <svg className="w-5 h-5" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                      </svg>
                    </button>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto">
            {detailLoading && (
              <p className="py-10 text-center text-sm text-gray-500">
                {t.creatorDetail.loading}
              </p>
            )}
            {detailError && (
              <div className="mx-6 my-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {detailError}
                {detailBlocked && <> <PlansCta /></>}
              </div>
            )}
            {detail && (<>
            <div className="flex min-h-0">
              {/* ── Left column: Key Metrics + About ── */}
              <div className="w-[380px] flex-shrink-0 border-r border-gray-100 p-5 overflow-y-auto">
                {/* ── Key stats grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: t.creatorDetail.followers, value: formatFollowers(detail.total_followers ?? detailFor.follower_count, locale) },
                    { label: t.creatorDetail.engagement, value: detail.engagement_percent != null ? `${Number(detail.engagement_percent).toFixed(2)}%` : '—' },
                    { label: t.creatorDetail.totalPosts, value: detail.total_contents != null ? Number(detail.total_contents).toLocaleString() : '—' },
                    { label: t.creatorDetail.postsPer30d, value: detail.posting_frequency_recent_months != null ? String(detail.posting_frequency_recent_months) : '—' },
                  ].map((s) => (
                    <div key={s.label} className="border border-gray-100 bg-gray-50/60 rounded-xl px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{s.label}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* ── Follower Growth 7/30/90d ── */}
                {detail.follower_growth && typeof detail.follower_growth === 'object' && (
                  <div className="mt-3 border border-gray-100 bg-gray-50/60 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1.5">{t.creatorDetail.followerGrowth}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(detail.follower_growth).map(([k, v]) => (
                        typeof v === 'number' && (
                          <span key={k} className="text-sm text-gray-700">
                            <span className="text-gray-400">{k}:</span>{' '}
                            <span className={`font-semibold ${v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                              {v > 0 ? '+' : ''}{v}%
                            </span>
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Performance metrics ── */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: t.creatorDetail.avgViews, value: detail.avg_views },
                    { label: t.creatorDetail.medianViews, value: detail.median_views },
                    { label: t.creatorDetail.avgLikes, value: detail.avg_likes },
                    { label: t.creatorDetail.medianLikes, value: detail.median_likes },
                  ].filter((s) => s.value != null).map((s) => (
                    <div key={s.label} className="border border-gray-100 bg-gray-50/60 rounded-xl px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{s.label}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{formatFollowers(Math.round(Number(s.value)), locale)}</p>
                    </div>
                  ))}
                </div>

                {/* ── 30d/90d views ── */}
                {(detail.views_30d || detail.views_90d) && (
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {[
                      { label: t.creatorDetail.views30d, data: detail.views_30d },
                      { label: t.creatorDetail.views90d, data: detail.views_90d },
                    ].filter((s) => s.data).map((s) => (
                      <div key={s.label} className="border border-gray-100 bg-gray-50/60 rounded-xl px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{s.label}</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">
                          {s.data?.views?.all != null ? formatFollowers(s.data.views.all, locale) : s.data?.totalViews != null ? formatFollowers(s.data.totalViews, locale) : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── About section ── */}
                <div className="mt-5 border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-sm font-bold text-gray-900">{t.creatorDetail.about}</p>
                  </div>

                  {detail.bio && (
                    <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed line-clamp-6 mb-3">{detail.bio.split('\n').filter((l: string) => !/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(l) && !/(?:\+?\d[\d\s\-().]{7,}\d)/.test(l)).join('\n')}</p>
                  )}

                  {/* Category, location, language badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {detail.category && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                        {detail.category}
                      </span>
                    )}
                    {detail.location && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        {detail.location}
                      </span>
                    )}
                    {detail.language && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-[11px] font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                        {detail.language}
                      </span>
                    )}
                  </div>

                  {/* Last post + status row */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {detail.last_publish_time && (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                        {t.creatorDetail.lastPost}: {new Date(Number(detail.last_publish_time)).toLocaleDateString()}
                      </span>
                    )}
                    {detail.has_email && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {t.creatorDetail.reachableFromOverseed}
                      </span>
                    )}
                  </div>
                </div>

              </div>{/* end left column */}

              {/* ── Right column: Recent Content + Audience ── */}
              <div className="flex-1 p-5 overflow-y-auto">
                {/* ── Recent posts (3 reels/shorts/videos) ── */}
                {detail.recent_posts?.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                      {detail.recent_posts[0]?.label ? detail.recent_posts[0].label.replace('Latest ', t.creatorDetail.recentContentPrefix) + 's' : t.creatorDetail.recentContent}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {detail.recent_posts.map((post: any, i: number) => (
                        <div key={post.contentId || i} className="group">
                          <div className="aspect-[9/16] rounded-lg overflow-hidden">
                            <AutoplayEmbed
                              platform={detail.platform || detailFor.platform}
                              contentId={post.contentId}
                              coverImageUrl={post.coverImageUrl}
                              contentUrl={post.contentUrl}
                            />
                          </div>
                          <a
                            href={post.contentUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <p className="mt-1 text-[11px] text-gray-600 line-clamp-2 leading-tight">{post.description || ''}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                              {post.views != null && <span>{Number(post.views).toLocaleString()} views</span>}
                              {post.likes != null && <span>♡ {Number(post.likes).toLocaleString()}</span>}
                            </div>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Related Creators ── */}
                {detail.related_creators?.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">{t.creatorDetail.relatedCreators}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.related_creators.map((rc: any, i: number) => {
                        const rcHandle = typeof rc === 'string' ? rc : (rc.uniqueId || rc.channelId || rc.handle || '')
                        if (!rcHandle) return null
                        return (
                          <RelatedCreatorChip
                            key={`${rcHandle}-${i}`}
                            handle={rcHandle}
                            platform={detailFor!.platform}
                            clickToViewLabel={t.creatorDetail.clickToView}
                            onOpen={(creator) => onOpenRelated?.(creator)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>{/* end right column */}
            </div>

            {/* ── Feature error (inline) ── */}
            {featureError && (
              <div className="mx-5 mb-2 bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 flex items-center justify-between">
                <span>{featureError}</span>
                <button onClick={onDismissFeatureError} className="ml-2 text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
              </div>
            )}

            {/* ── Audience Insights — full-width section below both columns ── */}
            <div className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border border-indigo-100/80 px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4.5 h-4.5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-900">{t.creatorDetail.audienceInsights}</h4>
                  <p className="text-[11px] text-gray-400">
                    {t.creatorDetail.audienceInsightsDesc}
                  </p>
                </div>
                {/* Unlock All bundle button — hidden when all 3 are already unlocked */}
                {!AUDIENCE_BUNDLE_FEATURES.every((f) => featureUnlocked.has(f)) && (
                  <button
                    type="button"
                    onClick={() => promptUnlock('audience_bundle')}
                    disabled={featureLoading != null}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    {t.creatorDetail.unlockAll.replace('{n}', String(AUDIENCE_BUNDLE_COST))}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* ── Gender ── */}
                {featureUnlocked.has('audience_gender') && featureUnlocks.audience_gender ? (
                  <div className="bg-white/80 border border-white rounded-xl p-3 shadow-sm">
                    <p className="text-xs font-semibold text-gray-700 mb-2">{t.creatorDetail.gender}</p>
                    {featureUnlocks.audience_gender._empty ? (
                      <p className="text-[11px] text-gray-400 italic">{t.creatorDetail.noData}</p>
                    ) : (() => {
                      const g = featureUnlocks.audience_gender
                      const male = Math.round((g.maleRatio ?? 0) * 100)
                      const female = Math.round((g.femaleRatio ?? 0) * 100)
                      const femaleAngle = (female / 100) * 360
                      const largeArc = femaleAngle > 180 ? 1 : 0
                      const rad = (deg: number) => (deg - 90) * (Math.PI / 180)
                      const fx = 50 + 40 * Math.cos(rad(femaleAngle))
                      const fy = 50 + 40 * Math.sin(rad(femaleAngle))
                      return (
                        <div className="flex flex-col items-center">
                          <svg viewBox="0 0 100 100" className="w-20 h-20">
                            {/* Male full circle as background */}
                            <circle cx="50" cy="50" r="40" fill="#3b82f6" />
                            {/* Female arc overlay */}
                            {female > 0 && female < 100 && (
                              <path
                                d={`M50,10 A40,40 0 ${largeArc},1 ${fx},${fy} L50,50 Z`}
                                fill="#f472b6"
                              />
                            )}
                            {female >= 100 && <circle cx="50" cy="50" r="40" fill="#f472b6" />}
                            {/* Center white circle for donut effect */}
                            <circle cx="50" cy="50" r="24" fill="white" />
                          </svg>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              {t.creatorDetail.male} {male}%
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-pink-400" />
                              {t.creatorDetail.female} {female}%
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="relative bg-white/80 border border-white rounded-xl p-3 shadow-sm overflow-hidden flex flex-col">
                    <p className="text-xs font-semibold text-gray-700 mb-2">{t.creatorDetail.gender}</p>
                    {/* Blurred preview donut */}
                    <div className="flex-1 flex items-center justify-center opacity-40 blur-[2px] select-none pointer-events-none">
                      <svg viewBox="0 0 80 80" className="w-16 h-16">
                        <circle cx="40" cy="40" r="30" fill="none" stroke="#c7d2fe" strokeWidth="12" strokeDasharray="120 69" />
                        <circle cx="40" cy="40" r="30" fill="none" stroke="#e9d5ff" strokeWidth="12" strokeDasharray="69 120" strokeDashoffset="-120" />
                      </svg>
                    </div>
                    {/* Lock overlay */}
                    <div className="absolute inset-0 bottom-10 flex flex-col items-center justify-center bg-white/60">
                      <svg className="w-5 h-5 text-gray-400 mb-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <button
                      onClick={() => promptUnlock('audience_gender')}
                      disabled={featureLoading != null}
                      className="relative z-10 w-full mt-auto px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {t.creatorDetail.unlockFor.replace('{n}', String(FEATURE_COSTS.audience_gender))}
                    </button>
                  </div>
                )}

                {/* ── Age ── */}
                {featureUnlocked.has('audience_age') && featureUnlocks.audience_age ? (
                  <div className="bg-white/80 border border-white rounded-xl p-3 shadow-sm">
                    <p className="text-xs font-semibold text-gray-700 mb-2">{t.creatorDetail.age}</p>
                    {featureUnlocks.audience_age._empty ? (
                      <p className="text-[11px] text-gray-400 italic">{t.creatorDetail.noData}</p>
                    ) : (
                    <div className="space-y-1">
                      {(featureUnlocks.audience_age.ages || []).map((a: any, i: number) => {
                        const pct = Math.round((a.share ?? 0) * 100)
                        return (
                          <div key={a.ageRange || i} className="flex items-center gap-1.5 text-[10px]">
                            <span className="w-10 text-gray-500 tabular-nums">{a.ageRange}</span>
                            <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="w-7 text-right tabular-nums text-gray-500">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                    )}
                  </div>
                ) : (
                  <div className="relative bg-white/80 border border-white rounded-xl p-3 shadow-sm overflow-hidden flex flex-col">
                    <p className="text-xs font-semibold text-gray-700 mb-2">{t.creatorDetail.age}</p>
                    {/* Blurred preview bars */}
                    <div className="flex-1 space-y-1.5 opacity-40 blur-[2px] select-none pointer-events-none">
                      {[65, 45, 80, 30, 20].map((w, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-10 h-2 bg-gray-200 rounded" />
                          <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                            <div className="h-full bg-indigo-200 rounded" style={{ width: `${w}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 bottom-10 flex flex-col items-center justify-center bg-white/60">
                      <svg className="w-5 h-5 text-gray-400 mb-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <button
                      onClick={() => promptUnlock('audience_age')}
                      disabled={featureLoading != null}
                      className="relative z-10 w-full mt-auto px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {t.creatorDetail.unlockFor.replace('{n}', String(FEATURE_COSTS.audience_age))}
                    </button>
                  </div>
                )}

                {/* ── Top Countries ── */}
                {featureUnlocked.has('audience_country') && featureUnlocks.audience_country ? (
                  <div className="bg-white/80 border border-white rounded-xl p-3 shadow-sm">
                    <p className="text-xs font-semibold text-gray-700 mb-2">{t.creatorDetail.country}</p>
                    {featureUnlocks.audience_country._empty ? (
                      <p className="text-[11px] text-gray-400 italic">{t.creatorDetail.noData}</p>
                    ) : (
                    <div className="space-y-1">
                      {(featureUnlocks.audience_country.countries || []).map((c: any, i: number) => {
                        const pct = Math.round((c.share ?? 0) * 100)
                        return (
                          <div key={c.country || i} className="flex items-center gap-1.5 text-[10px]">
                            <span className="w-8 text-gray-600 font-medium">{c.country}</span>
                            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary-500 to-rose-400" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="w-7 text-right tabular-nums text-gray-500">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                    )}
                  </div>
                ) : (
                  <div className="relative bg-white/80 border border-white rounded-xl p-3 shadow-sm overflow-hidden flex flex-col">
                    <p className="text-xs font-semibold text-gray-700 mb-2">{t.creatorDetail.country}</p>
                    {/* Blurred preview with flag-like blocks */}
                    <div className="flex-1 space-y-1.5 opacity-40 blur-[2px] select-none pointer-events-none">
                      {[70, 50, 35, 20].map((w, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-5 h-3 bg-gray-200 rounded-sm" />
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-200 rounded-full" style={{ width: `${w}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 bottom-10 flex flex-col items-center justify-center bg-white/60">
                      <svg className="w-5 h-5 text-gray-400 mb-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <button
                      onClick={() => promptUnlock('audience_country')}
                      disabled={featureLoading != null}
                      className="relative z-10 w-full mt-auto px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {t.creatorDetail.unlockFor.replace('{n}', String(FEATURE_COSTS.audience_country))}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Brand Collaborations — full-width, below Audience Insights ── */}
            <div className="border-t border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <h4 className="text-sm font-bold text-gray-900">{t.creatorDetail.brandCollaborations}</h4>
                <span className="text-xs text-gray-400 ml-1">
                  {t.creatorDetail.brandCollaborationsDesc}
                </span>
                {detail.has_brand_deals && (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ml-auto">
                    {t.creatorDetail.hasSponsoredContent}
                  </span>
                )}
              </div>

              {!detail.has_brand_deals ? (
                <p className="mt-3 text-sm text-gray-400 italic">{t.creatorDetail.noSponsoredContent}</p>
              ) : detailFor.platform === 'tiktok' ? (
                <p className="mt-3 text-sm text-gray-400 italic">{t.creatorDetail.tiktokNoBrandDetails}</p>
              ) : featureUnlocked.has('brand_collaborations') && featureUnlocks.brand_collaborations ? (
                featureUnlocks.brand_collaborations._empty || !(featureUnlocks.brand_collaborations.sponsors?.length) ? (
                  <p className="mt-3 text-sm text-gray-400 italic">{t.creatorDetail.noBrandCollabData}</p>
                ) : (
                <div className="space-y-4 mt-3">
                  {(featureUnlocks.brand_collaborations.sponsors || []).map((sponsor: any, si: number) => (
                    <div key={sponsor.name || si} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* Sponsor header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50/60">
                        {sponsor.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.logo} alt="" className="w-8 h-8 rounded-full object-cover bg-white" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900">{sponsor.name}</p>
                          {sponsor.socialId && <p className="text-[10px] text-gray-400">ID: {sponsor.socialId}</p>}
                        </div>
                        {sponsor.url && (
                          <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline flex-shrink-0">
                            {t.creatorDetail.view} ↗
                          </a>
                        )}
                      </div>

                      {/* Sponsored content posts */}
                      {sponsor.posts?.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100">
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-2">{t.creatorDetail.sponsoredContent}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {sponsor.posts.slice(0, 3).map((post: any, pi: number) => (
                              <a
                                key={post.contentId || pi}
                                href={post.contentUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group"
                              >
                                {post.coverImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={proxyAvatarUrl(post.coverImageUrl) || post.coverImageUrl} alt="" className="w-full aspect-square rounded-lg object-cover bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                ) : (
                                  <div className="w-full aspect-square rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-xs">No image</div>
                                )}
                                <p className="mt-1 text-[10px] text-gray-500 line-clamp-1">{post.description || ''}</p>
                                <div className="flex gap-2 text-[9px] text-gray-400 mt-0.5">
                                  {post.likes != null && <span>♡ {Number(post.likes).toLocaleString()}</span>}
                                  {post.views != null && <span>▶ {Number(post.views).toLocaleString()}</span>}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Brand performance summary */}
                      {sponsor.performance && (sponsor.performance.avgLikes != null || sponsor.performance.avgViews != null) && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/40">
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-2">{t.creatorDetail.performanceSummary}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: t.creatorDetail.brandAvgLikes, value: sponsor.performance.avgLikes },
                              { label: t.creatorDetail.brandAvgComments, value: sponsor.performance.avgComments },
                              { label: t.creatorDetail.brandAvgViews, value: sponsor.performance.avgViews },
                              { label: t.creatorDetail.brandAvgEngRate, value: sponsor.performance.avgEngagementRate, pct: true },
                              { label: t.creatorDetail.brandMedianLikes, value: sponsor.performance.medianLikes },
                              { label: t.creatorDetail.brandMedianViews, value: sponsor.performance.medianViews },
                            ].filter((s) => s.value != null).map((s) => (
                              <div key={s.label} className="text-center">
                                <p className="text-[9px] text-gray-400 uppercase">{s.label}</p>
                                <p className="text-xs font-bold text-gray-800">
                                  {s.pct ? `${(Number(s.value) * 100).toFixed(2)}%` : formatFollowers(Math.round(Number(s.value)), locale)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )
              ) : (
                <div className="relative border border-gray-100 rounded-xl p-4 mt-2 overflow-hidden">
                  {/* Blurred preview */}
                  <div className="opacity-40 blur-[2px] select-none pointer-events-none space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 w-24 bg-gray-200 rounded" />
                          <div className="h-2 w-40 bg-gray-100 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Lock overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60">
                    <svg className="w-6 h-6 text-gray-400 mb-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <button
                      onClick={() => promptUnlock('brand_collaborations')}
                      disabled={featureLoading != null}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {t.creatorDetail.unlockBrandCollabs.replace('{n}', String(FEATURE_COSTS.brand_collaborations))}
                    </button>
                  </div>
                </div>
              )}
            </div>
            </>)}
          </div>{/* end overflow wrapper */}

          {/* Footer actions */}
          {detail && (
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 text-center">
              <button
                onClick={() => openContact()}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-full text-sm font-semibold hover:bg-black transition"
              >
                {t.creatorDetail.contactViaOverseed} ↗
              </button>
              <p className="text-xs text-gray-400 mt-2 italic">
                {t.creatorDetail.contactViaOverseedDesc}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Feature unlock confirmation popup ── */}
      {featureConfirm && FEATURE_LABELS[featureConfirm] && (
        <div
          data-solid
          className="fixed inset-0 bg-black/50 z-[55] flex items-center justify-center p-4"
          onClick={() => !featureLoading && onDismissConfirm()}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {t.creatorDetail.unlock} {FEATURE_LABELS[featureConfirm][zh ? 0 : 1]}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {t.creatorDetail.confirmUnlockDesc.replace('{n}', String(FEATURE_COSTS[featureConfirm]))}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onDismissConfirm}
                disabled={featureLoading != null}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
              >
                {t.creatorDetail.cancel}
              </button>
              <button
                onClick={() => featureConfirm === 'audience_bundle' ? unlockAudienceBundle() : unlockFeature(featureConfirm)}
                disabled={featureLoading != null}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {featureLoading
                  ? t.creatorDetail.unlocking
                  : t.creatorDetail.confirmUnlock.replace('{n}', String(FEATURE_COSTS[featureConfirm]))}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
