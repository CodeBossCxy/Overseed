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

    // Dispatch events to show/hide cached creators in BrandCampaignDetailClient
    const showTourCreators = () => {
      window.dispatchEvent(new CustomEvent('tour:showCampaignCreators'))
    }
    const hideTourCreators = () => {
      window.dispatchEvent(new CustomEvent('tour:clearCampaignCreators'))
    }

    // Helper: read the first campaign's URL from the DOM
    const getFirstCampaignHref = (): string | null => {
      const el = document.querySelector('[data-tour="first-campaign"]')
      return el?.getAttribute('data-tour-href') || el?.getAttribute('href') || null
    }

    // Track the campaign detail path (set dynamically during the tour)
    let campaignDetailPath = ''

    const brandSteps = [
      // Step 1: Dashboard Overview
      {
        element: '[data-tour="dashboard-stats"]',
        popover: {
          title: pt.dashboardTitle,
          description: pt.dashboardDesc,
          side: 'bottom' as const,
          align: 'center' as const,
        },
      },
      // Step 2: Create Campaign Button
      {
        element: '[data-tour="create-campaign"]',
        popover: {
          title: pt.launchCampaignTitle,
          description: pt.launchCampaignDesc,
          side: 'bottom' as const,
          align: 'center' as const,
        },
      },
      // Step 3: Campaign List
      {
        element: '[data-tour="campaign-list"]',
        popover: {
          title: pt.manageCampaignsTitle,
          description: pt.manageCampaignsDesc,
          side: 'top' as const,
          align: 'center' as const,
        },
      },
      // Step 4: Campaign Detail tabs (navigate into first campaign)
      {
        element: '[data-tour="campaign-tabs"]',
        popover: {
          title: pt.campaignDetailTitle,
          description: pt.campaignDetailDesc,
          side: 'bottom' as const,
          align: 'start' as const,
        },
      },
      // Step 5: Campaign detail content overview
      {
        element: '[data-tour="campaign-detail-content"]',
        popover: {
          title: pt.campaignOverviewTitle,
          description: pt.campaignOverviewDesc,
          side: 'top' as const,
          align: 'center' as const,
        },
      },
      // Step 6: Switch to Direct Outreach tab
      {
        element: '[data-tour="direct-outreach-tab"]',
        popover: {
          title: pt.switchToOutreachTitle,
          description: pt.switchToOutreachDesc,
          side: 'bottom' as const,
          align: 'start' as const,
        },
      },
      // Step 7: AI Search / Direct Outreach
      {
        element: '[data-tour="ai-match-button"]',
        popover: {
          title: pt.aiSearchTitle,
          description: pt.aiSearchDesc,
          side: 'top' as const,
          align: 'center' as const,
        },
      },
      // Step 8: Creator Card Overview (avatar, name, bio, niches)
      {
        element: '[data-tour="campaign-creator-card-info"]',
        popover: {
          title: pt.creatorCardTitle,
          description: pt.creatorCardDesc,
          side: 'bottom' as const,
          align: 'start' as const,
        },
      },
      // Step 9: View Profile button
      {
        element: '[data-tour="campaign-creator-view-profile"]',
        popover: {
          title: pt.viewProfileTitle,
          description: pt.viewProfileDesc,
          side: 'top' as const,
          align: 'start' as const,
        },
      },
      // Step 10: Creator Profile Popup (idx 9)
      {
        element: '[data-tour="creator-profile-modal"]',
        popover: {
          title: pt.profilePopupTitle,
          description: pt.profilePopupDesc,
          side: 'left' as const,
          align: 'center' as const,
        },
      },
      // Step 11: Contact button (idx 10)
      {
        element: '[data-tour="creator-contact-button"]',
        popover: {
          title: pt.contactButtonTitle,
          description: pt.contactButtonDesc,
          side: 'top' as const,
          align: 'center' as const,
        },
      },
      // Step 12: Bulk outreach bar (idx 11)
      {
        element: '[data-tour="bulk-outreach-bar"]',
        popover: {
          title: pt.bulkOutreachTitle,
          description: pt.bulkOutreachDesc,
          side: 'bottom' as const,
          align: 'center' as const,
        },
      },
      // Step 13: Message editor (idx 12)
      {
        element: '[data-tour="outreach-message-editor"]',
        popover: {
          title: pt.messageEditorTitle,
          description: pt.messageEditorDesc,
          side: 'left' as const,
          align: 'center' as const,
        },
      },
      // Step 14: Save / Bookmark button (idx 13)
      {
        element: '[data-tour="creator-save-button"]',
        popover: {
          title: pt.saveCreatorTitle,
          description: pt.saveCreatorDesc,
          side: 'top' as const,
          align: 'end' as const,
        },
      },
      // Step 15: Saved Creators nav (idx 14)
      {
        element: '[data-tour="saved-creators-nav"]',
        popover: {
          title: pt.savedCreatorsNavTitle,
          description: pt.savedCreatorsNavDesc,
          side: 'right' as const,
          align: 'start' as const,
        },
        onDeselected: () => {
          hideTourCreators()
        },
      },
      // Step 16: Saved Creators page (idx 15)
      {
        element: '[data-tour="saved-creators-folders"]',
        popover: {
          title: pt.savedCreatorsPageTitle,
          description: pt.savedCreatorsPageDesc,
          side: 'bottom' as const,
          align: 'center' as const,
        },
      },
      // Step 17: Messages Inbox (idx 16)
      {
        element: '[data-tour="messages-inbox"]',
        popover: {
          title: pt.inboxTitle,
          description: pt.inboxDesc,
          side: 'right' as const,
          align: 'start' as const,
        },
      },
      // Step 18: AI Assistant nav item (idx 17)
      {
        element: '[data-tour="ai-assistant"]',
        popover: {
          title: pt.aiCompanionTitle,
          description: pt.aiCompanionDesc,
          side: 'right' as const,
          align: 'start' as const,
        },
      },
      // Step 19: AI Chat (idx 18)
      {
        element: '[data-tour="ai-chat-panel"]',
        popover: {
          title: pt.aiChatTitle,
          description: pt.aiChatDesc,
          side: 'left' as const,
          align: 'center' as const,
        },
      },
      // Step 20: AI Image Generation (idx 19)
      {
        element: '[data-tour="ai-image-tab"]',
        popover: {
          title: pt.aiImageTitle,
          description: pt.aiImageDesc,
          side: 'bottom' as const,
          align: 'center' as const,
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

    // Helper: get the right page path for a given brand step index
    const getBrandStepPage = (idx: number): { path: string; waitFor: string } | null => {
      if (idx <= 2) {
        // Steps 0-2: dashboard or campaigns list
        const map: Record<number, { path: string; waitFor: string }> = {
          0: { path: '/dashboard/brand', waitFor: '[data-tour="dashboard-stats"]' },
          1: { path: '/dashboard/brand/campaigns', waitFor: '[data-tour="campaigns-page"]' },
          2: { path: '/dashboard/brand/campaigns', waitFor: '[data-tour="campaigns-page"]' },
        }
        return map[idx] || null
      }
      if (idx >= 3 && idx <= 14) {
        // Steps 3-14: campaign detail page (path determined dynamically)
        // Step 14 (saved-creators-nav) is a sidebar item visible on any page,
        // but we keep it on the campaign detail page for context
        if (!campaignDetailPath) return null
        return { path: campaignDetailPath, waitFor: '[data-tour="campaign-tabs"]' }
      }
      if (idx === 15) {
        return { path: '/dashboard/brand/saved-creators', waitFor: '[data-tour="saved-creators-folders"]' }
      }
      const laterMap: Record<number, { path: string; waitFor: string }> = {
        16: { path: '/dashboard/messages', waitFor: '[data-tour="messages-inbox"]' },
        17: { path: '/dashboard/brand', waitFor: '[data-tour="ai-assistant"]' },
        18: { path: '/ai-assistant', waitFor: '[data-tour="ai-chat-panel"]' },
        19: { path: '/ai-assistant', waitFor: '[data-tour="ai-image-tab"]' },
      }
      return laterMap[idx] || null
    }

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
        const btn = popover.nextButton as HTMLElement | undefined
        if (btn) {
          btn.style.cssText = 'background:#4f46e5;color:#fff;border:none;border-radius:999px;padding:0.5rem 1.25rem;font-weight:700;font-size:0.8125rem;box-shadow:0 1px 3px rgba(79,70,229,0.3);cursor:pointer;'
        }
      },
      onNextClick: async (_el, step, opts) => {
        const nextIdx = (opts.state.activeIndex ?? 0) + 1

        if (role === 'brand') {
          // Step 3 → 4: navigate into the first campaign detail page
          if (nextIdx === 3) {
            // We're on campaigns list, read the first campaign URL
            const href = getFirstCampaignHref()
            if (href) {
              campaignDetailPath = href
              router.push(href)
              await waitForElement('[data-tour="campaign-tabs"]')
              await new Promise((r) => setTimeout(r, 300))
            }
          }

          // Step 5 → 6: highlight the Direct Outreach tab (still on detail tab, no switch yet)

          // Step 6 → 7: now actually switch to direct tab (shows AI match section)
          if (nextIdx === 6) {
            window.dispatchEvent(new CustomEvent('tour:showDirectTab'))
            await waitForElement('[data-tour="ai-match-button"]')
            // Smooth-scroll so the user sees the page moving to the button
            const matchBtn = document.querySelector('[data-tour="ai-match-button"]')
            if (matchBtn) {
              matchBtn.scrollIntoView({ behavior: 'smooth', block: 'center' })
              await new Promise((r) => setTimeout(r, 600))
            }
          }

          // Step 7 → 8: simulate clicking "Find matching creators" with loading, then show results
          if (nextIdx === 7) {
            // Show loading state on the button (like real AI matching)
            window.dispatchEvent(new CustomEvent('tour:showMatchingLoading'))
            await new Promise((r) => setTimeout(r, 1000))
            // Now reveal creators
            showTourCreators()
            await waitForElement('[data-tour="campaign-creator-card-info"]')
          }

          // Step 9 → 10: open the creator profile popup
          if (nextIdx === 9) {
            window.dispatchEvent(new CustomEvent('tour:openProfile'))
            await waitForElement('[data-tour="creator-profile-modal"]')
            await new Promise((r) => setTimeout(r, 300))
          }

          // Step 10 → 11: close profile popup, continue to contact button
          if (nextIdx === 10) {
            window.dispatchEvent(new CustomEvent('tour:closeProfile'))
            await new Promise((r) => setTimeout(r, 200))
          }

          // Step 11 → 12: simulate selecting a creator so the bulk outreach bar appears
          if (nextIdx === 11) {
            window.dispatchEvent(new CustomEvent('tour:selectFirstCreator'))
            await waitForElement('[data-tour="bulk-outreach-bar"]')
            const bar = document.querySelector('[data-tour="bulk-outreach-bar"]')
            if (bar) {
              bar.scrollIntoView({ behavior: 'smooth', block: 'center' })
              await new Promise((r) => setTimeout(r, 600))
            }
          }

          // Step 12 → 13: open the outreach message editor
          if (nextIdx === 12) {
            window.dispatchEvent(new CustomEvent('tour:openOutreachEditor'))
            await waitForElement('[data-tour="outreach-message-editor"]')
            await new Promise((r) => setTimeout(r, 300))
          }

          // Step 13 → 14: close editor, deselect creators before showing save button
          if (nextIdx === 13) {
            window.dispatchEvent(new CustomEvent('tour:closeOutreachEditor'))
            window.dispatchEvent(new CustomEvent('tour:deselectAllCreators'))
            await new Promise((r) => setTimeout(r, 200))
          }

          // Leaving creator steps → clean up before navigating away
          if (nextIdx === 15) {
            window.dispatchEvent(new CustomEvent('tour:deselectAllCreators'))
            hideTourCreators()
            await new Promise((r) => setTimeout(r, 200))
          }

          // Standard page navigation for other steps
          const target = getBrandStepPage(nextIdx)
          if (target && window.location.pathname !== target.path) {
            router.push(target.path)
            await waitForElement(target.waitFor)
            await new Promise((r) => setTimeout(r, 300))
          }
        }

        d.moveNext()
      },
      onPrevClick: async (_el, step, opts) => {
        const prevIdx = (opts.state.activeIndex ?? 0) - 1

        if (role === 'brand') {
          // Navigate to the correct page first (if needed)
          const target = getBrandStepPage(prevIdx)
          if (target && window.location.pathname !== target.path) {
            router.push(target.path)
            await waitForElement(target.waitFor)
            await new Promise((r) => setTimeout(r, 300))
          }

          // After navigation (or if already on the right page), set up the correct tab/state
          if (prevIdx === 9) {
            // Back to profile popup — re-open it
            window.dispatchEvent(new CustomEvent('tour:showDirectTab'))
            await waitForElement('[data-tour="ai-match-button"]')
            showTourCreators()
            await waitForElement('[data-tour="campaign-creator-card-info"]')
            window.dispatchEvent(new CustomEvent('tour:openProfile'))
            await waitForElement('[data-tour="creator-profile-modal"]')
            await new Promise((r) => setTimeout(r, 300))
          } else if (prevIdx === 12) {
            // Back to message editor — need creator selected + editor open
            window.dispatchEvent(new CustomEvent('tour:closeProfile'))
            await new Promise((r) => setTimeout(r, 100))
            window.dispatchEvent(new CustomEvent('tour:showDirectTab'))
            await waitForElement('[data-tour="ai-match-button"]')
            showTourCreators()
            await waitForElement('[data-tour="campaign-creator-card-info"]')
            window.dispatchEvent(new CustomEvent('tour:selectFirstCreator'))
            await new Promise((r) => setTimeout(r, 200))
            window.dispatchEvent(new CustomEvent('tour:openOutreachEditor'))
            await waitForElement('[data-tour="outreach-message-editor"]')
            await new Promise((r) => setTimeout(r, 300))
          } else if (prevIdx >= 10 && prevIdx <= 14) {
            // Steps 10-14 (except 12): close editor/profile, ensure direct tab + creators visible
            window.dispatchEvent(new CustomEvent('tour:closeOutreachEditor'))
            window.dispatchEvent(new CustomEvent('tour:closeProfile'))
            await new Promise((r) => setTimeout(r, 100))
            window.dispatchEvent(new CustomEvent('tour:showDirectTab'))
            await waitForElement('[data-tour="ai-match-button"]')
            showTourCreators()
            await waitForElement('[data-tour="campaign-creator-card-info"]')
            await new Promise((r) => setTimeout(r, 200))

            if (prevIdx === 11) {
              // Bulk outreach bar — select a creator so the bar appears
              window.dispatchEvent(new CustomEvent('tour:selectFirstCreator'))
              await waitForElement('[data-tour="bulk-outreach-bar"]')
            } else {
              // Deselect creators for other steps (hide bulk bar)
              window.dispatchEvent(new CustomEvent('tour:deselectAllCreators'))
              await new Promise((r) => setTimeout(r, 100))
            }

            const stepEl = brandSteps[prevIdx]?.element
            if (stepEl) {
              const el = document.querySelector(stepEl)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                await new Promise((r) => setTimeout(r, 600))
              }
            }
          } else if (prevIdx >= 6 && prevIdx <= 8) {
            // Steps 6-8: direct outreach tab active, creators for 7-8
            window.dispatchEvent(new CustomEvent('tour:showDirectTab'))
            await waitForElement('[data-tour="ai-match-button"]')
            await new Promise((r) => setTimeout(r, 200))

            if (prevIdx === 6) {
              const matchBtn = document.querySelector('[data-tour="ai-match-button"]')
              if (matchBtn) {
                matchBtn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                await new Promise((r) => setTimeout(r, 600))
              }
            } else {
              showTourCreators()
              await waitForElement('[data-tour="campaign-creator-card-info"]')
              await new Promise((r) => setTimeout(r, 200))
              const stepEl = brandSteps[prevIdx]?.element
              if (stepEl) {
                const el = document.querySelector(stepEl)
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  await new Promise((r) => setTimeout(r, 600))
                }
              }
            }
          } else if (prevIdx >= 3 && prevIdx <= 5) {
            // Back to detail tab steps
            window.dispatchEvent(new CustomEvent('tour:showDetailTab'))
            await new Promise((r) => setTimeout(r, 200))
            const stepEl = brandSteps[prevIdx]?.element
            if (stepEl) {
              const el = document.querySelector(stepEl)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                await new Promise((r) => setTimeout(r, 400))
              }
            }
          }
        }

        d.movePrevious()
      },
      onDestroyStarted: () => {
        hideTourCreators()
        if ((d as any)._tourKeyHandler) {
          window.removeEventListener('keydown', (d as any)._tourKeyHandler)
        }
        completeTour()
        _driverInstance = null
        _tourStarted = false
        d.destroy()
      },
      steps,
    })

    // Allow Space key to advance the tour (ArrowRight/Left already handled by driver.js)
    const handleTourKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && _driverInstance) {
        e.preventDefault()
        // Find and click the last button in the navigation area (the Next/Done button)
        const btns = document.querySelectorAll('.driver-popover-navigation-btns button')
        const nextBtn = btns[btns.length - 1] as HTMLElement | undefined
        nextBtn?.click()
      }
    }
    window.addEventListener('keydown', handleTourKey)

    _driverInstance = d
    ;(d as any)._tourKeyHandler = handleTourKey
    _tourStarted = true
    markTourRunning()

    // Navigate to the dashboard before starting the tour
    if (role === 'brand' && window.location.pathname !== '/dashboard/brand') {
      router.push('/dashboard/brand')
      await waitForElement('[data-tour="dashboard-stats"]')
      await new Promise((r) => setTimeout(r, 300))
    }

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
