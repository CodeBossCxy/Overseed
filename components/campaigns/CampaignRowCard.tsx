'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'
import CategoryName from '@/components/campaigns/CategoryName'

// Horizontal campaign card per the July 2026 workspace mockup: thumbnail
// with heart, category/urgent chips, verified title, brand, description,
// platform icons + requirement stats, and a right rail with compensation,
// due date and actions. Shared by Browse Campaigns and Saved Campaigns.

const URGENT_WINDOW_DAYS = 14

export function PlatformIcon({ name }: { name: string }) {
  const key = name.toLowerCase()
  if (key.includes('instagram')) {
    return (
      <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </span>
    )
  }
  if (key.includes('tiktok')) {
    return (
      <span className="w-5 h-5 rounded-md bg-black flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.9 2.9 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-.88-.05A6.33 6.33 0 005.76 20.3a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.8-.3z" />
        </svg>
      </span>
    )
  }
  if (key.includes('youtube')) {
    return (
      <span className="w-5 h-5 rounded-md bg-red-600 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9.5 8.5v7l6-3.5-6-3.5z" />
        </svg>
      </span>
    )
  }
  return (
    <span className="w-5 h-5 rounded-md bg-gray-300 flex items-center justify-center text-[9px] font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

interface CampaignRowCardProps {
  campaign: any
  // Heart overlay: filled when saved. Omit both handlers to hide the heart.
  saved?: boolean
  onToggleSave?: (campaignId: string, next: boolean) => void
  // Renders a Remove button in the right rail (saved-campaigns page).
  onRemove?: (campaignId: string) => void
  busy?: boolean
}

export default function CampaignRowCard({
  campaign: c,
  saved = false,
  onToggleSave,
  onRemove,
  busy = false,
}: CampaignRowCardProps) {
  const { t, locale } = useLanguage()
  const s = t.influencer.saved

  const spotsLeft = Math.max(0, (c.totalSlots || 0) - (c.filledSlots || 0))
  const deadlineDays = c.deadline
    ? (new Date(c.deadline).getTime() - Date.now()) / 86400000
    : null
  const urgent = deadlineDays != null && deadlineDays >= 0 && deadlineDays <= URGENT_WINDOW_DAYS
  const paidLike = c.compensationType === 'PAID' || c.compensationType === 'PAID_PLUS_GIFT'

  const compLabel =
    ({
      PAID: s.paid,
      GIFTED: s.gifted,
      PAID_PLUS_GIFT: s.paidPlusGift,
      AFFILIATE: s.affiliate,
      NEGOTIABLE: s.negotiable,
    } as Record<string, string>)[c.compensationType] || c.compensationType

  const price = (() => {
    if (paidLike && (c.paymentMin != null || c.paymentMax != null)) {
      const min = c.paymentMin != null ? `$${Number(c.paymentMin)}` : ''
      const max = c.paymentMax != null ? `$${Number(c.paymentMax)}` : ''
      return min && max ? `${min} - ${max}` : min || max
    }
    return null
  })()

  const minF = (() => {
    const mins = (c.followerRequirements || [])
      .map((r: any) => r.minFollowers)
      .filter((v: number) => v > 0)
    return mins.length ? Math.min(...mins) : null
  })()

  const formatCompact = (n: number) =>
    new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(n)

  const image = c.images?.[0] || c.media?.[0]?.mediaUrl || c.brand?.logoUrl
  const platforms = (c.platforms || []).slice(0, 3)
  const extraPlatforms = (c.platforms || []).length - platforms.length
  const showHeart = !!(onToggleSave || onRemove)

  const heartClick = () => {
    if (busy) return
    if (onRemove) onRemove(c.id)
    else if (onToggleSave) onToggleSave(c.id, !saved)
  }

  return (
    <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col md:flex-row gap-5">
      {/* Thumbnail */}
      <div className="relative w-full md:w-40 h-40 md:h-32 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {showHeart && (
          <button
            onClick={heartClick}
            disabled={busy}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 shadow flex items-center justify-center transition ${
              saved || onRemove ? 'text-primary-600 hover:text-red-500' : 'text-gray-400 hover:text-primary-600'
            }`}
            title={onRemove || saved ? s.remove : s.saveAction}
          >
            {saved || onRemove ? (
              <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {c.categories?.[0] && (
            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
              <CategoryName name={c.categories[0].category?.name} />
            </span>
          )}
          {c.isFeatured && (
            <span className="px-2.5 py-0.5 bg-yellow-50 text-yellow-600 rounded-full text-xs font-medium">
              {t.campaignCard.featured}
            </span>
          )}
          {urgent && (
            <span className="px-2.5 py-0.5 bg-red-50 text-red-500 rounded-full text-xs font-medium">
              {s.urgent}
            </span>
          )}
        </div>
        <Link href={`/campaign/${c.id}`} className="group inline-flex items-center gap-1.5 max-w-full">
          <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-700 transition truncate">
            {c.title}
          </h3>
          {c.brand?.isVerified && (
            <svg className="w-[18px] h-[18px] text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l2.4 2.4 3.3-.5.5 3.3L20.6 9.6 22 12l-1.4 2.4.6 3.3-3.3.5L15.4 21.6 12 20.2 8.6 21.6 6.1 18.2l-3.3-.5.6-3.3L2 12l1.4-2.4-.5-3.3 3.3.5L8.6 2.4 12 2zm-1.2 12.7l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" />
            </svg>
          )}
        </Link>
        <p className="text-sm font-medium text-gray-600">{c.brand?.companyName || t.campaign.anonymousBrand}</p>
        {c.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            {platforms.map((p: any) => (
              <PlatformIcon key={p.platform.name} name={p.platform.name} />
            ))}
            {extraPlatforms > 0 && <span className="text-gray-500 font-medium">+{extraPlatforms}</span>}
          </span>
          {minF != null && (
            <>
              <span className="hidden sm:block w-px h-4 bg-gray-200" />
              <span className="font-medium">
                {s.minFollowersShort} {formatCompact(minF)} {s.followersWord}
              </span>
            </>
          )}
          <span className="hidden sm:block w-px h-4 bg-gray-200" />
          <span className="font-medium">
            {spotsLeft} {s.spotsLeft}
          </span>
        </div>
      </div>

      {/* Right rail */}
      <div className="flex flex-row md:flex-col items-start md:items-stretch justify-between gap-4 md:w-56 md:border-l md:border-gray-100 md:pl-5">
        <div>
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
              paidLike ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
            }`}
          >
            {compLabel}
          </span>
          <p className="text-xl font-bold text-gray-900 mt-1.5">{price || s.productOnly}</p>
          <p className="text-xs text-gray-500 mt-0.5">{paidLike ? s.flatFee : s.productOnly}</p>
          {c.deadline && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-500 mt-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {s.due} {formatDate(c.deadline, locale)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-40 md:w-auto">
          <Link
            href={`/campaign/${c.id}`}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-primary-700 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition"
          >
            {s.viewCampaign}
            <span aria-hidden>→</span>
          </Link>
          {onRemove && (
            <button
              onClick={() => onRemove(c.id)}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition disabled:opacity-50"
            >
              {busy ? s.removing : s.remove}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
