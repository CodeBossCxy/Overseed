'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type FeedbackType = 'bug' | 'feature' | 'general'

export default function BetaFeedbackWidget() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('general')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!session) return null

  // The Create Campaign FAB (verified brands, public pages) occupies bottom-right;
  // stack the feedback button above it in that case.
  const fabMayBePresent =
    (session.user as any)?.brandVerificationStatus === 'APPROVED' &&
    !pathname.startsWith('/dashboard')

  const handleSubmit = async () => {
    if (!content.trim()) return
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, page: pathname }),
      })

      if (res.ok) {
        setSubmitted(true)
        setTimeout(() => {
          setIsOpen(false)
          setSubmitted(false)
          setContent('')
          setType('general')
        }, 2000)
      }
    } catch {
      // silently fail
    } finally {
      setIsSubmitting(false)
    }
  }

  const feedbackTypes: { key: FeedbackType; label: string; icon: string }[] = [
    { key: 'bug', label: t.beta?.feedbackBug || 'Bug', icon: '🐛' },
    { key: 'feature', label: t.beta?.feedbackFeature || 'Feature', icon: '💡' },
    { key: 'general', label: t.beta?.feedbackGeneral || 'General', icon: '💬' },
  ]

  return (
    <>
      {/* Floating feedback button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed ${fabMayBePresent ? 'bottom-24' : 'bottom-6'} right-6 z-40 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4 py-3 shadow-lg transition-all hover:shadow-xl flex items-center gap-2 group`}
        title={t.beta?.feedbackButton || 'Send Feedback'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <span className="text-sm font-medium hidden sm:inline">
          {t.beta?.feedbackButton || 'Feedback'}
        </span>
      </button>

      {/* Feedback modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsOpen(false)}>
          <div
            data-solid
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {submitted ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t.beta?.feedbackThanks || 'Thank you for your feedback!'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {t.beta?.feedbackHelps || 'Your feedback helps us improve Overseed.'}
                </p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t.beta?.feedbackTitle || 'Beta Feedback'}
                    </h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {t.beta?.feedbackDesc || "Tell us what you think — bugs, ideas, or anything else."}
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  {/* Type selector */}
                  <div className="flex gap-2">
                    {feedbackTypes.map((ft) => (
                      <button
                        key={ft.key}
                        onClick={() => setType(ft.key)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                          type === ft.key
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="mr-1">{ft.icon}</span> {ft.label}
                      </button>
                    ))}
                  </div>

                  {/* Content */}
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none text-sm"
                    placeholder={t.beta?.feedbackPlaceholder || 'Describe your feedback...'}
                  />

                  {/* Page context */}
                  <p className="text-xs text-gray-400">
                    {t.beta?.feedbackPage || 'Page'}: {pathname}
                  </p>

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !content.trim()}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? (t.beta?.feedbackSubmitting || 'Submitting...')
                      : (t.beta?.feedbackSubmit || 'Submit Feedback')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
