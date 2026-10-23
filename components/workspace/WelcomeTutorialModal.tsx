'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const STEPS = [
  {
    icon: '👋',
    title: { en: 'Welcome to Overseed!', zh: '欢迎来到 Overseed！' },
    subtitle: { en: 'Your AI-powered global expansion companion', zh: '您的 AI 全球扩展伙伴' },
    description: {
      en: 'Overseed helps brands discover creators worldwide, manage outreach, and launch cross-border campaigns — all in one place.',
      zh: 'Overseed 帮助品牌发现全球达人、管理触达、发起跨境营销活动 — 一站式完成。',
    },
    visual: (
      <div className="flex justify-center gap-3 mt-4">
        {['🌍', '🤝', '📈'].map((e, i) => (
          <div key={i} className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl">{e}</div>
        ))}
      </div>
    ),
  },
  {
    icon: '🏢',
    title: { en: 'Set up your brand', zh: '设置您的品牌' },
    subtitle: { en: 'Complete your profile to start collaborating', zh: '完善主页以开始合作' },
    description: {
      en: 'Fill in your company profile, upload your logo, and complete brand verification. Verified brands get higher visibility and creator trust.',
      zh: '填写公司资料、上传 Logo 并完成品牌认证。通过认证的品牌能获得更高的曝光率和达人信任。',
    },
    steps: {
      en: ['Complete your company profile', 'Submit brand verification', 'Add a payment method'],
      zh: ['完善公司资料', '提交品牌认证', '添加付款方式'],
    },
  },
  {
    icon: '📣',
    title: { en: 'Create your first campaign', zh: '创建您的首个活动' },
    subtitle: { en: 'Tell creators what you need', zh: '告诉达人您的需求' },
    description: {
      en: 'Describe your campaign goals, set your budget, and specify the type of creators you want. Our AI will help match you with the right ones.',
      zh: '描述您的活动目标、设置预算并指定您想要的达人类型。我们的 AI 将帮助匹配合适的达人。',
    },
    steps: {
      en: ['Define campaign goals and budget', 'Set creator requirements', 'Publish and start receiving applications'],
      zh: ['定义活动目标和预算', '设置达人要求', '发布并开始接收申请'],
    },
  },
  {
    icon: '🔍',
    title: { en: 'Find & connect with creators', zh: '发现并联系达人' },
    subtitle: { en: 'Discover creators from our global database', zh: '从我们的全球数据库中发现达人' },
    description: {
      en: 'Search our database of millions of creators across TikTok, Instagram, and YouTube. Use AI-powered matching, view detailed profiles, and reach out directly.',
      zh: '搜索我们在 TikTok、Instagram 和 YouTube 上的数百万达人数据库。使用 AI 匹配、查看详细主页并直接联系。',
    },
    steps: {
      en: ['Search by niche, location, or audience', 'View creator profiles and analytics', 'Send outreach through Overseed'],
      zh: ['按领域、地区或受众搜索', '查看达人主页和分析', '通过 Overseed 发送触达'],
    },
  },
]

export default function WelcomeTutorialModal() {
  const { data: session } = useSession()
  const { locale, t } = useLanguage()
  const zh = locale === 'zh'
  const pt = t.productTour
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/user/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.needsTutorial) setOpen(true)
      })
      .catch(() => {})
  }, [session?.user])

  if (!open) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const tr = (s: { en: string; zh: string }) => zh ? s.zh : s.en

  const complete = async () => {
    setClosing(true)
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completeTutorial' }),
      })
    } catch {}
    setOpen(false)
  }

  const next = () => {
    if (isLast) {
      complete()
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        data-solid
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-primary-600' : i < step ? 'w-4 bg-primary-300' : 'w-4 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <span className="text-4xl">{current.icon}</span>
            <h2 className="text-xl font-bold text-gray-900 mt-3">{tr(current.title)}</h2>
            <p className="text-sm text-primary-600 font-medium mt-1">{tr(current.subtitle)}</p>
            <p className="text-sm text-gray-500 mt-3 leading-relaxed">{tr(current.description)}</p>
            {'visual' in current && current.visual}
          </div>

          {'steps' in current && current.steps && (
            <div className="space-y-2.5 mb-6">
              {(zh ? current.steps.zh : current.steps.en).map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700">{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 sm:px-8 pb-6 sm:pb-8">
          <button
            onClick={complete}
            className="text-sm text-gray-400 hover:text-gray-600 transition"
            disabled={closing}
          >
            {pt.skip}
          </button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-5 py-2.5 border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                {pt.prev}
              </button>
            )}
            <button
              onClick={next}
              disabled={closing}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-full text-sm font-semibold shadow-sm hover:bg-primary-700 transition disabled:opacity-50"
            >
              {isLast ? pt.done : pt.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
