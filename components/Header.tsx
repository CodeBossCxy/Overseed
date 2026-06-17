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

function NavDropdown({ label, items, isGlobal }: { label: string; items: DropdownItem[]; isGlobal?: boolean }) {
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 transition text-sm font-medium ${isGlobal ? 'text-gray-200 hover:text-[#ff769f]' : 'text-gray-700 hover:text-primary-600'}`}
      >
        {label}
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-2 w-48 rounded-lg shadow-lg py-1 z-50 ${isGlobal ? 'backdrop-blur-xl' : 'bg-white border border-gray-100'}`}
          style={isGlobal ? { backgroundColor: 'rgba(10, 21, 39, 0.95)', border: '1px solid rgba(212, 224, 253, 0.1)' } : undefined}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 text-sm font-light transition ${isGlobal ? 'hover:bg-white/10' : 'text-gray-700 hover:bg-primary-50 hover:text-primary-600'}`}
              style={isGlobal ? { color: 'rgba(255,255,255,0.85)' } : undefined}
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

    // Use Pusher for real-time badge updates
    let cleanup: (() => void) | undefined
    import('@/lib/pusher-client').then(({ getPusherClient }) => {
      const pusher = getPusherClient()
      if (pusher && badgeUserId) {
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
  const { currentMode, isBrand, switchView, isSwitching } = useViewMode()
  const { themeMode } = useTheme()
  const pathname = usePathname()
  const isHomePage = pathname === '/' || pathname === '/contact'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null)

  const toggleLanguage = () => {
    const newLang = locale === 'en' ? 'zh' : 'en'
    setLocale(newLang)
  }

  const dashboardLink = isBrand ? '/dashboard/brand' : '/dashboard/influencer'

  const navMenus = [
    {
      key: 'campaigns',
      label: t.nav.campaigns,
      items: [
        { label: t.nav.campaignBoard, href: '/browse' },
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

  return (
    <header className={`sticky top-0 z-50 ${isGlobal ? 'bg-[#0a1527]/20 backdrop-blur-md' : 'bg-white shadow-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {isGlobal ? (
              <img src="/gray_logo_with_txt.png" alt="Overseed" className="h-28 -my-4 translate-y-[2px] w-auto object-contain brightness-200" />
            ) : (
              <img src={themeMode === 'brand' ? "/blue_overseed.png" : "/pink_overseed.png"} alt="Overseed" className="h-28 -my-4 translate-y-[2px] w-auto object-contain" />
            )}
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-400 text-amber-900 rounded uppercase tracking-wider">{t.nav.beta}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            {navMenus.map((menu) => (
              menu.href ? (
                <Link key={menu.key} href={menu.href} className={`transition text-sm font-medium ${isGlobal ? 'text-gray-200 hover:text-[#ff769f]' : 'text-gray-700 hover:text-primary-600'}`}>
                  {menu.label}
                </Link>
              ) : (
                <NavDropdown key={menu.key} label={menu.label} items={menu.items} isGlobal={isGlobal} />
              )
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className={`p-2 rounded-md transition ${isGlobal ? 'text-gray-200 hover:text-[#ff769f] hover:bg-[#456fa3]/15' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'}`}
              title={t.nav.switchLanguage}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </button>

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
                <Link
                  href="/auth/signin"
                  className={`px-4 py-2 rounded-md transition text-sm ${isGlobal ? 'text-gray-200 hover:bg-[#456fa3]/15' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 transition text-sm"
                >
                  {t.nav.signup}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden p-2 rounded-md ${isGlobal ? 'hover:bg-[#456fa3]/15 text-gray-200' : 'hover:bg-gray-100'}`}
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
          <div className={`lg:hidden py-4 border-t ${isGlobal ? 'border-[#d4e0fd]/10' : ''}`}>
            <nav className="flex flex-col space-y-1">
              {navMenus.map((menu) => (
                menu.href ? (
                  <Link
                    key={menu.key}
                    href={menu.href}
                    className={`block py-2 transition font-medium ${isGlobal ? 'text-gray-200 hover:text-[#ff769f]' : 'text-gray-700 hover:text-primary-600'}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {menu.label}
                  </Link>
                ) : (
                  <div key={menu.key}>
                    <button
                      onClick={() => setMobileExpanded(mobileExpanded === menu.key ? null : menu.key)}
                      className={`flex items-center justify-between w-full py-2 transition font-medium ${isGlobal ? 'text-gray-200 hover:text-[#ff769f]' : 'text-gray-700 hover:text-primary-600'}`}
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
                            className={`block py-2 text-sm transition ${isGlobal ? 'text-gray-400 hover:text-[#ff769f]' : 'text-gray-600 hover:text-primary-600'}`}
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
                      className="block text-gray-700 hover:text-primary-600 transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.messages?.title || 'Messages'}
                    </Link>
                    <Link
                      href={dashboardLink}
                      className="block text-gray-700 hover:text-primary-600 transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.nav.myCenter}
                    </Link>
                    {(session.user as any)?.userType === 'ADMIN' && (
                      <Link
                        href="/admin"
                        className="block text-gray-700 hover:text-primary-600 transition"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {t.nav.admin}
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      className="block text-gray-700 hover:text-primary-600 transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.nav.settings}
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false)
                        signOut()
                      }}
                      className="text-left text-gray-700 hover:text-primary-600 transition"
                    >
                      {t.nav.logout}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      className="block text-gray-700 hover:text-primary-600 transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t.nav.login}
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="block text-primary-600 font-medium hover:text-primary-700 transition"
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
