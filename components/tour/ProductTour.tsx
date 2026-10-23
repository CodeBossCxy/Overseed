'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useProductTour } from './useProductTour'
import type { WorkspaceRole } from '@/components/workspace/WorkspaceLayout'
import 'driver.js/dist/driver.css'
import './tour-styles.css'

interface ProductTourProps {
  role: WorkspaceRole
}

// Module-level so the driver instance survives component remounts
let _driverInstance: any = null
let _tourStarted = false

export default function ProductTour({ role }: ProductTourProps) {
  const { t } = useLanguage()
  const pt = t.productTour
  const { shouldAutoStart, completeTour, markTourRunning } = useProductTour()
  const router = useRouter()
  const pathname = usePathname()

  // Wait for an element to appear in the DOM (after navigation)
  const waitForElement = (selector: string, timeoutMs = 5000): Promise<boolean> =>
    new Promise((resolve) => {
      if (document.querySelector(selector)) { resolve(true); return }
      const start = Date.now()
      const interval = setInterval(() => {
        if (document.querySelector(selector)) { clearInterval(interval); resolve(true) }
        else if (Date.now() - start > timeoutMs) { clearInterval(interval); resolve(false) }
      }, 150)
    })

  const startTour = useCallback(async () => {
    if (_driverInstance) return

    const { driver } = await import('driver.js')

    // Index of the first Discover-page step (after the "Find Your Creator" nav highlight)
    const DISCOVER_NAV_STEP = 4 // 0-indexed in brandSteps

    const brandSteps = [
      {
        popover: {
          title: pt.welcomeTitle,
          description: pt.welcomeDesc,
        },
      },
      {
        element: '[data-tour="sidebar"]',
        popover: {
          title: pt.sidebarTitle,
          description: pt.sidebarDesc,
          side: 'right' as const,
          align: 'center' as const,
        },
      },
      {
        element: '[data-tour="create-campaign"]',
        popover: {
          title: pt.createCampaignTitle,
          description: pt.createCampaignDesc,
          side: 'bottom' as const,
          align: 'center' as const,
        },
      },
      {
        element: '[data-tour="discover"]',
        popover: {
          title: pt.discoverTitle,
          description: pt.discoverDesc,
          side: 'right' as const,
          align: 'start' as const,
        },
      },
      // ── Discover page deep-dive (steps 4-7) ──
      {
        element: '[data-tour="direct-lookup"]',
        popover: {
          title: pt.directLookupTitle,
          description: pt.directLookupDesc,
          side: 'bottom' as const,
          align: 'center' as const,
        },
      },
      {
        element: '[data-tour="ai-search"]',
        popover: {
          title: pt.aiSearchTitle,
          description: pt.aiSearchDesc,
          side: 'bottom' as const,
          align: 'center' as const,
        },
      },
      {
        element: '[data-tour="search-filters"]',
        popover: {
          title: pt.filtersTitle,
          description: pt.filtersDesc,
          side: 'top' as const,
          align: 'center' as const,
        },
      },
      // ── Back to workspace-level steps ──
      {
        element: '[data-tour="ai-assistant"]',
        popover: {
          title: pt.aiAssistantTitle,
          description: pt.aiAssistantDesc,
          side: 'right' as const,
          align: 'start' as const,
        },
      },
      {
        element: '[data-tour="messages"]',
        popover: {
          title: pt.messagesTitle,
          description: pt.messagesDesc,
          side: 'right' as const,
          align: 'start' as const,
        },
      },
      {
        element: '[data-tour="credits-chip"]',
        popover: {
          title: pt.creditsTitle,
          description: pt.creditsDesc,
          side: 'bottom' as const,
          align: 'center' as const,
        },
      },
      {
        popover: {
          title: pt.doneTitle,
          description: pt.doneDesc,
        },
      },
    ]

    const creatorSteps = [
      {
        popover: { title: pt.welcomeTitle, description: pt.welcomeDesc },
      },
      {
        element: '[data-tour="sidebar"]',
        popover: { title: pt.sidebarTitle, description: pt.sidebarDesc, side: 'right' as const, align: 'center' as const },
      },
      {
        element: '[data-tour="messages"]',
        popover: { title: pt.messagesTitle, description: pt.messagesDesc, side: 'right' as const, align: 'start' as const },
      },
      {
        element: '[data-tour="credits-chip"]',
        popover: { title: pt.creditsTitle, description: pt.creditsDesc, side: 'bottom' as const, align: 'center' as const },
      },
      {
        popover: { title: pt.doneTitle, description: pt.doneDesc },
      },
    ]

    const steps = role === 'brand' ? brandSteps : creatorSteps

    const d = driver({
      showProgress: true,
      animate: true,
      stagePadding: 8,
      stageRadius: 16,
      popoverClass: 'overseed-tour-popover',
      allowClose: true,
      doneBtnText: pt.done,
      nextBtnText: pt.next,
      prevBtnText: pt.prev,
      onPopoverRender: (popover) => {
        const nextBtn = popover.nextButton as HTMLElement | undefined
        if (nextBtn) {
          nextBtn.style.cssText = 'background:#4f46e5;color:#fff;border:none;border-radius:999px;padding:0.5rem 1.25rem;font-weight:700;font-size:0.8125rem;box-shadow:0 1px 3px rgba(79,70,229,0.3);cursor:pointer;'
        }
      },
      onNextClick: async (_el, step, opts) => {
        const idx = opts.state.activeIndex ?? 0
        // When advancing past the "Find Your Creator" nav step, navigate
        // to the Discover page first and wait for it to render.
        if (role === 'brand' && idx === DISCOVER_NAV_STEP - 1) {
          if (!window.location.pathname.includes('/discover')) {
            router.push('/dashboard/brand/discover')
            await waitForElement('[data-tour="direct-lookup"]')
          }
        }
        d.moveNext()
      },
      onDestroyStarted: () => {
        completeTour()
        _driverInstance = null
        _tourStarted = false
        d.destroy()
      },
      steps,
    })

    _driverInstance = d
    _tourStarted = true
    markTourRunning()
    d.drive()
  }, [role, pt, completeTour, markTourRunning, router])

  // Auto-start on first login
  useEffect(() => {
    if (shouldAutoStart && !_tourStarted) {
      // Short delay to let the workspace UI fully render
      const timer = setTimeout(() => startTour(), 800)
      return () => clearTimeout(timer)
    }
  }, [shouldAutoStart, startTour])

  // Listen for manual replay trigger from Settings or sidebar button
  useEffect(() => {
    const handleReplay = () => {
      // Reset module-level flags so the tour can restart
      if (_driverInstance) { _driverInstance.destroy(); _driverInstance = null }
      _tourStarted = false
      startTour()
    }
    window.addEventListener('tour:start', handleReplay)
    return () => window.removeEventListener('tour:start', handleReplay)
  }, [startTour])

  // Do NOT destroy the driver on unmount — the component remounts on every
  // page navigation but the tour must survive across pages.

  return null // This component only runs side effects
}
