'use client'

import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

export function PlatformIcon({ name }: { name: string }) {
  const key = name.toLowerCase()
  if (key.includes('instagram')) return <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 flex items-center justify-center text-[9px] text-white font-bold">IG</span>
  if (key.includes('tiktok')) return <span className="w-5 h-5 rounded-md bg-black flex items-center justify-center text-[9px] text-white font-bold">TT</span>
  if (key.includes('youtube')) return <span className="w-5 h-5 rounded-md bg-red-600 flex items-center justify-center text-[9px] text-white font-bold">▶</span>
  return <span className="w-5 h-5 rounded-md bg-gray-300 flex items-center justify-center text-[9px] text-white font-bold">{name.charAt(0).toUpperCase()}</span>
}

interface CampaignRowCardProps {
  campaign: any
  saved?: boolean
  onToggleSave?: (campaignId: string, next: boolean) => void
  onRemove?: (campaignId: string) => void
  busy?: boolean
}

export default function CampaignRowCard({ campaign: c, saved = false, onToggleSave, onRemove, busy = false }: CampaignRowCardProps) {
  const router = useRouter()
  const { t, locale } = useLanguage()
  const s = t.influencer.saved
  const image = c.images?.[0] || c.media?.[0]?.mediaUrl || c.brand?.logoUrl
  const paid = c.compensationType === 'PAID' || c.compensationType === 'PAID_PLUS_GIFT'
  const price = paid && (c.paymentMin != null || c.paymentMax != null)
    ? [c.paymentMin, c.paymentMax].filter((v: any) => v != null).map((v: any) => `$${Number(v).toLocaleString()}`).join(' - ')
    : s.productOnly
  const compensation = ({ PAID: s.paid, GIFTED: s.gifted, PAID_PLUS_GIFT: s.paidPlusGift, AFFILIATE: s.affiliate, NEGOTIABLE: s.negotiable } as Record<string,string>)[c.compensationType] || c.compensationType
  const platforms = (c.platforms || []).slice(0, 3)
  const category = c.categories?.[0]?.category?.name
  const destination = `/campaign/${c.id}`

  const activate = () => router.push(destination)
  const control = (event: React.MouseEvent, action: () => void) => {
    event.stopPropagation()
    action()
  }

  return <div
    role="link"
    tabIndex={0}
    aria-label={`${c.title} - ${c.brand?.companyName || t.campaign.anonymousBrand}`}
    onClick={activate}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate() } }}
    className="group workspace-glass-card workspace-glass-option rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8 min-h-[108px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
  >
    <div className="flex items-center gap-5 flex-1 min-w-0 lg:max-w-[440px]">
      <div className="relative w-28 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
        {image ? <img src={image} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-lg">{c.title?.charAt(0)}</div>}
        {(onToggleSave || onRemove) && <button
          type="button"
          disabled={busy}
          onClick={event => control(event, () => onRemove ? onRemove(c.id) : onToggleSave?.(c.id, !saved))}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center ${saved || onRemove ? 'text-primary-600' : 'text-gray-400'}`}
          aria-label={onRemove || saved ? s.remove : s.saveAction}
        >♥</button>}
      </div>
      <div className="min-w-0">
        <span className="text-base font-semibold text-gray-900 group-hover:text-primary-700 transition block truncate">{c.title}</span>
        <p className="text-xs text-gray-500 truncate">{[category ? (t.categoryNames[category] || category) : null, platforms.map((p:any) => p.platform.name).join(', ') || null].filter(Boolean).join(' · ')}</p>
        {c.description && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2 max-w-[300px]">{c.description}</p>}
      </div>
    </div>

    <div className="lg:w-40 flex-shrink-0">
      <p className="text-xs font-semibold text-gray-600 mb-2">{locale === 'zh' ? '品牌' : 'Brand'}</p>
      <p className="text-sm font-semibold text-gray-900 truncate">{c.brand?.companyName || t.campaign.anonymousBrand}{c.brand?.isVerified ? ' ✓' : ''}</p>
      <div className="flex gap-1 mt-2">{platforms.map((p:any) => <PlatformIcon key={p.platform.name} name={p.platform.name}/>)}</div>
    </div>

    <div className="lg:w-40 flex-shrink-0">
      <p className="text-xs font-semibold text-gray-600 mb-2">{locale === 'zh' ? '报酬' : 'Compensation'}</p>
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${paid ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>{compensation}</span>
      <p className="text-sm font-semibold text-gray-900 mt-1.5">{price}</p>
    </div>

    <div className="lg:w-44 flex-shrink-0">
      <p className="text-xs font-semibold text-gray-600 mb-2">{locale === 'zh' ? '截止日期' : 'Deadline'}</p>
      <p className="text-sm text-gray-900">{c.deadline ? `▣ ${formatDate(c.deadline, locale)}` : (locale === 'zh' ? '无截止日期' : 'No deadline')}</p>
      <p className="text-[11px] text-gray-500 mt-2">{Math.max(0, (c.totalSlots || 0) - (c.filledSlots || 0))} {s.spotsLeft}</p>
    </div>

    <div className="flex-shrink-0 lg:ml-auto flex items-center gap-4">
      {onRemove && <button type="button" disabled={busy} onClick={event => control(event, () => onRemove(c.id))} className="text-xs text-gray-400 hover:text-red-500 transition">{busy ? s.removing : s.remove}</button>}
      <span className="inline-flex items-center gap-3 text-sm font-semibold text-gray-700 group-hover:text-primary-700 transition">{locale === 'zh' ? '查看活动' : 'View Campaign'} <span className="transition-transform group-hover:translate-x-1">→</span></span>
    </div>
  </div>
}
