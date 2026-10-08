'use client'

import { useState } from 'react'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'
import {
  COUNTRY_FILTER_OPTIONS,
  LANGUAGE_FILTER_OPTIONS,
} from '@/components/discovery/DiscoverPanel'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
]

const NICHE_OPTIONS = [
  'Food & Beverage', 'Beauty & Skincare', 'Fashion', 'Lifestyle',
  'Tech & Gaming', 'Health & Fitness', 'Travel', 'Parenting & Family',
  'Home & Decor', 'Finance', 'Pets', 'Entertainment', 'Education',
]

const FOLLOWER_TIERS = [
  { label: 'Nano', labelZh: '纳米', min: 1000, max: 10000 },
  { label: 'Micro', labelZh: '微型', min: 10000, max: 50000 },
  { label: 'Mid', labelZh: '中型', min: 50000, max: 500000 },
  { label: 'Macro', labelZh: '大型', min: 500000, max: 1000000 },
  { label: 'Mega', labelZh: '超级', min: 1000000, max: 0 },
] as const

const CONTENT_FORMATS = [
  { value: 'reels_shorts', en: 'Reels / Shorts', zh: '短视频 / Reels' },
  { value: 'stories', en: 'Stories', zh: '限时动态' },
  { value: 'static_post', en: 'Static Posts', zh: '图文帖子' },
  { value: 'long_video', en: 'Long-form Video', zh: '长视频' },
  { value: 'live', en: 'Live', zh: '直播' },
]

const BRAND_SAFETY_OPTIONS = [
  { value: 'no_profanity', en: 'No profanity', zh: '无脏话' },
  { value: 'no_alcohol', en: 'No alcohol / tobacco', zh: '无烟酒' },
  { value: 'no_politics', en: 'No politics', zh: '无政治内容' },
  { value: 'family_friendly', en: 'Family-friendly', zh: '家庭友好' },
]

const COMP_TYPES = [
  { value: 'paid', en: 'Paid', zh: '付费' },
  { value: 'gifted', en: 'Gifted Product', zh: '赠品置换' },
  { value: 'paid_gift', en: 'Paid + Gift', zh: '付费+赠品' },
  { value: 'affiliate', en: 'Affiliate / Commission', zh: '佣金分成' },
  { value: 'negotiable', en: 'Negotiable', zh: '可协商' },
]

const DELIVERABLE_TYPES = [
  { value: 'instagram_post', en: 'Instagram Post', zh: 'Instagram 帖子' },
  { value: 'reel', en: 'Reel', zh: 'Reel 短视频' },
  { value: 'story_set', en: 'Story Set', zh: '故事合集' },
  { value: 'tiktok_video', en: 'TikTok Video', zh: 'TikTok 视频' },
  { value: 'youtube_video', en: 'YouTube Video', zh: 'YouTube 视频' },
  { value: 'youtube_short', en: 'YouTube Short', zh: 'YouTube Short' },
  { value: 'blog_post', en: 'Blog Post', zh: '博客文章' },
]

const USAGE_RIGHTS_OPTIONS = [
  { value: 'creator_retains', en: 'Creator retains all rights', zh: '创作者保留所有权利' },
  { value: 'repost_credit', en: 'Brand can repost with credit', zh: '品牌可转发并注明来源' },
  { value: 'full_buyout', en: 'Full buyout', zh: '完全买断' },
  { value: 'negotiable', en: 'Negotiable', zh: '可协商' },
]

const EXCLUSIVITY_OPTIONS = [
  { value: 'none', en: 'None', zh: '无' },
  { value: 'category_30', en: 'Category exclusive (30 days)', zh: '品类独家 (30天)' },
  { value: 'full_30', en: 'Full exclusive (30 days)', zh: '全面独家 (30天)' },
  { value: 'custom', en: 'Custom', zh: '自定义' },
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'KRW', 'AUD', 'CAD']

const STEPS_EN = ['Brief & Criteria', 'Quantity', 'Preview', 'Done']
const STEPS_ZH = ['简介 & 条件', '数量', '预览', '完成']

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Criteria {
  niches: string[]
  countries: string[]
  followerTier: string // 'nano' | 'micro' | ... | 'custom'
  followerMin: string
  followerMax: string
  languages: string[]
  minEngagement: string
  contentFormats: string[]
  audienceCountries: string[]
  // Advanced
  keywords: string
  excludeContacted: boolean
  brandSafety: string[]
}

interface CollabDetails {
  compType: string[]
  budgetMin: string
  budgetMax: string
  currency: string
  giftDescription: string
  deliverables: Record<string, number> // e.g. { reel: 2, story_set: 1 }
  timelineStart: string
  timelineEnd: string
  brandIntro: string
  // Advanced
  contentGuidelines: string
  usageRights: string
  exclusivity: string
  deadline: string
  customNote: string
}

interface Recipient {
  id: string
  displayName: string | null
  handle: string
  avatarUrl: string | null
  platform: string
  followerCount: number | null
  engagementRate: number | null
  matchScore: number | null
  matchReason: string | null
}

interface SendResult {
  sent: number
  failed: number
  creditsUsed: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center mb-8">
      {labels.map((label, i) => {
        const s = i + 1
        const done = s < current
        const active = s === current
        return (
          <div key={label} className="contents">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition
                  ${active ? 'bg-primary-600 text-white ring-4 ring-primary-100' : done ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}`}
              >
                {done ? '✓' : s}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-primary-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 mt-[-16px] rounded-full ${done ? 'bg-primary-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function MatchScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{score}</span>
}

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function ChipSelect({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              active
                ? 'bg-primary-600 text-white font-semibold'
                : 'bg-gray-100 text-gray-600 font-medium hover:bg-gray-200'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition"
    >
      <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NewOutreachPage() {
  const { t, locale } = useLanguage()
  const zh = locale === 'zh'
  const steps = zh ? STEPS_ZH : STEPS_EN
  const [step, setStep] = useState(1)

  // Step 1A: Targeting
  const [platform, setPlatform] = useState('instagram')
  const [criteria, setCriteria] = useState<Criteria>({
    niches: [],
    countries: [],
    followerTier: '',
    followerMin: '',
    followerMax: '',
    languages: [],
    minEngagement: '',
    contentFormats: [],
    audienceCountries: [],
    keywords: '',
    excludeContacted: true,
    brandSafety: [],
  })
  const [showAdvTargeting, setShowAdvTargeting] = useState(false)

  // Step 1B: Collaboration
  const [title, setTitle] = useState('')
  const [pitch, setPitch] = useState('')
  const [collab, setCollab] = useState<CollabDetails>({
    compType: [],
    budgetMin: '',
    budgetMax: '',
    currency: 'USD',
    giftDescription: '',
    deliverables: {},
    timelineStart: '',
    timelineEnd: '',
    brandIntro: '',
    contentGuidelines: '',
    usageRights: '',
    exclusivity: '',
    deadline: '',
    customNote: '',
  })
  const [showAdvCollab, setShowAdvCollab] = useState(false)

  // Step 2
  const [quantity, setQuantity] = useState(10)

  // Results
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validation
  const step1Valid =
    title.trim().length > 0 &&
    pitch.length >= 10 && pitch.length <= 500 &&
    collab.compType.length > 0 &&
    Object.values(collab.deliverables).some((v) => v > 0)

  // Helpers
  const toggleArr = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]

  const setCriteriaField = <K extends keyof Criteria>(key: K, val: Criteria[K]) =>
    setCriteria((c) => ({ ...c, [key]: val }))

  const setCollabField = <K extends keyof CollabDetails>(key: K, val: CollabDetails[K]) =>
    setCollab((c) => ({ ...c, [key]: val }))

  const setDeliverable = (type: string, qty: number) =>
    setCollab((c) => ({
      ...c,
      deliverables: qty > 0
        ? { ...c.deliverables, [type]: qty }
        : Object.fromEntries(Object.entries(c.deliverables).filter(([k]) => k !== type)),
    }))

  const selectFollowerTier = (tier: typeof FOLLOWER_TIERS[number] | null, name: string) => {
    if (!tier) {
      setCriteria((c) => ({ ...c, followerTier: 'custom', followerMin: '', followerMax: '' }))
      return
    }
    setCriteria((c) => ({
      ...c,
      followerTier: name,
      followerMin: String(tier.min),
      followerMax: tier.max ? String(tier.max) : '',
    }))
  }

  const showBudget = collab.compType.some((c) => c === 'paid' || c === 'paid_gift')
  const showGift = collab.compType.some((c) => c === 'gifted' || c === 'paid_gift')

  // Build the briefMessage from structured fields (for backward compat with API)
  const buildBriefMessage = () => {
    const parts: string[] = []
    if (collab.brandIntro.trim()) parts.push(collab.brandIntro.trim())
    parts.push(pitch.trim())
    const compLabels = collab.compType.map((c) => COMP_TYPES.find((o) => o.value === c)?.[zh ? 'zh' : 'en'] || c)
    if (compLabels.length) parts.push(`${zh ? '合作形式' : 'Compensation'}: ${compLabels.join(', ')}`)
    if (showBudget && (collab.budgetMin || collab.budgetMax)) {
      const range = collab.budgetMin && collab.budgetMax
        ? `${collab.currency} ${collab.budgetMin}–${collab.budgetMax}`
        : collab.budgetMin ? `${collab.currency} ${collab.budgetMin}+` : `${zh ? '最高' : 'up to'} ${collab.currency} ${collab.budgetMax}`
      parts.push(`${zh ? '预算' : 'Budget'}: ${range}`)
    }
    if (showGift && collab.giftDescription.trim()) parts.push(`${zh ? '赠品' : 'Gift'}: ${collab.giftDescription.trim()}`)
    const delNames = Object.entries(collab.deliverables)
      .filter(([, q]) => q > 0)
      .map(([k, q]) => `${q}x ${DELIVERABLE_TYPES.find((d) => d.value === k)?.[zh ? 'zh' : 'en'] || k}`)
    if (delNames.length) parts.push(`${zh ? '交付内容' : 'Deliverables'}: ${delNames.join(', ')}`)
    if (collab.timelineEnd) parts.push(`${zh ? '截止日期' : 'Timeline'}: ${collab.timelineEnd}`)
    return parts.join('\n\n')
  }

  // Build criteria payload
  const buildCriteria = () => {
    const c: Record<string, any> = {}
    if (criteria.niches.length) c.niche = criteria.niches[0] // primary niche for DB filter
    c.niches = criteria.niches
    if (criteria.countries.length) c.country = criteria.countries[0]
    c.countries = criteria.countries
    if (criteria.followerMin) c.minFollowers = Number(criteria.followerMin)
    if (criteria.followerMax) c.maxFollowers = Number(criteria.followerMax)
    if (criteria.languages.length) c.language = criteria.languages[0]
    c.languages = criteria.languages
    if (criteria.minEngagement) c.minEngagement = Number(criteria.minEngagement)
    if (criteria.contentFormats.length) c.contentFormats = criteria.contentFormats
    if (criteria.audienceCountries.length) c.audienceCountries = criteria.audienceCountries
    if (criteria.keywords.trim()) {
      c.keywords = criteria.keywords
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    }
    c.excludeContacted = criteria.excludeContacted
    if (criteria.brandSafety.length) c.brandSafety = criteria.brandSafety
    return Object.keys(c).length > 0 ? c : null
  }

  const handleFindCreators = async () => {
    setLoading(true)
    setError(null)
    try {
      const createRes = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          briefMessage: buildBriefMessage(),
          quantity,
          platform,
          criteria: buildCriteria(),
          collaborationDetails: {
            pitch,
            ...collab,
          },
        }),
      })
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}))
        throw new Error(d.message || 'Failed to create outreach')
      }
      const { campaign } = await createRes.json()
      setCampaignId(campaign.id)

      const selectRes = await fetch(`/api/outreach/${campaign.id}/select`, { method: 'POST' })
      if (!selectRes.ok) {
        const d = await selectRes.json().catch(() => ({}))
        throw new Error(d.message || 'Failed to select creators')
      }
      const { recipients: selected } = await selectRes.json()
      setRecipients(selected ?? [])
      setStep(3)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!campaignId) return
    setLoading(true)
    setError(null)
    try {
      const sendRes = await fetch(`/api/outreach/${campaignId}/send`, { method: 'POST' })
      if (!sendRes.ok) {
        const d = await sendRes.json().catch(() => ({}))
        throw new Error(d.message || 'Failed to send outreach')
      }
      const result = await sendRes.json()
      setSendResult({
        sent: result.totalSent ?? 0,
        failed: result.totalFailed ?? 0,
        creditsUsed: result.creditsCost ?? 0,
      })
      setStep(4)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Shared styles
  const labelCls = 'text-xs font-medium text-gray-600'
  const inputCls = 'workspace-glass-control rounded-xl w-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  // Sidebar tips
  const tips = zh
    ? [
        '明确描述合作需求和目标受众',
        '选择合适的内容领域和达人类型',
        '提供清晰的报酬信息以提高回复率',
        '设置合理的粉丝量和互动率要求',
        '在品牌简介中突出你的优势',
      ]
    : [
        'Be specific about your collaboration goals',
        'Choose the right niches and creator types',
        'Include clear compensation details to boost response rates',
        'Set realistic follower and engagement requirements',
        'Highlight your brand strengths in the introduction',
      ]

  // Outreach preview data
  const selectedNiches = criteria.niches.slice(0, 2).join(', ') || (zh ? '未设置' : 'Not set')
  const selectedCountries = criteria.countries.slice(0, 2).join(', ') || (zh ? '全球' : 'Global')
  const compLabels = collab.compType.map((c) => COMP_TYPES.find((o) => o.value === c)?.[zh ? 'zh' : 'en'] || c)

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-7xl mx-auto">
        {/* Back link */}
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {zh ? '返回' : 'Back'}
        </button>

        {/* Page header */}
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest text-primary-600 uppercase mb-1">
            {zh ? '批量触达' : 'MASS OUTREACH'}
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            {zh ? '新建批量触达' : 'New Mass Outreach'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {zh ? '找到匹配的达人并发送合作邀请' : 'Find qualified creators and send collaboration invitations'}
          </p>
        </div>

        <StepIndicator current={step} labels={steps} />

        <div className="flex gap-8 items-start">
        {/* Left: main content */}
        <div className="flex-1 min-w-0">

        {/* ================================================================
            Step 1: Brief & Criteria (two sections)
            ================================================================ */}
        {step === 1 && (
          <div className="space-y-6">
            {/* ---- Section A: Creator Targeting ---- */}
            <div className="workspace-glass-card rounded-3xl p-7 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {zh ? '达人筛选条件' : 'Creator Targeting'}
              </h2>

              {/* Platform */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '平台' : 'Platform'} <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPlatform(p.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition
                        ${platform === p.value
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Niche */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '内容领域 / 类别' : 'Niche / Category'}</label>
                <ChipSelect
                  options={NICHE_OPTIONS.map((n) => ({ value: n, label: n }))}
                  selected={criteria.niches}
                  onToggle={(v) => setCriteriaField('niches', toggleArr(criteria.niches, v))}
                />
              </div>

              {/* Creator Location */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '达人所在地区' : 'Creator Location'}</label>
                <div className="flex flex-wrap gap-2">
                  {COUNTRY_FILTER_OPTIONS.map(({ code, key }) => {
                    const active = criteria.countries.includes(code)
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setCriteriaField('countries', toggleArr(criteria.countries, code))}
                        className={`px-3 py-1.5 rounded-full text-sm transition ${
                          active
                            ? 'bg-primary-600 text-white font-semibold'
                            : 'bg-gray-100 text-gray-600 font-medium hover:bg-gray-200'
                        }`}
                      >
                        {(t.signupBusiness?.countries as Record<string, string>)?.[key] || code}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Follower Range */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '粉丝量级' : 'Follower Range'}</label>
                <div className="flex flex-wrap gap-2">
                  {FOLLOWER_TIERS.map((tier) => {
                    const name = tier.label.toLowerCase()
                    const active = criteria.followerTier === name
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => selectFollowerTier(active ? null : tier, name)}
                        className={`px-3 py-1.5 rounded-full text-sm transition ${
                          active
                            ? 'bg-primary-600 text-white font-semibold'
                            : 'bg-gray-100 text-gray-600 font-medium hover:bg-gray-200'
                        }`}
                      >
                        {zh ? tier.labelZh : tier.label}
                        <span className="text-xs opacity-70 ml-1">
                          {tier.max ? `${formatFollowers(tier.min)}–${formatFollowers(tier.max)}` : `${formatFollowers(tier.min)}+`}
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => selectFollowerTier(null, 'custom')}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${
                      criteria.followerTier === 'custom'
                        ? 'bg-primary-600 text-white font-semibold'
                        : 'bg-gray-100 text-gray-600 font-medium hover:bg-gray-200'
                    }`}
                  >
                    {zh ? '自定义' : 'Custom'}
                  </button>
                </div>
                {criteria.followerTier === 'custom' && (
                  <div className="flex gap-3 mt-2">
                    <input
                      type="number"
                      value={criteria.followerMin}
                      onChange={(e) => setCriteriaField('followerMin', e.target.value)}
                      placeholder={zh ? '最少' : 'Min'}
                      min={0}
                      className={`w-32 ${inputCls}`}
                    />
                    <span className="self-center text-gray-400">–</span>
                    <input
                      type="number"
                      value={criteria.followerMax}
                      onChange={(e) => setCriteriaField('followerMax', e.target.value)}
                      placeholder={zh ? '最多' : 'Max'}
                      min={0}
                      className={`w-32 ${inputCls}`}
                    />
                  </div>
                )}
              </div>

              {/* Language */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '语言' : 'Language'}</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_FILTER_OPTIONS.map(({ code, label }) => {
                    const active = criteria.languages.includes(code)
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setCriteriaField('languages', toggleArr(criteria.languages, code))}
                        className={`px-3 py-1.5 rounded-full text-sm transition ${
                          active
                            ? 'bg-primary-600 text-white font-semibold'
                            : 'bg-gray-100 text-gray-600 font-medium hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Min Engagement */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '最低互动率 (%)' : 'Min Engagement Rate (%)'}</label>
                <input
                  type="number"
                  value={criteria.minEngagement}
                  onChange={(e) => setCriteriaField('minEngagement', e.target.value)}
                  placeholder={zh ? '例如 2.0' : 'e.g. 2.0'}
                  min={0}
                  max={100}
                  step={0.1}
                  className={`w-32 ${inputCls}`}
                />
              </div>

              {/* Advanced targeting */}
              <SectionToggle
                label={zh ? '高级筛选' : 'Advanced Filters'}
                open={showAdvTargeting}
                onToggle={() => setShowAdvTargeting((v) => !v)}
              />
              {showAdvTargeting && (
                <div className="space-y-5 pl-1 border-l-2 border-gray-100 ml-1">
                  {/* Content Format */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '内容形式偏好' : 'Content Format Preference'}</label>
                    <ChipSelect
                      options={CONTENT_FORMATS.map((f) => ({ value: f.value, label: zh ? f.zh : f.en }))}
                      selected={criteria.contentFormats}
                      onToggle={(v) => setCriteriaField('contentFormats', toggleArr(criteria.contentFormats, v))}
                    />
                  </div>

                  {/* Audience Country */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '受众所在地区' : 'Audience Country'}</label>
                    <p className="text-[11px] text-gray-400">{zh ? '达人的受众主要在哪些国家/地区' : "Where the creator's audience is based (not the creator themselves)"}</p>
                    <div className="flex flex-wrap gap-2">
                      {COUNTRY_FILTER_OPTIONS.slice(0, 10).map(({ code, key }) => {
                        const active = criteria.audienceCountries.includes(code)
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => setCriteriaField('audienceCountries', toggleArr(criteria.audienceCountries, code))}
                            className={`px-3 py-1.5 rounded-full text-xs transition ${
                              active
                                ? 'bg-primary-600 text-white font-semibold'
                                : 'bg-gray-100 text-gray-600 font-medium hover:bg-gray-200'
                            }`}
                          >
                            {(t.signupBusiness?.countries as Record<string, string>)?.[key] || code}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '关键词' : 'Keywords'}</label>
                    <input
                      type="text"
                      value={criteria.keywords}
                      onChange={(e) => setCriteriaField('keywords', e.target.value)}
                      placeholder={zh ? '例如 sustainable, vegan, streetwear' : 'e.g. sustainable, vegan, streetwear'}
                      className={inputCls}
                    />
                  </div>

                  {/* Exclude contacted */}
                  <label className="flex items-center gap-3 pl-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criteria.excludeContacted}
                      onChange={(e) => setCriteriaField('excludeContacted', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      {zh ? '排除近期已联系的达人' : 'Exclude recently contacted creators'}
                    </span>
                  </label>

                  {/* Brand Safety */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '品牌安全' : 'Brand Safety'}</label>
                    <ChipSelect
                      options={BRAND_SAFETY_OPTIONS.map((o) => ({ value: o.value, label: zh ? o.zh : o.en }))}
                      selected={criteria.brandSafety}
                      onToggle={(v) => setCriteriaField('brandSafety', toggleArr(criteria.brandSafety, v))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ---- Section B: Collaboration Details ---- */}
            <div className="workspace-glass-card rounded-3xl p-7 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {zh ? '合作详情' : 'Collaboration Details'}
              </h2>

              {/* Title */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '触达标题' : 'Outreach Title'} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={zh ? '例如 夏季新品推广' : 'e.g. Summer Collection Launch'}
                  className={inputCls}
                />
              </div>

              {/* Pitch */}
              <div className="space-y-1.5">
                <label className={labelCls}>
                  {zh ? '合作描述' : "What's the collaboration?"} <span className="text-red-500">*</span>
                  <span className="ml-2 text-gray-400 font-normal">({pitch.length}/500)</span>
                </label>
                <textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder={zh
                    ? '简要描述您的合作需求。例如："我们即将推出新款护肤系列，希望寻找达人分享真实使用体验..."'
                    : 'Briefly describe what you\'re looking for. E.g. "We\'re launching a new skincare line and looking for creators to share honest reviews..."'
                  }
                  className={`${inputCls} resize-none`}
                />
                {pitch.length > 0 && pitch.length < 10 && (
                  <p className="text-xs text-red-500">{zh ? '至少 10 个字符' : 'Minimum 10 characters'}</p>
                )}
              </div>

              {/* Compensation */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '合作形式' : 'Compensation Type'} <span className="text-red-500">*</span></label>
                <ChipSelect
                  options={COMP_TYPES.map((c) => ({ value: c.value, label: zh ? c.zh : c.en }))}
                  selected={collab.compType}
                  onToggle={(v) => setCollabField('compType', toggleArr(collab.compType, v))}
                />
              </div>

              {/* Budget (conditional) */}
              {showBudget && (
                <div className="space-y-1.5">
                  <label className={labelCls}>{zh ? '每位达人预算' : 'Budget per Creator'}</label>
                  <div className="flex gap-3 items-center">
                    <select
                      value={collab.currency}
                      onChange={(e) => setCollabField('currency', e.target.value)}
                      className={`w-24 ${inputCls}`}
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="number"
                      value={collab.budgetMin}
                      onChange={(e) => setCollabField('budgetMin', e.target.value)}
                      placeholder={zh ? '最低' : 'Min'}
                      min={0}
                      className={`w-28 ${inputCls}`}
                    />
                    <span className="text-gray-400">–</span>
                    <input
                      type="number"
                      value={collab.budgetMax}
                      onChange={(e) => setCollabField('budgetMax', e.target.value)}
                      placeholder={zh ? '最高' : 'Max'}
                      min={0}
                      className={`w-28 ${inputCls}`}
                    />
                  </div>
                </div>
              )}

              {/* Gift (conditional) */}
              {showGift && (
                <div className="space-y-1.5">
                  <label className={labelCls}>{zh ? '赠品说明' : 'Gift Description'}</label>
                  <input
                    type="text"
                    value={collab.giftDescription}
                    onChange={(e) => setCollabField('giftDescription', e.target.value)}
                    placeholder={zh ? '例如 全套护肤礼盒（价值约 ¥800）' : 'e.g. Full skincare set (value ~$120)'}
                    className={inputCls}
                  />
                </div>
              )}

              {/* Deliverables */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '交付内容' : 'Deliverables'} <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {DELIVERABLE_TYPES.map((d) => {
                    const qty = collab.deliverables[d.value] || 0
                    const active = qty > 0
                    return (
                      <div
                        key={d.value}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 border transition ${
                          active ? 'border-primary-300 bg-primary-50/40' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <span className={`text-sm ${active ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                          {zh ? d.zh : d.en}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDeliverable(d.value, Math.max(0, qty - 1))}
                            className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-sm font-bold hover:bg-gray-200 transition"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setDeliverable(d.value, Math.min(10, qty + 1))}
                            className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-sm font-bold hover:bg-gray-200 transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-1.5">
                <label className={labelCls}>{zh ? '内容交付时间' : 'Timeline'}</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="date"
                    value={collab.timelineStart}
                    onChange={(e) => setCollabField('timelineStart', e.target.value)}
                    className={`flex-1 ${inputCls}`}
                  />
                  <span className="text-gray-400">{zh ? '至' : 'to'}</span>
                  <input
                    type="date"
                    value={collab.timelineEnd}
                    onChange={(e) => setCollabField('timelineEnd', e.target.value)}
                    className={`flex-1 ${inputCls}`}
                  />
                </div>
              </div>

              {/* Brand Intro */}
              <div className="space-y-1.5">
                <label className={labelCls}>
                  {zh ? '品牌简介' : 'Brand Introduction'}
                  <span className="ml-2 text-gray-400 font-normal">({collab.brandIntro.length}/300)</span>
                </label>
                <textarea
                  value={collab.brandIntro}
                  onChange={(e) => setCollabField('brandIntro', e.target.value.slice(0, 300))}
                  rows={2}
                  placeholder={zh
                    ? '1-2 句话介绍您的品牌，方便不了解您的达人快速认识'
                    : '1-2 sentences about your brand for creators who don\'t know you yet'
                  }
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Advanced collaboration */}
              <SectionToggle
                label={zh ? '高级选项' : 'Advanced Options'}
                open={showAdvCollab}
                onToggle={() => setShowAdvCollab((v) => !v)}
              />
              {showAdvCollab && (
                <div className="space-y-5 pl-1 border-l-2 border-gray-100 ml-1">
                  {/* Content Guidelines */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '内容要求' : 'Content Guidelines'}</label>
                    <textarea
                      value={collab.contentGuidelines}
                      onChange={(e) => setCollabField('contentGuidelines', e.target.value.slice(0, 500))}
                      rows={2}
                      placeholder={zh ? '必须提到的要点、标签、注意事项等' : 'Any must-mention points, hashtags, or dos/don\'ts'}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* Usage Rights */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '内容使用权' : 'Usage Rights'}</label>
                    <select
                      value={collab.usageRights}
                      onChange={(e) => setCollabField('usageRights', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">{zh ? '未指定' : 'Not specified'}</option>
                      {USAGE_RIGHTS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{zh ? o.zh : o.en}</option>
                      ))}
                    </select>
                  </div>

                  {/* Exclusivity */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '独家要求' : 'Exclusivity'}</label>
                    <select
                      value={collab.exclusivity}
                      onChange={(e) => setCollabField('exclusivity', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">{zh ? '未指定' : 'Not specified'}</option>
                      {EXCLUSIVITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{zh ? o.zh : o.en}</option>
                      ))}
                    </select>
                  </div>

                  {/* Application Deadline */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '报名截止日期' : 'Application Deadline'}</label>
                    <input
                      type="date"
                      value={collab.deadline}
                      onChange={(e) => setCollabField('deadline', e.target.value)}
                      className={`w-48 ${inputCls}`}
                    />
                  </div>

                  {/* Custom Note */}
                  <div className="space-y-1.5 pl-4">
                    <label className={labelCls}>{zh ? '补充说明' : 'Additional Notes'}</label>
                    <textarea
                      value={collab.customNote}
                      onChange={(e) => setCollabField('customNote', e.target.value.slice(0, 500))}
                      rows={2}
                      placeholder={zh ? '其他需要达人知道的信息' : 'Anything else you want creators to know'}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Next */}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="bg-primary-600 text-white rounded-xl px-8 py-3 font-semibold hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {zh ? '下一步' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            Step 2: Quantity
            ================================================================ */}
        {step === 2 && (
          <div className="workspace-glass-card rounded-3xl p-7 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {zh ? '需要多少达人？' : 'How many creators?'}
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">{zh ? '数量' : 'Quantity'}</label>
                <span className="text-2xl font-bold text-primary-600">{quantity}</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>1</span>
                <span>100</span>
              </div>
            </div>

            <div className="workspace-glass-card rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">{zh ? '预计消耗积分' : 'Estimated Credit Cost'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{zh ? '每条触达消耗 12 积分' : '12 credits per outreach message'}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-600">{quantity * 12}</p>
                <p className="text-xs text-gray-400">{zh ? '积分' : 'credits'}</p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep(1); setError(null) }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl px-6 py-3 font-semibold hover:bg-gray-50 transition"
              >
                {zh ? '上一步' : 'Back'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleFindCreators}
                className="flex-1 bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {zh ? 'AI 正在为您寻找最佳达人...' : 'AI is finding the best creators for you...'}
                  </>
                ) : (
                  zh ? '寻找达人' : 'Find Creators'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            Step 3: Preview
            ================================================================ */}
        {step === 3 && (
          <div className="workspace-glass-card rounded-3xl p-7 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {zh ? '已选达人' : 'Selected Creators'}
              </h2>
              <span className="text-sm text-gray-500">
                {recipients.length} {zh ? '位达人' : 'creators'} · {recipients.length * 12} {zh ? '积分' : 'credits'}
              </span>
            </div>

            {recipients.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-500">
                {zh ? '未找到匹配的达人，请调整筛选条件。' : 'No creators were selected. Try adjusting your criteria.'}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recipients.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/60">
                    {r.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {(r.displayName || r.handle || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{r.displayName || r.handle}</span>
                        <span className="text-xs text-gray-400">{r.handle}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                        <span>{formatFollowers(r.followerCount ?? 0)} {zh ? '粉丝' : 'followers'}</span>
                        {r.engagementRate != null && Number(r.engagementRate) > 0 && <span>{Number(r.engagementRate).toFixed(1)}% {zh ? '互动率' : 'eng.'}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <MatchScoreBadge score={Number(r.matchScore)} />
                      {r.matchReason && (
                        <span className="text-xs text-gray-400 max-w-28 text-right truncate">{r.matchReason}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep(2); setError(null) }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl px-6 py-3 font-semibold hover:bg-gray-50 transition"
              >
                {zh ? '上一步' : 'Back'}
              </button>
              <button
                type="button"
                disabled={loading || recipients.length === 0}
                onClick={handleSend}
                className="flex-1 bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {zh ? '发送中...' : 'Sending...'}
                  </>
                ) : (
                  `${zh ? '全部发送' : 'Send All'} (${recipients.length})`
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            Step 4: Done
            ================================================================ */}
        {step === 4 && sendResult && (
          <div className="workspace-glass-card rounded-3xl p-10 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl">
              ✓
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{zh ? '触达已发送！' : 'Outreach Sent!'}</h2>
              <p className="text-sm text-gray-500 mt-1">{zh ? '消息已成功发送给达人。' : 'Your messages have been delivered to creators.'}</p>
            </div>

            <div className="flex gap-6 py-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{sendResult.sent}</p>
                <p className="text-xs text-gray-500">{zh ? '已发送' : 'Sent'}</p>
              </div>
              {sendResult.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{sendResult.failed}</p>
                  <p className="text-xs text-gray-500">{zh ? '失败' : 'Failed'}</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600">{sendResult.creditsUsed}</p>
                <p className="text-xs text-gray-500">{zh ? '消耗积分' : 'Credits used'}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs pt-2">
              <Link
                href="/dashboard/messages"
                className="bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition text-center"
              >
                {zh ? '查看消息' : 'View in Messages'}
              </Link>
              {campaignId && (
                <Link
                  href={`/dashboard/brand/outreach/${campaignId}`}
                  className="border border-gray-200 text-gray-700 rounded-xl px-6 py-3 font-semibold hover:bg-gray-50 transition text-center"
                >
                  {zh ? '查看触达详情' : 'View Outreach Details'}
                </Link>
              )}
              <Link
                href="/dashboard/brand/outreach/new"
                className="text-primary-600 text-sm font-medium hover:underline"
              >
                {zh ? '新建触达' : 'Create Another Outreach'}
              </Link>
            </div>
          </div>
        )}

        </div>{/* end left column */}

        {/* Right: Sidebar — visible on steps 1 & 2 */}
        {step <= 2 && (
          <div className="hidden lg:block w-80 flex-shrink-0 space-y-6">
            {/* Outreach Preview */}
            <div className="workspace-glass-card rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{zh ? '触达预览' : 'Outreach Preview'}</h3>
                  <p className="text-xs text-gray-400">{zh ? '您的触达配置概览。' : 'Overview of your outreach configuration.'}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 p-4 space-y-3">
                <span className="text-sm font-semibold text-gray-900 block truncate">
                  {title || (zh ? '触达标题' : 'Outreach Title')}
                </span>
                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582" /></svg>
                    <span>{PLATFORMS.find((p) => p.value === platform)?.label || platform}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /></svg>
                    <span>{selectedNiches}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                    <span>{selectedCountries}</span>
                  </div>
                  {compLabels.length > 0 && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      <span>{compLabels.join(', ')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                    <span>{quantity} {zh ? '位达人' : 'creators'} · {quantity * 12} {zh ? '积分' : 'credits'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="workspace-glass-card rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-xl">💡</span>
                <h3 className="text-sm font-semibold text-gray-900">{zh ? '成功触达的小技巧' : 'Tips for effective outreach'}</h3>
              </div>
              <ul className="space-y-2.5">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <svg className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        </div>{/* end flex row */}

      </div>
    </BrandWorkspaceLayout>
  )
}
