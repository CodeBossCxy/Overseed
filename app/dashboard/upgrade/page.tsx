'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import RoleShell from '@/components/workspace/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useViewMode } from '@/lib/hooks/useViewMode'

export default function UpgradePage() {
  const { data: session, update } = useSession()
  const { t, locale } = useLanguage()
  const { isInfluencer } = useViewMode()
  const searchParams = useSearchParams()
  const cancelled = searchParams.get('cancelled')
  const subscriptionTier = (session?.user as any)?.subscriptionTier || 'FREE'
  const isPaid = subscriptionTier === 'CAMPAIGN_PLUS' || subscriptionTier === 'OUTREACH_PLUS' || subscriptionTier === 'PRO'
  const [isLoading, setIsLoading] = useState(false)

  const features = [
    { icon: 'M12 4v16m8-8H4', label: locale === 'zh' ? '每日发布 5 个活动' : '5 campaigns per day' },
    { icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: locale === 'zh' ? '最多 30 个同时在线通告' : 'Up to 30 active campaigns' },
    { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', label: locale === 'zh' ? '每日 30 次达人沟通' : '30 new conversations per day' },
    { icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', label: locale === 'zh' ? 'AI 助手无限对话' : 'AI Assistant with full access' },
    { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: locale === 'zh' ? '安全支付与达人结算' : 'Secure payments & creator payouts' },
  ]

  const creatorFreeFeatures = [
    locale === 'zh' ? '浏览并收藏品牌活动' : 'Browse and save brand campaigns',
    locale === 'zh' ? '提交活动申请并管理合作' : 'Apply to campaigns and manage collaborations',
    locale === 'zh' ? '站内消息与自动翻译' : 'In-app messaging and auto translation',
    locale === 'zh' ? '达人资料与社交账号认证' : 'Creator profile and social account verification',
    locale === 'zh' ? '收款与合作进度管理' : 'Payouts and collaboration tracking',
  ]

  if (isInfluencer) {
    return (
      <RoleShell>
        <div className="max-w-3xl mx-auto px-4 workspace-page-tight pb-10">
          <div className="workspace-glass-card rounded-3xl overflow-hidden">
            <div className="px-8 py-8 text-center">
              <span className="inline-flex px-3 py-1 rounded-full selected-option-glass text-xs font-bold">
                {locale === 'zh' ? '限时免费' : 'Limited-time free'}
              </span>
              <h1 className="mt-5 text-3xl font-bold text-gray-900">
                {locale === 'zh' ? '达人端目前免费开放' : 'Creator access is free for now'}
              </h1>
              <p className="mt-3 text-gray-500">
                {locale === 'zh'
                  ? '在早期阶段，达人可以免费使用核心工作区功能。'
                  : 'During this launch period, creators can use the core workspace features at no cost.'}
              </p>
              <div className="mt-6 flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-gray-900">$0</span>
                <span className="text-gray-500">{locale === 'zh' ? '/ 月' : '/ mo'}</span>
              </div>
            </div>

            <div className="px-8 pb-8">
              <div className="grid sm:grid-cols-2 gap-3">
                {creatorFreeFeatures.map((label) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/55 px-4 py-3">
                    <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RoleShell>
    )
  }

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'CAMPAIGN_PLUS', interval: 'month' }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else {
        const data = await res.json()
        alert(data.error || t.upgrade.failedToStartCheckout)
      }
    } catch {
      alert(t.errors.somethingWrong)
    } finally {
      setIsLoading(false)
    }
  }

  const tierNames: Record<string, string> = {
    CAMPAIGN_PLUS: 'Campaign Plus',
    OUTREACH_PLUS: 'Outreach Plus',
    PRO: 'Pro',
  }

  if (isPaid) {
    return (
      <RoleShell>
      <div className="max-w-lg mx-auto px-4 workspace-page-tight pb-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {locale === 'zh'
              ? `您已订阅 ${tierNames[subscriptionTier] || subscriptionTier}`
              : `You're on ${tierNames[subscriptionTier] || subscriptionTier}`}
          </h1>
          <p className="text-gray-500">
            {locale === 'zh' ? '如需更多额度，可以升级套餐或购买 Credits。' : 'Need more? Compare plans or buy extra credits.'}
          </p>
          <a
            href="/pricing/brand"
            className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition"
          >
            {locale === 'zh' ? '查看所有套餐' : 'View all plans'}
          </a>
        </div>
      </RoleShell>
    )
  }

  return (
    <RoleShell>
      <div className="max-w-lg mx-auto px-4 workspace-page-tight pb-10">
        {cancelled && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            {locale === 'zh' ? '支付已取消。您可以随时再次升级。' : 'Payment cancelled. You can upgrade anytime.'}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-8 py-8 text-white text-center">
            <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold mb-4">CAMPAIGN PLUS</div>
            <h1 className="text-2xl font-bold mb-2">
              {locale === 'zh' ? '升级到 Campaign Plus' : 'Upgrade to Campaign Plus'}
            </h1>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold">¥69</span>
              <span className="text-white/70">/{locale === 'zh' ? '月' : 'mo'}</span>
            </div>
          </div>

          {/* Features */}
          <div className="px-8 py-6 space-y-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">{f.label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-8 pb-8">
            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {locale === 'zh' ? '跳转中...' : 'Redirecting...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  {locale === 'zh' ? '立即升级' : 'Upgrade Now'}
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              {locale === 'zh' ? '安全支付由 Stripe 提供。可随时取消。' : 'Secure payment via Stripe. Cancel anytime.'}
            </p>
            <p className="text-xs text-center mt-2">
              <a href="/pricing/brand" className="text-primary-600 hover:underline">
                {locale === 'zh' ? '对比全部套餐（Outreach Plus / Pro）' : 'Compare all plans (Outreach Plus / Pro)'}
              </a>
            </p>
          </div>
        </div>
      </div>
    </RoleShell>
  )
}
