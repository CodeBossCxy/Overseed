'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useViewMode } from '@/lib/hooks/useViewMode'
import { useTheme } from './ThemeProvider'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

interface DropdownItem {
  label: string
  href: string
}

function HeaderArrowIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 17 17 7M9 7h8v8" />
    </svg>
  )
}

function LandingLogo() {
  return (
    <span className="flex items-center" aria-label="Overseed">
      <Image
        src="/home/landing-logo-overseed.png"
        alt="Overseed"
        width={381}
        height={98}
        priority
        sizes="(max-width: 640px) 180px, 220px"
        className="h-12 w-auto object-contain sm:h-14"
      />
    </span>
  )
}

function NavDropdown({ label, items, isGlobal, isLanding }: { label: string; items: DropdownItem[]; isGlobal?: boolean; isLanding?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // The landing page renders in the dark "global" theme but on a light hero,
  // so it needs the dark-text treatment rather than the global light-text one.
  const buttonClass = isLanding
    ? 'text-base text-[#071735] hover:text-[#2c6fb2]'
    : isGlobal
      ? 'text-sm text-gray-200 hover:text-[#ff769f]'
      : 'text-sm text-gray-700 hover:text-primary-600'
  const useLightPanel = isLanding || !isGlobal

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 transition font-normal ${buttonClass}`}
      >
        {label}
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-2 w-48 rounded-lg shadow-lg py-1 z-50 ${useLightPanel ? 'bg-white border border-gray-100' : 'backdrop-blur-xl'}`}
          style={useLightPanel ? undefined : { backgroundColor: 'rgba(10, 21, 39, 0.95)', border: '1px solid rgba(212, 224, 253, 0.1)' }}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 text-sm font-light transition ${useLightPanel ? 'text-gray-700 hover:bg-primary-50 hover:text-primary-600' : 'hover:bg-white/10'}`}
              style={useLightPanel ? undefined : { color: 'rgba(255,255,255,0.85)' }}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

function LanguageDropdown({
  locale,
  setLocale,
  isGlobal,
  isLanding,
  title,
}: {
  locale: string
  setLocale: (l: 'en' | 'zh') => void
  isGlobal?: boolean
  isLanding?: boolean
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const current = locale === 'en' ? 'EN' : '中文'
  const options: { value: 'en' | 'zh'; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '简体中文' },
  ]

  const triggerClass = isLanding
    ? 'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#d4e1ef] bg-[#f9fbff]/75 px-4 text-sm font-normal text-[#082052] shadow-[inset_0_1px_8px_rgba(255,255,255,0.9),0_12px_28px_rgba(88,126,171,0.12)] backdrop-blur-md transition hover:bg-white'
    : isGlobal
      ? 'inline-flex items-center gap-1.5 p-2 rounded-md text-gray-200 hover:text-[#ff769f] hover:bg-[#456fa3]/15 transition'
      : 'inline-flex items-center gap-1.5 p-2 rounded-md text-gray-600 hover:text-primary-600 hover:bg-gray-100 transition'

  const useLightPanel = isLanding || !isGlobal

  return (
    <div ref={ref} className="relative mr-2 sm:mr-3">
      <button onClick={() => setOpen(!open)} className={triggerClass} title={title}>
        <GlobeIcon className={isLanding ? 'h-4 w-4 text-[#0b3a7c]' : 'w-5 h-5'} />
        <span className={locale === 'zh' ? 'font-cn' : undefined}>{current}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute top-full right-0 mt-2 w-36 rounded-lg shadow-lg py-1 z-50 ${useLightPanel ? 'bg-white border border-gray-100' : 'backdrop-blur-xl'}`}
          style={useLightPanel ? undefined : { backgroundColor: 'rgba(10, 21, 39, 0.95)', border: '1px solid rgba(212, 224, 253, 0.1)' }}
        >
          {options.map((opt) => {
            const active = locale === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => { setLocale(opt.value); setOpen(false) }}
                className={`flex w-full items-center justify-between px-4 py-2 text-sm transition ${opt.value === 'zh' ? 'font-cn' : ''} ${
                  useLightPanel
                    ? `${active ? 'text-primary-600 font-medium' : 'text-gray-700'} hover:bg-primary-50`
                    : `${active ? 'text-[#ff769f]' : ''} hover:bg-white/10`
                }`}
                style={useLightPanel || active ? undefined : { color: 'rgba(255,255,255,0.85)' }}
              >
                {opt.label}
                {active && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MessageBadge({ isGlobal }: { isGlobal?: boolean }) {
  const [unread, setUnread] = useState(0)
  const { data: session } = useSession()
  const { t } = useLanguage()
  const badgeUserId = (session?.user as any)?.id

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/messages/unread')
        if (res.ok) {
          const data = await res.json()
          setUnread(data.totalUnread)
        }
      } catch {}
    }
    fetchUnread()

    // Use Pusher for real-time badge updates. Only open a connection when we
    // actually have a user to subscribe for — otherwise the polling fallback
    // below is enough and we avoid needless WebSocket connections.
    let cleanup: (() => void) | undefined
    if (badgeUserId) {
      import('@/lib/pusher-client').then(({ getPusherClient }) => {
        const pusher = getPusherClient()
        if (pusher) {
          const channel = pusher.subscribe(`user-${badgeUserId}`)
          channel.bind('conversation-updated', () => {
            fetchUnread()
          })
          cleanup = () => {
            channel.unbind_all()
            pusher.unsubscribe(`user-${badgeUserId}`)
          }
        }
      })
    }

    // Fallback polling
    const interval = setInterval(fetchUnread, 30000)
    return () => {
      clearInterval(interval)
      cleanup?.()
    }
  }, [badgeUserId])

  return (
    <Link
      href="/dashboard/messages"
      className={`relative p-2 rounded-md transition ${isGlobal ? 'text-gray-200 hover:text-[#ff769f] hover:bg-[#456fa3]/15' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'}`}
      title={t.messages?.title}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}

export default function Header() {
  const { data: session } = useSession()
  const { locale, setLocale, t } = useLanguage()
  const { isBrand, switchView, isSwitching } = useViewMode()
  const { themeMode } = useTheme()
  const pathname = usePathname()
  const isHomePage = pathname === '/' || pathname === '/contact'
  const isLandingPage = pathname === '/'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null)

  const dashboardLink = isBrand ? '/dashboard/brand' : '/dashboard/influencer'

  const navMenus = [
    {
      key: 'campaigns',
      label: t.nav.campaigns,
      items: [
        { label: t.nav.campaignBoard, href: '/browse' },
        ...(isBrand ? [{ label: t.nav.findInfluencer, href: '/dashboard/brand/discover' }] : []),
        { label: t.nav.featuredCampaigns, href: '/browse?sort=featured' },
      ],
    },
    {
      key: 'pricing',
      label: t.nav.pricing,
      items: [
        { label: t.nav.brandPricing, href: '/pricing/brand' },
        { label: t.nav.creatorPricing, href: '/pricing/creator' },
      ],
    },
    {
      key: 'contact',
      label: t.nav.contact,
      items: [
        { label: t.nav.contactUs, href: '/contact' },
        { label: t.nav.businessEnquiry, href: '/contact/business' },
        { label: t.nav.creatorCommunity, href: '/community/creator' },
        { label: t.nav.brandCommunity, href: '/community/brand' },
      ],
    },
    {
      key: 'globalization',
      label: t.nav.brandAiAssistant,
      href: '/ai-assistant',
      items: [],
    },
  ]

  const isGlobal = themeMode === 'global'
  const landingNavMenus = [
    {
      key: 'brand',
      label: t.nav.forBrands,
      items: [
        { label: t.nav.postCampaign, href: '/auth/signup?type=brand' },
        { label: t.nav.howItWorks, href: '/brand#how-it-works' },
        { label: t.nav.brandFaq, href: '/brand#faq' },
      ],
    },
    {
      key: 'creator',
      label: t.nav.forCreators,
      items: [
        { label: t.nav.browseCampaigns, href: '/browse' },
        { label: t.nav.howItWorks, href: '/creator#how-it-works' },
        { label: t.nav.creatorFaq, href: '/creator#faq' },
      ],
    },
    { key: 'ai', label: t.nav.ai, href: '/ai-assistant', items: [] },
  ]
  const visibleNavMenus = isLandingPage ? landingNavMenus : navMenus

  return (
    <header
      className={`z-50 pt-[env(safe-area-inset-top)] ${
        isLandingPage
          ? 'absolute left-0 right-0 top-0 bg-transparent'
          : isGlobal
            ? 'sticky top-0 bg-[#0a1527]/20 backdrop-blur-md'
            : 'sticky top-0 bg-white shadow-sm'
      }`}
    >
      <div className={`${isLandingPage ? 'max-w-[1440px]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className={`relative flex justify-between items-center ${isLandingPage ? 'h-24' : 'h-16'}`}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {isLandingPage ? (
              <LandingLogo />
            ) : isGlobal ? (
              <img src="/gray_logo_with_txt.png" alt="Overseed" className="h-28 -my-4 translate-y-[2px] w-auto object-contain brightness-200" />
            ) : (
              <img src={themeMode === 'brand' ? "/blue_overseed.png" : "/pink_overseed.png"} alt="Overseed" className="h-28 -my-4 translate-y-[2px] w-auto object-contain" />
            )}
            {!isLandingPage && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-400 text-amber-900 rounded uppercase">{t.nav.beta}</span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className={`hidden lg:flex items-center ${isLandingPage ? 'space-x-12 lg:absolute lg:left-1/2 lg:-translate-x-1/2' : 'space-x-6'}`}>
            {visibleNavMenus.map((menu) => (
              menu.href ? (
                <Link
                  key={menu.key}
                  href={menu.href}
                  className={`transition font-normal ${
                    isLandingPage
                      ? 'text-base text-[#071735] hover:text-[#2c6fb2]'
                      : isGlobal
                        ? 'text-sm text-gray-200 hover:text-[#ff769f]'
                        : 'text-sm text-gray-700 hover:text-primary-600'
                  }`}
                >
                  {menu.label}
                </Link>
              ) : (
                <NavDropdown key={menu.key} label={menu.label} items={menu.items} isGlobal={isGlobal} isLanding={isLandingPage} />
              )
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {/* Language Switcher */}
            <LanguageDropdown
              locale={locale}
              setLocale={setLocale}
              isGlobal={isGlobal}
              isLanding={isLandingPage}
              title={t.nav.switchLanguage}
            />

            {/* Auth buttons */}
            {session ? (
              <div className="hidden lg:flex items-center gap-1">
                {/* View Switcher — hidden on home page (has its own toggle) */}
                {!isHomePage && (
                  <button
                    onClick={() => switchView()}
                    disabled={isSwitching}
                    className={`p-2 rounded-md transition disabled:opacity-50 ${isGlobal ? 'text-[#ff769f] hover:bg-[#ff769f]/10' : 'text-primary-600 hover:bg-primary-50'}`}
                    title={isSwitching ? t.nav.switching : isBrand ? t.nav.switchToCreator : t.nav.switchToBrand}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>
                )}
                <MessageBadge isGlobal={isGlobal} />
                <Link
                  href={dashboardLink}
                  className={`p-2 rounded-md transition ${isGlobal ? 'text-gray-200 hover:text-[#ff769f] hover:bg-[#456fa3]/15' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'}`}
                  title={t.nav.myCenter}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
                {(session.user as any)?.userType === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className={`p-2 rounded-md transition ${isGlobal ? 'text-gray-200 hover:text-[#ff769f] hover:bg-[#456fa3]/15' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'}`}
                    title={t.nav.admin}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </Link>
                )}
                <Link
                  href="/settings"
                  className={`p-2 rounded-md transition ${isGlobal ? 'text-gray-200 hover:text-[#ff769f] hover:bg-[#456fa3]/15' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'}`}
                  title={t.nav.settings}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
                <button
                  onClick={() => signOut()}
                  className={`p-2 rounded-md transition ${isGlobal ? 'text-gray-200 hover:text-[#ff769f] hover:bg-[#456fa3]/15' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'}`}
                  title={t.nav.logout}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="hidden lg:flex items-center space-x-2">
                {!isLandingPage && (
                  <Link
                    href="/auth/signin"
                    className={`px-4 py-2 rounded-md transition text-sm ${isGlobal ? 'text-gray-200 hover:bg-[#456fa3]/15' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {t.nav.login}
                  </Link>
                )}
                <Link
                  href="/auth/signup"
                  className={
                    isLandingPage
                      ? 'inline-flex min-h-[56px] items-center gap-4 rounded-full border border-white/80 bg-[#f8fbff]/75 px-8 text-base font-normal text-[#082052] shadow-[inset_0_1px_12px_rgba(255,255,255,0.95),0_14px_30px_rgba(81,124,174,0.16)] transition hover:bg-white'
                      : 'px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 transition text-sm'
                  }
                >
                  {t.nav.signup}
                  {isLandingPage && <HeaderArrowIcon />}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden p-2 rounded-md ${
                isLandingPage
                  ? 'text-[#071735] hover:bg-[#dcecff]/70'
                  : isGlobal
                    ? 'hover:bg-[#456fa3]/15 text-gray-200'
                    : 'hover:bg-gray-100'
              }`}
              aria-label={t.nav.toggleMenu}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={`lg:hidden py-4 border-t ${isLandingPage ? 'border-[#c7dcef]' : isGlobal ? 'border-[#d4e0fd]/10' : ''}`}>
            <nav className="flex flex-col space-y-1">
              {visibleNavMenus.map((menu) => (
                menu.href ? (
                  <Link
                    key={menu.key}
                    href={menu.href}
                    className={`block py-2 transition font-normal ${
                      isLandingPage
                        ? 'text-[#071735] hover:text-[#2c6fb2]'
                        : isGlobal
                          ? 'text-gray-200 hover:text-[#ff769f]'
                          : 'text-gray-700 hover:text-primary-600'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {menu.label}
                  </Link>
                ) : (
                  <div key={menu.key}>
                    <button
                      onClick={() => setMobileExpanded(mobileExpanded === menu.key ? null : menu.key)}
                      className={`flex items-center justify-between w-full py-2 transition font-normal ${
                        isLandingPage
                          ? 'text-[#071735] hover:text-[#2c6fb2]'
                          : isGlobal
                            ? 'text-gray-200 hover:text-[#ff769f]'
                            : 'text-gray-700 hover:text-primary-600'
                      }`}
                    >
                      {menu.label}
                      <svg className={`w-4 h-4 transition-transform ${mobileExpanded === menu.key ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {mobileExpanded === menu.key && (
                      <div className="pl-4 space-y-1">
                        {menu.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`block py-2 text-sm transition ${
                              isLandingPage
                                ? 'text-[#35547a] hover:text-[#2c6fb2]'
                                : isGlobal
                                  ? 'text-gray-400 hover:text-[#ff769f]'
                                  : 'text-gray-600 hover:text-primary-600'
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              ))}

              <div className="border-t pt-3 mt-2 space-y-3">
                {session ? (
                  <>
                    {!isHomePage && (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false)
                          switchView()
                        }}
                        disabled={isSwitching}
                        className="text-left text-primary-600 hover:text-primary-700 transition disabled:opacity-50"
                      >
                        {isSwitching
                          ? t.nav.switching
                          : isBrand
                            ? t.nav.switchToCreator
                            : t.nav.switchToBrand}
                      </button>
                    )}
                    <Link
                      href="/dashboard/messages"
                      className={`block transition ${isLandingPage ? 'text-[#071735] hover:text-[#2c6fb2]' : 'text-gray-700 hover:text-primary-600'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.messages?.title || 'Messages'}
                    </Link>
                    <Link
                      href={dashboardLink}
                      className={`block transition ${isLandingPage ? 'text-[#071735] hover:text-[#2c6fb2]' : 'text-gray-700 hover:text-primary-600'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.nav.myCenter}
                    </Link>
                    {(session.user as any)?.userType === 'ADMIN' && (
                      <Link
                        href="/admin"
                        className={`block transition ${isLandingPage ? 'text-[#071735] hover:text-[#2c6fb2]' : 'text-gray-700 hover:text-primary-600'}`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {t.nav.admin}
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      className={`block transition ${isLandingPage ? 'text-[#071735] hover:text-[#2c6fb2]' : 'text-gray-700 hover:text-primary-600'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.nav.settings}
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false)
                        signOut()
                      }}
                      className={`text-left transition ${isLandingPage ? 'text-[#071735] hover:text-[#2c6fb2]' : 'text-gray-700 hover:text-primary-600'}`}
                    >
                      {t.nav.logout}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      className={`block transition ${isLandingPage ? 'text-[#071735] hover:text-[#2c6fb2]' : 'text-gray-700 hover:text-primary-600'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.nav.login}
                    </Link>
                    <Link
                      href="/auth/signup"
                      className={`block font-normal transition ${isLandingPage ? 'text-[#0a4d9c] hover:text-[#2c6fb2]' : 'text-primary-600 hover:text-primary-700'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.nav.signup}
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
