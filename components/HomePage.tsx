'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useViewMode } from '@/lib/hooks/useViewMode'
import { useLanguage } from '@/lib/i18n/LanguageContext'

function useSectionReveal() {
  const refs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('hp-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08 }
    )

    refs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (i: number) => (el: HTMLElement | null) => {
    refs.current[i] = el
  }
}

type Audience = 'brand' | 'creator'

const heroStatImages = [
  '/home/hero-icon-matching.png',
  '/home/hero-icon-performance.png',
  '/home/hero-icon-translation.png',
]

const valueCardImages = [
  '/home/platform-matching.png',
  '/home/platform-deals.png',
  '/home/platform-workflows.png',
]

const brandCardImages = ['/home/brand-rocket.png', '/home/brand-globe.png', '/home/brand-chart.png']

const creatorCardImages = [
  '/home/creator-layers.png',
  '/home/creator-checklist.png',
  '/home/creator-standout.png',
]

const stepImages = [
  '/home/step-brief.png',
  '/home/step-browse.png',
  '/home/step-chat.png',
  '/home/step-collab.png',
]

const featureImages = ['/home/bfc-translate.png', '/home/bfc-chat.png', '/home/bfc-pay.png', '/home/bfc-ai.png']

const earlyAccessImages = ['/home/ea-store.png', '/home/ea-creator.png', '/home/ea-rocket.png']

function ArrowUpRight({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 17 17 7M9 7h8v8" />
    </svg>
  )
}

function ArrowRight({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12 4 4L19 6" />
    </svg>
  )
}

function LineIcon({ name, className = 'h-9 w-9' }: { name: string; className?: string }) {
  const common = {
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 48 48" stroke="currentColor" aria-hidden="true">
      {name === 'network' && (
        <>
          <circle cx="15" cy="30" r="6" {...common} />
          <circle cx="32" cy="17" r="6" {...common} />
          <path d="M20 26 27 21M13 36c2.5 3 6.5 5 11 5 8.8 0 16-7.2 16-16 0-2.8-.7-5.4-2-7.6" {...common} />
        </>
      )}
      {name === 'coin' && (
        <>
          <circle cx="24" cy="24" r="17" {...common} />
          <path d="M24 14v20M30 18.5c-1.3-1.3-3.3-2.2-6-2.2-3.2 0-5.3 1.4-5.3 3.8 0 2.5 2.4 3.3 6 4.1 3.7.8 6 1.7 6 4.4 0 2.5-2.4 4-6.1 4-3 0-5.4-.9-7-2.8" {...common} />
        </>
      )}
      {name === 'translate' && (
        <>
          <rect x="7" y="10" width="18" height="18" rx="3" {...common} />
          <rect x="22" y="20" width="19" height="18" rx="3" {...common} />
          <path d="M14 18h8M18 14v4c0 4-2.2 7-5 9M16 22c1.5 1.8 3.2 3.2 5 4M29 32l4-8 4 8M31 29h4" {...common} />
        </>
      )}
      {name === 'match' && (
        <>
          <circle cx="15" cy="31" r="5" {...common} />
          <circle cx="33" cy="17" r="5" {...common} />
          <path d="M19 28 29 20M14 36c4.5 4 11.8 4.6 17.1 1.2M34 12C29.3 8.5 22.4 8.2 17.3 12" {...common} />
        </>
      )}
      {name === 'deal' && (
        <>
          <path d="M15 15h20v19a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V15h24" {...common} />
          <path d="M19 15a5 5 0 0 1 10 0M24 9v29M13 24h22" {...common} />
          <rect x="27" y="25" width="14" height="11" rx="3" {...common} />
        </>
      )}
      {name === 'spark' && (
        <>
          <path d="M24 6 28.2 18.8 41 23l-12.8 4.2L24 40l-4.2-12.8L7 23l12.8-4.2L24 6Z" {...common} />
          <path d="M38 8v6M35 11h6M11 35v5M8.5 37.5h5" {...common} />
        </>
      )}
      {name === 'rocket' && (
        <>
          <path d="M20 29 12 37l-1-7-7-1 8-8M21 29l-2-2c-3-3-4.4-6.6-3.4-9.3C17.2 13 23.4 8.8 36 8c-.8 12.6-5 18.8-9.7 20.4-2.7 1-6.3-.4-9.3-3.4l-2-2" {...common} />
          <circle cx="29" cy="15" r="3" {...common} />
        </>
      )}
      {name === 'globe' && (
        <>
          <circle cx="24" cy="24" r="16" {...common} />
          <path d="M8 24h32M24 8c4.5 4.6 6.8 9.9 6.8 16S28.5 35.4 24 40M24 8c-4.5 4.6-6.8 9.9-6.8 16S19.5 35.4 24 40" {...common} />
          <path d="M14 13c3 2 6.3 3 10 3s7-1 10-3M14 35c3-2 6.3-3 10-3s7 1 10 3" {...common} />
        </>
      )}
      {name === 'chart' && (
        <>
          <path d="M10 37h27M13 31V20M23 31V12M33 31V18" {...common} />
          <circle cx="35" cy="13" r="7" {...common} />
          <path d="m40 18 5 5" {...common} />
        </>
      )}
      {name === 'layers' && (
        <>
          <path d="m24 8 17 8-17 8-17-8 17-8Z" {...common} />
          <path d="m9 24 15 7 15-7M9 32l15 7 15-7" {...common} />
        </>
      )}
      {name === 'checklist' && (
        <>
          <rect x="12" y="8" width="24" height="30" rx="4" {...common} />
          <path d="M18 17h1M23 17h8M18 24h1M23 24h8M18 31h1M23 31h8" {...common} />
          <circle cx="35" cy="35" r="6" {...common} />
          <path d="m32.5 35 2 2 3.5-4" {...common} />
        </>
      )}
      {name === 'standout' && (
        <>
          <circle cx="24" cy="17" r="6" {...common} />
          <path d="M11 39c1.8-7 7-11 13-11 3.8 0 7.1 1.6 9.5 4.4" {...common} />
          <path d="M36 25 38 30l5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" {...common} />
        </>
      )}
      {name === 'brief' && (
        <>
          <path d="M15 8h13l8 8v24H15V8Z" {...common} />
          <path d="M28 8v9h8M20 25h11M20 32h7" {...common} />
          <path d="M37 25 39 30l5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" {...common} />
        </>
      )}
      {name === 'cursor' && (
        <>
          <path d="M16 10c4-3 10-3 14 0s6 8 4 13" {...common} />
          <path d="m22 22 16 6-7 3-3 7-6-16Z" {...common} />
          <path d="M10 26c-2-6 0-12 5-16" {...common} />
        </>
      )}
      {name === 'messages' && (
        <>
          <rect x="8" y="12" width="21" height="15" rx="4" {...common} />
          <rect x="20" y="22" width="20" height="14" rx="4" {...common} />
          <path d="M15 27v7l7-7M26 36l7 6v-6M14 19h9M26 29h8" {...common} />
        </>
      )}
      {name === 'handshake' && (
        <>
          <path d="m17 20 6-6 5 5-6 6c-2 2-2 5 0 7l1 1" {...common} />
          <path d="m31 20 7 7-9 9c-2 2-5.2 2-7.2 0l-8-8" {...common} />
          <path d="m10 25 8-8M38 24l-8-8M15 31l5 5M20 27l7 7M26 24l6 6" {...common} />
        </>
      )}
      {name === 'payment' && (
        <>
          <rect x="8" y="13" width="30" height="20" rx="4" {...common} />
          <path d="M8 20h30M15 28h8" {...common} />
          <circle cx="35" cy="33" r="7" {...common} />
          <path d="M35 29v8M38 31c-.8-1-1.8-1.4-3-1.4-1.6 0-2.6.7-2.6 1.9 0 1.1 1 1.6 2.8 2s2.8.9 2.8 2.1c0 1.2-1.2 2-3 2-1.4 0-2.6-.4-3.4-1.3" {...common} />
        </>
      )}
      {name === 'store' && (
        <>
          <path d="M10 20h28l-3-10H13l-3 10Z" {...common} />
          <path d="M13 20v18h22V20M18 38V27h7v11M29 28h4M11 20c0 3 2 5 5 5s5-2 5-5c0 3 2 5 5 5s5-2 5-5c0 3 2 5 5 5s5-2 5-5" {...common} />
        </>
      )}
    </svg>
  )
}

function ButtonShell({
  children,
  tone = 'light',
  onClick,
  href,
}: {
  children: React.ReactNode
  tone?: 'light' | 'blue' | 'dark'
  onClick?: () => void
  href?: string
}) {
  const classes = [
    'group inline-flex min-h-[58px] items-center justify-center gap-4 rounded-full px-8 text-base font-normal transition duration-300',
    'focus:outline-none focus:ring-2 focus:ring-[#7ca8df] focus:ring-offset-2',
    tone === 'blue'
      ? 'bg-[#6f9bd0] text-white shadow-[inset_0_1px_10px_rgba(255,255,255,0.6),0_18px_36px_rgba(74,124,184,0.35)] hover:bg-[#5f8fc6]'
      : tone === 'dark'
        ? 'border border-white/20 bg-white/5 text-white shadow-[inset_0_1px_12px_rgba(255,255,255,0.08)] hover:bg-white/10'
        : 'border border-[#c9daf0] bg-[#f8fbff]/75 text-[#0a2d62] shadow-[inset_0_1px_10px_rgba(255,255,255,0.9),0_14px_30px_rgba(89,132,181,0.16)] hover:bg-white',
  ].join(' ')

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={classes} type="button">
      {children}
    </button>
  )
}

function SectionLabel({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`mx-auto mb-5 inline-flex min-h-[42px] items-center rounded-full px-7 text-base font-normal shadow-[inset_0_1px_12px_rgba(255,255,255,0.7)] ${
        dark
          ? 'border border-white/15 bg-white/5 text-white'
          : 'border border-[#c6dcf4] bg-[#f8fbff]/70 text-[#0a1735]'
      }`}
    >
      {children}
    </div>
  )
}

function PlatformCardVisual({ image, title }: { image: string; title: string }) {
  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-[radial-gradient(circle_at_35%_26%,#ffffff_0%,#fbfdff_42%,#e9f5ff_100%)] shadow-[inset_0_1px_18px_rgba(255,255,255,0.95),0_20px_42px_rgba(89,132,181,0.16)]">
      <Image
        src={image}
        alt=""
        width={160}
        height={160}
        sizes="96px"
        className="h-24 w-24 object-contain object-center mix-blend-multiply"
      />
      <span className="sr-only">{title}</span>
    </div>
  )
}

const avatarSets = [
  ['/home/avatar-1.png', '/home/avatar-2.png', '/home/avatar-3.png'],
  ['/home/avatar-4.png', '/home/avatar-5.png', '/home/avatar-6.png'],
]

function AvatarStack({ variant = 0 }: { variant?: 0 | 1 }) {
  return (
    <div className="flex -space-x-2">
      {avatarSets[variant].map((src) => (
        <Image
          key={src}
          src={src}
          alt=""
          width={96}
          height={96}
          sizes="24px"
          className="h-6 w-6 rounded-full border-2 border-white object-cover shadow-sm"
        />
      ))}
    </div>
  )
}

export default function HomePage() {
  const { data: session } = useSession()
  const { isBrand, switchView } = useViewMode()
  const { t } = useLanguage()
  const router = useRouter()
  const setRef = useSectionReveal()

  const home = t.home
  const heroStats = [
    { image: heroStatImages[0], title: home.hero.stat1Title, subtitle: home.hero.stat1Sub },
    { image: heroStatImages[1], title: home.hero.stat2Title, subtitle: home.hero.stat2Sub },
    { image: heroStatImages[2], title: home.hero.stat3Title, subtitle: home.hero.stat3Sub },
  ]
  const valueCards = [
    { image: valueCardImages[0], title: home.platform.card1Title, body: home.platform.card1Desc },
    { image: valueCardImages[1], title: home.platform.card2Title, body: home.platform.card2Desc },
    { image: valueCardImages[2], title: home.platform.card3Title, body: home.platform.card3Desc },
  ]
  const brandCards = [
    { image: brandCardImages[0], title: home.brandValue.card1Title, body: home.brandValue.card1Desc },
    { image: brandCardImages[1], title: home.brandValue.card2Title, body: home.brandValue.card2Desc },
    { image: brandCardImages[2], title: home.brandValue.card3Title, body: home.brandValue.card3Desc },
  ]
  const creatorCards = [
    { image: creatorCardImages[0], title: home.creatorValue.card1Title, body: home.creatorValue.card1Desc },
    { image: creatorCardImages[1], title: home.creatorValue.card2Title, body: home.creatorValue.card2Desc },
    { image: creatorCardImages[2], title: home.creatorValue.card3Title, body: home.creatorValue.card3Desc },
  ]
  const brandBullets = [
    home.brandValue.bullet1,
    home.brandValue.bullet2,
    home.brandValue.bullet3,
    home.brandValue.bullet4,
  ]
  const creatorBullets = [
    home.creatorValue.bullet1,
    home.creatorValue.bullet2,
    home.creatorValue.bullet3,
    home.creatorValue.bullet4,
    home.creatorValue.bullet5,
  ]
  const steps = [
    { image: stepImages[0], title: home.steps.step1Title, body: home.steps.step1Desc },
    { image: stepImages[1], title: home.steps.step2Title, body: home.steps.step2Desc },
    { image: stepImages[2], title: home.steps.step3Title, body: home.steps.step3Desc },
    { image: stepImages[3], title: home.steps.step4Title, body: home.steps.step4Desc },
  ]
  const platformFeatures = [
    { image: featureImages[0], title: home.features.feature1Title, body: home.features.feature1Desc },
    { image: featureImages[1], title: home.features.feature2Title, body: home.features.feature2Desc },
    { image: featureImages[2], title: home.features.feature3Title, body: home.features.feature3Desc },
    { image: featureImages[3], title: home.features.feature4Title, body: home.features.feature4Desc },
  ]
  const earlyAccess = [
    { image: earlyAccessImages[0], title: home.earlyAccess.card1Title, body: home.earlyAccess.card1Desc },
    { image: earlyAccessImages[1], title: home.earlyAccess.card2Title, body: home.earlyAccess.card2Desc },
    { image: earlyAccessImages[2], title: home.earlyAccess.card3Title, body: home.earlyAccess.card3Desc },
  ]

  useEffect(() => {
    document.documentElement.classList.add('hp-snap')
    return () => {
      document.documentElement.classList.remove('hp-snap')
    }
  }, [])

  const enterAudience = async (audience: Audience) => {
    const targetMode = audience === 'brand' ? 'BRAND' : 'INFLUENCER'
    const targetDashboard = audience === 'brand' ? '/dashboard/brand' : '/dashboard/influencer'

    if (!session) {
      router.push(`/auth/signup?type=${audience === 'brand' ? 'brand' : 'influencer'}`)
      return
    }

    if ((targetMode === 'BRAND') !== isBrand) {
      await switchView(targetMode)
      return
    }

    router.push(targetDashboard)
  }

  return (
    <div className="overflow-hidden bg-[#f4f9ff] font-normal text-[#071735]">
      <section className="relative min-h-screen-safe snap-start overflow-hidden bg-[#edf6ff] px-4 py-8 sm:px-6 lg:px-8">
        <Image
          src="/home/hero-bridge.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,250,245,0.72)_0%,rgba(255,250,245,0.42)_32%,rgba(244,249,255,0)_70%)]" />

        <div className="relative z-10 mx-auto flex min-h-hero-safe w-full max-w-[1440px] flex-col justify-between rounded-[30px] px-2 py-4 sm:px-8 lg:px-12">
          <div className="max-w-3xl pt-12 lg:pt-16">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#d4e1ef] bg-[#f9fbff]/75 px-6 py-3 text-base font-normal text-[#0b3a7c] shadow-[inset_0_1px_8px_rgba(255,255,255,0.9),0_12px_28px_rgba(88,126,171,0.12)] backdrop-blur-md">
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <Image
                  src="/home/hero-icon-spark.png"
                  alt=""
                  width={24}
                  height={24}
                  sizes="20px"
                  className="h-5 w-5 object-contain"
                />
              </span>
              {home.hero.badge}
            </div>

            <h1 className="max-w-3xl text-[clamp(3rem,5.2vw,4.9rem)] font-light leading-[1.08] text-[#082052]">
              <span className="sm:block">{home.hero.title1} </span>
              <span className="sm:block">{home.hero.title2} </span>
              {home.hero.title3 && <span className="sm:block">{home.hero.title3}</span>}
            </h1>

            <p className="mt-7 max-w-sm text-xl leading-9 text-[#35547a]">
              {home.hero.description}
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <ButtonShell tone="blue" onClick={() => enterAudience('creator')}>
                {home.hero.getStarted}
                <ArrowUpRight />
              </ButtonShell>
              <ButtonShell href="/contact">
                {home.hero.requestDemo}
                <ArrowUpRight />
              </ButtonShell>
            </div>
          </div>

          <div className="mt-12 grid max-w-[560px] grid-cols-1 gap-5 sm:grid-cols-3 lg:mt-16">
            {heroStats.map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-white/80 bg-[#f8fbff]/75 p-6 text-center shadow-[inset_0_1px_12px_rgba(255,255,255,0.95),0_14px_30px_rgba(78,123,174,0.16)] backdrop-blur-md transition duration-300 hover:scale-[1.04]"
              >
                <Image
                  src={item.image}
                  alt=""
                  width={64}
                  height={64}
                  sizes="56px"
                  className="mx-auto mb-5 h-14 w-14 object-contain"
                />
                <p className="text-base font-normal leading-7 text-[#0d244c]">{item.title}</p>
                {item.subtitle && <p className="text-base font-normal leading-7 text-[#0d244c]">{item.subtitle}</p>}
              </div>
            ))}
          </div>

          <div className="home-hero-products pointer-events-none absolute bottom-10 right-6 w-[520px] xl:right-12">
            <div className="absolute bottom-[88px] right-0 w-[200px] origin-bottom rotate-[7deg] overflow-hidden rounded-[24px] border border-white/70 bg-[#eef6ff]/75 shadow-[0_22px_48px_rgba(33,69,111,0.25)] backdrop-blur-md">
              <div className="relative h-44">
                <Image src="/home/product-headphones.png" alt="" fill sizes="200px" className="object-cover object-center" />
              </div>
              <div className="px-4 pb-4 pt-3">
                <p className="text-base font-normal leading-snug text-[#0d244c]">{home.hero.product1Name}</p>
                <p className="mt-1 text-sm text-[#557199]">{home.hero.product1Category}</p>
                <div className="mt-3 flex items-center gap-2 text-sm text-[#557199]">
                  <AvatarStack />
                  <span>{home.hero.product1Creators}</span>
                </div>
              </div>
              <ArrowUpRight className="absolute right-4 top-4 h-6 w-6 text-white" />
            </div>

            <div className="absolute bottom-0 right-[192px] z-10 w-[300px] overflow-hidden rounded-[22px] border border-white/80 bg-[#eef6ff]/80 shadow-[0_22px_48px_rgba(33,69,111,0.22)] backdrop-blur-md">
              <div className="relative h-52">
                <Image src="/home/product-serum.png" alt="" fill sizes="300px" className="object-cover object-center" />
              </div>
              <div className="px-5 pb-4 pt-3">
                <p className="text-base font-normal text-[#0d244c]">{home.hero.product2Name}</p>
                <p className="text-sm text-[#557199]">{home.hero.product2Category}</p>
                <div className="mt-3 flex items-center gap-3 text-sm text-[#557199]">
                  <AvatarStack variant={1} />
                  <span>{home.hero.product2Creators}</span>
                </div>
              </div>
              <ArrowUpRight className="absolute right-4 top-4 h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </section>

      <section ref={setRef(0)} className="hp-section relative flex min-h-screen-safe snap-start items-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#eaf3ff_0%,#f4f9ff_55%,#ffffff_100%)]" />
        <div className="relative mx-auto w-full max-w-7xl text-center">
          <SectionLabel>{home.platform.label}</SectionLabel>
          <h2 className="mx-auto max-w-5xl text-[clamp(2.4rem,3.6vw,4.2rem)] font-light leading-[1.1] text-[#08132d]">
            {home.platform.title}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-[#5c6e8d]">
            {home.platform.description}
          </p>

          <div className="mt-10 grid gap-6 text-left md:grid-cols-3">
            {valueCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[30px] border border-[#dbe9f8] bg-[#f8fbff]/75 px-8 pb-8 pt-7 shadow-[inset_0_1px_16px_rgba(255,255,255,0.95),0_18px_46px_rgba(85,126,174,0.12)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:scale-[1.02]"
              >
                <PlatformCardVisual image={card.image} title={card.title} />
                <h3 className="mt-6 text-2xl font-normal leading-tight text-[#071735]">{card.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#5b6d8c]">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <ButtonShell href="/browse">
              {home.platform.learnMore}
              <ArrowUpRight />
            </ButtonShell>
          </div>
        </div>
      </section>

      <section ref={setRef(1)} className="hp-section flex min-h-screen-safe snap-start items-center bg-black px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1360px]">
          <div className="text-center">
            <SectionLabel dark>{home.choosePath.label}</SectionLabel>
            <h2 className="text-[clamp(2.4rem,3.6vw,4.2rem)] font-light leading-tight text-white">
              {home.choosePath.title}
            </h2>
          </div>

          <div className="mt-8 space-y-3">
            <PathCard
              audience="brand"
              image="/home/path-brand.png"
              title={home.choosePath.brandTitle}
              body={home.choosePath.brandBody}
              cta={home.choosePath.brandCta}
              onClick={() => enterAudience('brand')}
            />
            <PathCard
              audience="creator"
              image="/home/path-creator.png"
              title={home.choosePath.creatorTitle}
              body={home.choosePath.creatorBody}
              cta={home.choosePath.creatorCta}
              onClick={() => enterAudience('creator')}
            />
          </div>
        </div>
      </section>

      <DarkAudienceSection
        sectionRef={setRef(2)}
        label={home.brandValue.label}
        icon="store"
        title={
          <>
            {home.brandValue.title1}
            <br className="hidden sm:block" />
            {home.brandValue.title2}
          </>
        }
        body={home.brandValue.description}
        bullets={brandBullets}
        cards={brandCards}
        primaryCta={home.brandValue.ctaPrimary}
        secondaryCta={home.brandValue.ctaSecondary}
        onPrimary={() => enterAudience('brand')}
        secondaryHref="/brand"
      />

      <DarkAudienceSection
        sectionRef={setRef(3)}
        label={home.creatorValue.label}
        icon="standout"
        title={
          <>
            {home.creatorValue.title1}
            <br className="hidden sm:block" />
            {home.creatorValue.title2}
          </>
        }
        body={home.creatorValue.description}
        bullets={creatorBullets}
        cards={creatorCards}
        primaryCta={home.creatorValue.ctaPrimary}
        secondaryCta={home.creatorValue.ctaSecondary}
        onPrimary={() => enterAudience('creator')}
        secondaryHref="/browse"
      />

      <StepsSection
        sectionRef={setRef(4)}
        label={home.steps.label}
        title={home.steps.title}
        steps={steps}
      />

      <section ref={setRef(5)} className="hp-section relative flex min-h-screen-safe snap-start items-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#eaf3ff_0%,#f4f9ff_55%,#ffffff_100%)]" />
        <div className="relative mx-auto w-full max-w-5xl text-center">
          <SectionLabel>{home.features.label}</SectionLabel>
          <h2 className="text-[clamp(2.4rem,3.6vw,4.2rem)] font-light leading-tight text-[#1d2638]">
            {home.features.title}
          </h2>

          <div className="mt-8 grid gap-6 text-left md:grid-cols-2">
            {platformFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[26px] border border-[#d9e7f8] bg-[#fbfdff]/80 p-6 shadow-[inset_0_1px_16px_rgba(255,255,255,0.95),0_18px_42px_rgba(82,128,181,0.1)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:scale-[1.02]"
              >
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[#d6e6f8] bg-[#f8fbff]/80 shadow-[inset_0_1px_18px_rgba(255,255,255,0.9),0_14px_34px_rgba(87,136,190,0.14)]">
                  <Image
                    src={feature.image}
                    alt=""
                    width={116}
                    height={116}
                    sizes="64px"
                    className="h-16 w-16 object-contain mix-blend-multiply"
                  />
                </div>
                <h3 className="mt-4 text-xl font-normal text-[#071735]">{feature.title}</h3>
                <p className="mt-2 text-base leading-7 text-[#4f5f77]">{feature.body}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-4xl text-base leading-7 text-[#4f5f77]">
            {home.features.moreFeatures}
          </p>
        </div>
      </section>

      <section ref={setRef(6)} className="hp-section relative flex min-h-screen-safe snap-start items-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0">
          <Image src="/home/soft-blue-bg.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="relative mx-auto w-full max-w-[1220px] text-center">
          <SectionLabel>{home.earlyAccess.label}</SectionLabel>
          <h2 className="text-[clamp(2.4rem,3.6vw,4.2rem)] font-light leading-tight text-[#08132d]">
            {home.earlyAccess.title}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-[#445c83]">
            {home.earlyAccess.description}
          </p>

          <div className="mt-8 grid items-stretch gap-6 text-left lg:grid-cols-[1fr_1fr_1fr_1.55fr]">
            {earlyAccess.map((item) => (
              <div
                key={item.title}
                className="rounded-[26px] border border-[#dceafb] bg-[#fbfdff]/75 p-6 shadow-[inset_0_1px_16px_rgba(255,255,255,0.95),0_18px_42px_rgba(82,128,181,0.11)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:scale-[1.03]"
              >
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[#d6e6f8] bg-[#f8fbff]/80 shadow-[inset_0_1px_18px_rgba(255,255,255,0.9),0_14px_34px_rgba(87,136,190,0.14)]">
                  <Image
                    src={item.image}
                    alt=""
                    width={110}
                    height={110}
                    sizes="64px"
                    className="h-16 w-16 object-contain mix-blend-multiply"
                  />
                </div>
                <h3 className="mt-5 text-lg font-normal leading-tight text-[#071735]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#536785]">{item.body}</p>
              </div>
            ))}

            <div className="rounded-[28px] border border-[#d2e3f7] bg-[#f3f9ff]/75 p-6 shadow-[inset_0_1px_18px_rgba(255,255,255,0.95),0_20px_46px_rgba(82,128,181,0.16)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:scale-[1.02]">
              <p className="text-center text-base font-normal text-[#1a315b]">{home.earlyAccess.betaLabel}</p>
              <div className="mx-auto mt-5 h-24 w-24 overflow-hidden rounded-full shadow-[0_18px_38px_rgba(69,119,180,0.16)]">
                <Image
                  src="/home/ea-beta.png"
                  alt=""
                  width={136}
                  height={136}
                  sizes="96px"
                  className="h-24 w-24 object-cover"
                />
              </div>
              <div className="mt-5 space-y-3">
                {[home.earlyAccess.betaItem1, home.earlyAccess.betaItem2, home.earlyAccess.betaItem3].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-base text-[#1f3152]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#7fb0ff] text-[#477ee8]">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <ButtonShell onClick={() => enterAudience('creator')}>
              {home.earlyAccess.ctaSignup}
              <ArrowUpRight />
            </ButtonShell>
          </div>
        </div>
      </section>

      <section ref={setRef(7)} className="hp-section flex min-h-screen-safe snap-start bg-[#061326] text-white">
        <div className="relative flex min-h-screen-safe w-full flex-col justify-between overflow-hidden bg-[#071528] px-6 py-10 sm:px-12 lg:px-16">
          <Image
            src="/background_2.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,18,0.4)_0%,rgba(5,12,24,0.16)_55%,rgba(3,8,18,0.5)_100%)]" />

          <div className="relative z-10 mx-auto flex flex-1 max-w-4xl flex-col items-center justify-center text-center">
            <h2 className="mx-auto max-w-2xl text-[clamp(2.4rem,3.6vw,4.2rem)] font-light leading-[1.13]">
              {home.finalCta.title}
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/80">
              {home.finalCta.description}
            </p>
            <div className="mt-8">
              <ButtonShell tone="blue" onClick={() => enterAudience('creator')}>
                {home.finalCta.cta}
                <ArrowUpRight />
              </ButtonShell>
            </div>
          </div>

          <div className="relative z-10 border-t border-white/25 pt-8 text-sm text-white/80">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <p>{t.footer.copyright}</p>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <Link href="/" className="hover:text-white">{t.footer.home}</Link>
                <Link href="/browse" className="hover:text-white">{t.footer.browse}</Link>
                <Link href="/faq" className="hover:text-white">{t.footer.aboutUs}</Link>
                <Link href="/terms" className="hover:text-white">{t.footer.terms}</Link>
                <Link href="/privacy" className="hover:text-white">{t.footer.privacy}</Link>
                <Link href="/contact" className="hover:text-white">{t.footer.contact}</Link>
              </div>
              <p>overseed.net</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function StepsSection({
  sectionRef,
  label,
  title,
  steps,
}: {
  sectionRef: (el: HTMLElement | null) => void
  label: string
  title: string
  steps: { image: string; title: string; body: string }[]
}) {
  // The step the interaction is currently emphasizing. Hover drives it on desktop;
  // on touch/mobile the card scrolling into view drives it via IntersectionObserver.
  const [activeStep, setActiveStep] = useState(0)
  const [hovering, setHovering] = useState(false)
  const cardRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    // Skip the scroll-driven behavior on hover-capable (desktop) pointers —
    // there, hover is the source of truth and this would fight it.
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.indexOf(entry.target as HTMLElement)
            if (idx !== -1) setActiveStep(idx)
          }
        })
      },
      { threshold: 0.6 }
    )
    cardRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="hp-section relative flex min-h-screen-safe snap-start items-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#f0f8ff_100%)]" />
      <div className="relative mx-auto w-full max-w-[1320px] text-center">
        <SectionLabel>{label}</SectionLabel>
        <h2 className="mx-auto max-w-5xl text-[clamp(2.4rem,3.6vw,4.2rem)] font-light leading-[1.12] text-[#1d2638]">
          {title}
        </h2>

        <div className="relative mt-10 grid gap-6 text-left md:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-24 hidden h-px bg-[#dcecfb] md:block" />
          {/* Connector progress: fills left-to-right up to the active step. */}
          <div
            className="absolute left-[12%] top-24 hidden h-px bg-[#5f8fc6] transition-all duration-500 ease-out md:block"
            style={{ width: `${(activeStep / (steps.length - 1)) * 76}%` }}
          />
          {steps.map((step, index) => {
            const isActive = index === activeStep
            const dim = hovering && !isActive
            return (
              <div
                key={step.title}
                ref={(el) => {
                  cardRefs.current[index] = el
                }}
                onMouseEnter={() => {
                  setHovering(true)
                  setActiveStep(index)
                }}
                onMouseLeave={() => setHovering(false)}
                className={`relative rounded-[26px] border bg-[#fbfdff]/80 p-6 pt-5 backdrop-blur-md transition-all duration-300 ease-out ${
                  isActive
                    ? '-translate-y-1.5 scale-[1.03] border-[#bcd6f5] shadow-[inset_0_1px_16px_rgba(255,255,255,0.95),0_26px_54px_rgba(64,110,170,0.28)]'
                    : 'border-[#dbe8f8] shadow-[inset_0_1px_16px_rgba(255,255,255,0.95),0_18px_42px_rgba(82,128,181,0.1)]'
                } ${dim ? 'opacity-70' : 'opacity-100'}`}
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full text-lg font-normal transition-colors duration-300 ${
                    isActive ? 'bg-[#5f8fc6] text-white' : 'bg-[#edf3fb] text-[#1d2638]'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="mx-auto mb-4 flex justify-center">
                  <div
                    className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-[#f8fbff]/80 transition-all duration-300 ${
                      isActive
                        ? 'border-[#bcd6f5] shadow-[inset_0_1px_18px_rgba(255,255,255,0.95),0_16px_36px_rgba(78,123,190,0.3)]'
                        : 'border-[#d6e6f8] shadow-[inset_0_1px_18px_rgba(255,255,255,0.9),0_14px_34px_rgba(87,136,190,0.14)]'
                    }`}
                  >
                    <Image
                      src={step.image}
                      alt=""
                      width={124}
                      height={124}
                      sizes="80px"
                      className="h-20 w-20 object-contain mix-blend-multiply"
                    />
                  </div>
                </div>
                <h3 className="text-xl font-normal text-[#1d2638]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#4e5d73]">{step.body}</p>
              </div>
            )
          })}
        </div>

        {/* Progress indicator — one segment per step; the active step fills in blue. */}
        <div className="mt-12 flex items-center justify-center gap-3">
          {steps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              aria-label={step.title}
              onMouseEnter={() => {
                setHovering(true)
                setActiveStep(index)
              }}
              onMouseLeave={() => setHovering(false)}
              onFocus={() => setActiveStep(index)}
              className="h-1.5 overflow-hidden rounded-full bg-[#d7e6f7] transition-all duration-500 ease-out"
              style={{ width: index === activeStep ? '3rem' : '2rem' }}
            >
              <span
                className="block h-full rounded-full bg-[#5f8fc6] transition-all duration-500 ease-out"
                style={{ width: index === activeStep ? '100%' : '0%' }}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function PathCard({
  audience,
  image,
  title,
  body,
  cta,
  onClick,
}: {
  audience: Audience
  image: string
  title: string
  body: string
  cta: string
  onClick: () => void
}) {
  return (
    <div className="group relative min-h-[250px] overflow-hidden rounded-[18px] border border-white/15 bg-[#111] shadow-[0_22px_48px_rgba(0,0,0,0.35)]">
      <Image
        src={image}
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 1320px"
        className={`object-cover transition duration-700 group-hover:scale-[1.03] ${
          audience === 'creator' ? 'object-center' : 'object-center'
        }`}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.64)_30%,rgba(0,0,0,0.1)_100%)]" />
      <div className="relative z-10 flex min-h-[250px] flex-col justify-center px-8 py-8 sm:px-12">
        <h3 className="text-[clamp(2.8rem,5vw,4.5rem)] font-light leading-none text-white">{title}</h3>
        <p className="mt-4 max-w-md text-base leading-7 text-white/80">{body}</p>
        <button
          onClick={onClick}
          type="button"
          className="mt-6 inline-flex min-h-[52px] w-fit items-center gap-6 rounded-full border border-white/40 bg-white/5 px-8 text-base font-normal text-white shadow-[inset_0_1px_10px_rgba(255,255,255,0.14)] transition hover:bg-white/10"
        >
          {cta}
          <ArrowUpRight className="h-8 w-8" />
        </button>
      </div>
    </div>
  )
}

function DarkAudienceSection({
  sectionRef,
  label,
  icon,
  title,
  body,
  bullets,
  cards,
  primaryCta,
  secondaryCta,
  onPrimary,
  secondaryHref,
}: {
  sectionRef: (el: HTMLElement | null) => void
  label: string
  icon: string
  title: React.ReactNode
  body: string
  bullets: string[]
  cards: { image: string; title: string; body: string }[]
  primaryCta: string
  secondaryCta: string
  onPrimary: () => void
  secondaryHref: string
}) {
  const { t } = useLanguage()
  return (
    <section ref={sectionRef} className="hp-section flex min-h-screen-safe snap-start items-center bg-black px-4 py-8 text-white sm:px-6 lg:px-12">
      <div className="mx-auto w-full max-w-[1360px]">
        <div className="text-center">
          <div className="mb-4 inline-flex min-h-[40px] items-center gap-3 rounded-full border border-white/15 bg-white/5 px-6 text-base text-white shadow-[inset_0_1px_12px_rgba(255,255,255,0.1)]">
            <LineIcon name={icon} className="h-5 w-5" />
            {label}
          </div>
          <h2 className="mx-auto text-[clamp(2.2rem,3.4vw,4.2rem)] font-light leading-[1.12] text-white">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/60">{body}</p>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-sm text-white/80">{t.home.whatYouCanDo}</p>
          <div className="flex flex-wrap gap-3 lg:flex-nowrap">
            {bullets.map((bullet) => (
              <div
                key={bullet}
                className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-[13px] leading-snug text-white/80 lg:flex-1"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/60">
                  <CheckIcon className="h-3 w-3" />
                </span>
                {bullet}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid items-center gap-4 md:grid-cols-3 lg:px-4">
          {cards.map((card, index) => (
            <div
              key={card.title}
              className={`rounded-[28px] border border-white/20 bg-white/[0.04] p-7 shadow-[inset_0_1px_18px_rgba(255,255,255,0.08),0_20px_46px_rgba(0,0,0,0.32)] backdrop-blur-sm transition duration-300 hover:border-white/40 ${
                index === 0
                  ? 'md:-rotate-3 hover:scale-105'
                  : index === 2
                    ? 'md:rotate-3 hover:scale-105'
                    : 'z-10 hover:scale-[1.08] md:-translate-y-4 md:scale-[1.04] md:p-8'
              }`}
            >
              <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 shadow-[inset_0_1px_12px_rgba(255,255,255,0.1)]">
                <Image
                  src={card.image}
                  alt=""
                  width={96}
                  height={96}
                  sizes="64px"
                  className="h-16 w-16 object-cover"
                />
              </div>
              <h3 className="mt-5 text-2xl font-light text-white">{card.title}</h3>
              <p className="mt-3 text-base leading-7 text-white/60">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
          <ButtonShell tone="light" onClick={onPrimary}>
            {primaryCta}
            <ArrowRight />
          </ButtonShell>
          <ButtonShell tone="dark" href={secondaryHref}>
            {secondaryCta}
            <ArrowRight />
          </ButtonShell>
        </div>
      </div>
    </section>
  )
}
