'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useViewMode } from '@/lib/hooks/useViewMode'
import LanguageSetupModal from '@/components/workspace/LanguageSetupModal'

// Workspace shell per the July 2026 workspace spec: floating left sidebar
// with icon nav + user chip, and a content area with a top-right utility
// bar (bell, language, resources). Replaces the public Header/Footer chrome
// on dashboard pages. Nav contents are role-driven (creator vs brand).

export type WorkspaceRole = 'creator' | 'brand'

const ICONS = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  stack: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  bookmark: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  user: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  card: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  sparkles: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
  briefcase: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
} as const

interface NavItem {
  href: string
  label: string
  icon: string
  exact?: boolean
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export default function WorkspaceLayout({
  role,
  children,
}: {
  role: WorkspaceRole
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { locale, setLocale, t } = useLanguage()
  const { switchView, isSwitching } = useViewMode()
  const w = t.workspace
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)

  const subscriptionTier = (session?.user as any)?.subscriptionTier || 'FREE'
  const isPro = subscriptionTier === 'PRO'

  // Unread messages dot (sidebar Messages item + top-bar bell)
  useEffect(() => {
    if (!session?.user) return
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/messages/unread')
        if (res.ok) {
          const data = await res.json()
          setUnread(data.totalUnread || 0)
        }
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [session?.user])

  const navItems: NavItem[] =
    role === 'creator'
      ? [
          { href: '/dashboard/influencer', label: w.dashboard, exact: true, icon: ICONS.home },
          { href: '/browse', label: w.browseCampaigns, icon: ICONS.stack },
          { href: '/dashboard/influencer/saved', label: w.savedCampaigns, icon: ICONS.bookmark },
          { href: '/dashboard/influencer/applications', label: w.myApplications, icon: ICONS.document },
          { href: '/dashboard/influencer/profile', label: w.creatorProfile, icon: ICONS.user },
          { href: '/dashboard/messages', label: w.messages, icon: ICONS.chat },
          { href: '/dashboard/influencer/payouts', label: w.payouts, icon: ICONS.card },
          { href: '/settings', label: w.settings, icon: ICONS.cog },
          { href: '/dashboard/upgrade', label: w.myPlan, icon: ICONS.shield },
        ]
      : [
          { href: '/dashboard/brand', label: w.dashboard, exact: true, icon: ICONS.home },
          { href: '/dashboard/brand/campaigns', label: w.myCampaigns, icon: ICONS.briefcase },
          { href: '/dashboard/brand/saved-creators', label: t.brand.savedCreators.title, icon: ICONS.bookmark },
          { href: '/dashboard/brand/discover', label: t.nav.findInfluencer, icon: ICONS.search },
          { href: '/dashboard/messages', label: w.messages, icon: ICONS.chat },
          { href: '/dashboard/brand/profile', label: w.brandProfile, icon: ICONS.user },
          { href: '/ai-assistant', label: w.aiAssistant, icon: ICONS.sparkles },
          { href: '/settings', label: w.settings, icon: ICONS.cog },
          { href: '/pricing/brand', label: w.myPlan, icon: ICONS.shield },
        ]

  const profileHref = role === 'creator' ? '/dashboard/influencer/profile' : '/dashboard/brand/profile'
  const roleLabel = role === 'creator' ? w.creator : w.brand
  const isNavigating = !!pendingHref && pendingHref !== pathname

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href
    // Longest-prefix wins so /dashboard/brand doesn't stay lit on subpages.
    const matches = navItems.filter((n) => !n.exact && pathname.startsWith(n.href))
    const longest = matches.sort((a, b) => b.href.length - a.href.length)[0]
    return longest?.href === item.href
  }

  const prefetchRoute = useCallback((href: string) => {
    router.prefetch(href)
  }, [router])

  const handleSidebarNavigate = useCallback((
    href: string,
    event?: MouseEvent<HTMLAnchorElement>
  ) => {
    if (event && (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )) {
      return
    }

    setMobileOpen(false)
    setAccountOpen(false)
    prefetchRoute(href)
    if (href !== pathname) setPendingHref(href)
  }, [pathname, prefetchRoute])

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  useEffect(() => {
    if (!pendingHref) return
    const timeout = window.setTimeout(() => setPendingHref(null), 12000)
    return () => window.clearTimeout(timeout)
  }, [pendingHref])

  const userName = session?.user?.name || roleLabel
  const initials = userName
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link href="/" className="workspace-logo-link flex w-full items-center justify-center gap-2.5 px-4 pt-9 pb-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-horizontal.png" alt="Overseed" className="h-14 w-auto object-contain overseed-logo-ink" />
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item)
          const pending = pendingHref === item.href && pendingHref !== pathname
          const highlighted = active || pending
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={(event) => handleSidebarNavigate(item.href, event)}
              onMouseEnter={() => prefetchRoute(item.href)}
              onFocus={() => prefetchRoute(item.href)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition ${
                highlighted
                  ? 'selected-option-glass text-gray-900 font-bold'
                  : 'text-gray-600 font-medium hover:bg-white/60 hover:text-gray-900'
              }`}
            >
              <NavIcon d={item.icon} />
              <span className="truncate flex-1">{item.label}</span>
              {pending ? (
                <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
              ) : item.href === '/dashboard/messages' && unread > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Account chip: avatar · name · role, with an upward menu */}
      <div className="relative m-3">
        {accountOpen && (
          <div
            data-solid className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-40"
            onMouseLeave={() => setAccountOpen(false)}
          >
            <Link
              href={profileHref}
              onClick={() => setAccountOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {role === 'creator' ? w.creatorProfile : w.brandProfile}
            </Link>
            <button
              onClick={() => { setAccountOpen(false); switchView() }}
              disabled={isSwitching}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {role === 'creator' ? t.nav.switchToBrand : t.nav.switchToCreator}
            </button>
            <Link
              href="/contact"
              onClick={() => setAccountOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t.nav.helpAndSupport}
            </Link>
            <div className="my-1 border-t border-gray-100" />
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              {t.nav.logout}
            </button>
          </div>
        )}
        <button
          onClick={() => setAccountOpen((o) => !o)}
          className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 transition text-left hover:bg-white/20"
        >
          <span className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-800 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-sm font-bold text-gray-900 truncate">
              {role === 'creator' ? `@${userName.replace(/\s+/g, '').toLowerCase()}` : userName}
            </span>
            <span className="block text-xs text-gray-500">
              {role === 'creator' ? roleLabel : t.brand.dashboard.brandAdmin}
            </span>
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen ws-themed-bg">
      <div className="flex min-h-screen max-w-[1500px] mx-auto">
        {/* Desktop sidebar — viewport-height and sticky so it is the same
            size on every page and stays put while the content scrolls */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 py-4 pl-4 sticky top-0 h-screen self-start">
          <div className="flex flex-col flex-1 min-h-0 rounded-3xl bg-white/55 backdrop-blur border border-white/70 shadow-sm py-4">
            {sidebarContent}
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 ws-themed-bg py-4 shadow-xl">
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Content */}
        <div className="relative flex-1 min-w-0 flex flex-col">
          <div
            className={`pointer-events-none absolute left-4 right-4 top-0 z-30 h-0.5 overflow-hidden rounded-full bg-white/40 transition-opacity duration-150 sm:left-8 sm:right-8 ${
              isNavigating ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="workspace-route-progress block h-full w-1/3 rounded-full bg-gray-900/70" />
          </div>
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-8 pt-5">
            <button
              className="lg:hidden p-2 rounded-lg bg-white/70 text-gray-600"
              onClick={() => setMobileOpen(true)}
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3 ml-auto">
              {role === 'brand' && (
                <Link
                  href="/dashboard/brand/campaigns/new"
                  className="hidden sm:inline-flex h-10 items-center gap-2 px-5 rounded-full bg-primary-600 text-white text-sm font-bold shadow-sm hover:bg-primary-700 transition"
                >
                  <span aria-hidden className="text-lg leading-none">+</span>
                  {t.nav?.createCampaign || 'Create Campaign'}
                </Link>
              )}
              {/* Subscription status */}
              <Link
                href={role === 'creator' ? '/dashboard/upgrade' : '/pricing/brand'}
                className={`h-10 px-5 rounded-full text-sm font-bold flex items-center transition workspace-top-pill ${
                  isPro
                    ? 'selected-option-glass text-gray-900 hover:bg-white/70'
                    : 'bg-white shadow-sm text-gray-600 hover:text-gray-900'
                }`}
                title={w.myPlan}
              >
                {isPro ? 'PRO' : t.brand.dashboard.plan.free}
              </Link>
              {/* Language */}
              <button
                onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
                className="h-10 px-3 rounded-full bg-white shadow-sm text-sm font-medium text-gray-600 hover:text-gray-900 transition"
                title="Language"
              >
                🌐 {locale === 'en' ? 'EN' : '中文'}
              </button>
              <Link
                href="/dashboard/messages"
                className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-900 transition"
                title={t.messages?.title}
              >
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </Link>
            </div>
          </div>

          <main
            className={`flex-1 px-4 sm:px-8 pb-10 transition-opacity duration-150 ${
              isNavigating ? 'opacity-80' : 'opacity-100'
            }`}
            aria-busy={isNavigating}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mandatory first-login Language & Region setup */}
      <LanguageSetupModal />
    </div>
  )
}
