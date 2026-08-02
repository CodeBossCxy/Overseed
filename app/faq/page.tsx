'use client'

import { useState } from 'react'
import MainLayout from '@/components/MainLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left bg-white/5 hover:bg-white/[0.08] transition"
      >
        <span className="text-white font-medium pr-4">{question}</span>
        <svg
          className={`w-5 h-5 text-white/60 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 py-5 bg-white/[0.02] border-t border-white/10">
          <p className="text-white/70 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  const { t } = useLanguage()

  return (
    <MainLayout>
      <div className="relative min-h-screen">
        <div className="fixed inset-0 bg-cover bg-center opacity-30 pointer-events-none" style={{ backgroundImage: "url('/background_2.jpg')" }} />
        <div className="fixed inset-0 bg-[#020a18]/60 pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-manrope), var(--font-noto-sans-sc), system-ui, sans-serif', fontWeight: 900 }}>
              {t.faq.title}
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              {t.faq.subtitle}
            </p>
          </div>

          {/* FAQ items */}
          <div className="space-y-3">
            {t.faq.items.map((item: { q: string; a: string }, i: number) => (
              <FAQItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>

          {/* Contact CTA */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center mt-12">
            <h2 className="text-xl font-semibold text-white mb-3">{t.faq.ctaTitle}</h2>
            <p className="text-white/60 mb-6">{t.faq.ctaDesc}</p>
            <Link
              href="/contact"
              className="inline-block px-6 py-3 bg-white text-gray-900 rounded-full hover:bg-white/90 transition font-semibold"
            >
              {t.faq.ctaButton}
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
