'use client'

import MainLayout from '@/components/MainLayout'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { ReactNode } from 'react'

interface Service {
  icon: ReactNode
  title: { en: string; zh: string }
  desc: { en: string; zh: string }
}

const SERVICES: Service[] = [
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: { en: 'Product sourcing', zh: '产品采购' },
    desc: {
      en: 'We identify and vet factories across China to match your product requirements, MOQs and target cost.',
      zh: '我们在中国各地寻找并审核工厂，匹配您的产品需求、最低起订量和目标成本。',
    },
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: { en: 'Supplier coordination', zh: '供应商协调' },
    desc: {
      en: 'Ongoing communication with manufacturers on your behalf — samples, pricing negotiation, production timelines.',
      zh: '代您与制造商持续沟通——样品、价格谈判、生产排期。',
    },
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3H8l-2 4h12l-2-4z" />
      </svg>
    ),
    title: { en: 'OEM / Private Label', zh: 'OEM / 自有品牌' },
    desc: {
      en: 'Custom branding, packaging design and private-label production runs managed end to end.',
      zh: '定制品牌、包装设计和自有品牌生产，全程管理。',
    },
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: { en: 'Quality control', zh: '质量控制' },
    desc: {
      en: 'Pre-shipment inspections, AQL sampling and factory audits so you receive exactly what you ordered.',
      zh: '出货前检验、AQL抽样和工厂审核，确保您收到的产品与订单一致。',
    },
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
    title: { en: 'Export & logistics coordination', zh: '出口与物流协调' },
    desc: {
      en: 'Freight forwarding, customs documentation and door-to-door delivery to your warehouse.',
      zh: '货运代理、报关单证及门到门配送至您的仓库。',
    },
  },
]

const COPY = {
  badge: { en: 'Overseed Sourcing', zh: 'Overseed 采购服务' },
  heading1: { en: 'China sourcing &', zh: '中国采购 &' },
  heading2: { en: 'international trade solutions', zh: '国际贸易解决方案' },
  subtitle: {
    en: 'We work with vetted Chinese manufacturers to supply overseas distributors, wholesalers and retailers.',
    zh: '我们与经过审核的中国制造商合作，为海外分销商、批发商和零售商供货。',
  },
  ctaTitle: { en: 'Ready to source?', zh: '准备开始采购？' },
  ctaDesc: {
    en: "Tell us what you need and we'll get back to you within 24 hours.",
    zh: '告诉我们您的需求，我们将在 24 小时内回复您。',
  },
  ctaAlt: { en: 'Or', zh: '或' },
  ctaLink: { en: 'use our contact form', zh: '使用联系表单' },
}

export default function SourcingPage() {
  const { locale } = useLanguage()
  const zh = locale === 'zh'
  const l = (obj: { en: string; zh: string }) => (zh ? obj.zh : obj.en)

  return (
    <MainLayout>
      <div className="overflow-hidden hp-themed-gradient font-normal text-[#2d314e]">
        <section className="relative px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="relative z-10 mx-auto max-w-5xl text-center pt-20 pb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d4e1ef] bg-[#f9fbff]/75 px-5 py-2 text-sm font-normal text-[#2d314e] shadow-[inset_0_1px_8px_rgba(255,255,255,0.9),0_12px_28px_rgba(88,126,171,0.12)] backdrop-blur-md mb-8">
              <svg className="w-4 h-4 text-[#6f9bd0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              {l(COPY.badge)}
            </span>
            <h1
              className="text-4xl sm:text-5xl font-bold text-[#2d314e] mb-5 leading-tight"
              style={{ fontFamily: 'var(--font-manrope), var(--font-noto-sans-sc), system-ui, sans-serif', fontWeight: 900 }}
            >
              {l(COPY.heading1)}<br />{l(COPY.heading2)}
            </h1>
            <p className="text-lg text-[#5a6278] max-w-2xl mx-auto leading-relaxed">
              {l(COPY.subtitle)}
            </p>
          </div>

          {/* Services grid */}
          <div className="mx-auto max-w-5xl pb-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {SERVICES.map((s) => (
                <div
                  key={s.title.en}
                  className="rounded-[24px] border border-[#dbe9f8] bg-[#f8fbff]/75 p-7 shadow-[inset_0_1px_12px_rgba(255,255,255,0.95),0_14px_30px_rgba(78,123,174,0.1)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:scale-[1.02]"
                >
                  <div className="w-11 h-11 rounded-xl border border-[#d4e1ef] bg-[#edf4ff] flex items-center justify-center text-[#6f9bd0] mb-5">
                    {s.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-[#2d314e] mb-2">{l(s.title)}</h3>
                  <p className="text-sm text-[#5a6278] leading-relaxed">{l(s.desc)}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="text-center rounded-[24px] border border-[#dbe9f8] bg-[#f8fbff]/75 p-10 shadow-[inset_0_1px_12px_rgba(255,255,255,0.95),0_14px_30px_rgba(78,123,174,0.1)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-[#2d314e] mb-2">{l(COPY.ctaTitle)}</h2>
              <p className="text-[#5a6278] mb-6">{l(COPY.ctaDesc)}</p>
              <a
                href="mailto:partnerships@overseed.net"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#6f9bd0] text-white rounded-full hover:bg-[#5f8fc6] transition font-semibold shadow-[0_18px_36px_rgba(74,124,184,0.25)]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                partnerships@overseed.net
              </a>
              <p className="text-xs text-[#8a93a8] mt-4">
                {l(COPY.ctaAlt)} <Link href="/contact" className="underline hover:text-[#5a6278] transition">{l(COPY.ctaLink)}</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}
