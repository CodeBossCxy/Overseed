'use client'

import { useState } from 'react'
import MainLayout from '@/components/MainLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'

type InquiryType = 'general' | 'demo' | 'business' | 'support'

export default function ContactPage() {
  const { t } = useLanguage()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    inquiryType: 'general' as InquiryType,
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setSubmitted(true)
      }
    } catch {
      // Still show success for now since we don't have the API yet
      setSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inquiryTypes = [
    { value: 'general', label: t.contact.inquiryGeneral },
    { value: 'demo', label: t.contact.inquiryDemo },
    { value: 'business', label: t.contact.inquiryBusiness },
    { value: 'support', label: t.contact.inquirySupport },
  ]

  if (submitted) {
    return (
      <MainLayout>
        <div className="relative min-h-screen">
          <div className="fixed inset-0 bg-cover bg-center opacity-30 pointer-events-none" style={{ backgroundImage: "url('/background_2.jpg')" }} />
          <div className="fixed inset-0 bg-[#020a18]/60 pointer-events-none" />
          <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
            <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">{t.contact.successTitle}</h1>
            <p className="text-white/70 text-lg mb-8">{t.contact.successMessage}</p>
            <Link href="/"
              className="inline-block px-6 py-3 bg-white text-gray-900 rounded-full hover:bg-white/90 transition font-semibold"
            >
              {t.contact.backToHome}
            </Link>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="relative min-h-screen">
        {/* Global background matching homepage */}
        <div className="fixed inset-0 bg-cover bg-center opacity-30 pointer-events-none" style={{ backgroundImage: "url('/background_2.jpg')" }} />
        <div className="fixed inset-0 bg-[#020a18]/60 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Left: Info */}
            <div>
              <h1 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-manrope), var(--font-noto-sans-sc), system-ui, sans-serif', fontWeight: 900 }}>
                {t.contact.title}
              </h1>
              <p className="text-lg text-white/70 mb-10">{t.contact.subtitle}</p>

              <div className="space-y-8">
                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{t.contact.emailTitle}</h3>
                    <p className="text-white/60 text-sm mt-1">{t.contact.emailDesc}</p>
                    <a href="mailto:contact@overseed.net" className="text-[#ff769f] hover:text-[#ff9bbc] font-medium mt-1 inline-block">
                      contact@overseed.net
                    </a>
                  </div>
                </div>

                {/* Business */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.193 23.193 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{t.contact.businessTitle}</h3>
                    <p className="text-white/60 text-sm mt-1">{t.contact.businessDesc}</p>
                    <a href="mailto:business@overseed.net" className="text-[#ff769f] hover:text-[#ff9bbc] font-medium mt-1 inline-block">
                      business@overseed.net
                    </a>
                  </div>
                </div>

                {/* Response time */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{t.contact.responseTitle}</h3>
                    <p className="text-white/60 text-sm mt-1">{t.contact.responseDesc}</p>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{t.contact.addressTitle}</h3>
                    <p className="text-white/60 text-sm mt-1">{t.contact.addressDesc}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Form — frosted glass card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8">
              <h2 className="text-xl font-semibold text-white mb-6">{t.contact.formTitle}</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-1">{t.contact.nameLabel} *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#A855F7]/50 focus:border-transparent backdrop-blur-sm"
                      placeholder={t.contact.namePlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-1">{t.contact.emailLabel} *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#A855F7]/50 focus:border-transparent backdrop-blur-sm"
                      placeholder={t.contact.emailPlaceholder}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">{t.contact.companyLabel}</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#A855F7]/50 focus:border-transparent backdrop-blur-sm"
                    placeholder={t.contact.companyPlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">{t.contact.inquiryLabel} *</label>
                  <select
                    required
                    value={formData.inquiryType}
                    onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value as InquiryType })}
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-[#A855F7]/50 focus:border-transparent backdrop-blur-sm"
                  >
                    {inquiryTypes.map((type) => (
                      <option key={type.value} value={type.value} className="bg-[#0a1527] text-white">
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">{t.contact.messageLabel} *</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#A855F7]/50 focus:border-transparent resize-none backdrop-blur-sm"
                    placeholder={t.contact.messagePlaceholder}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-3 bg-white text-gray-900 rounded-full hover:bg-white/90 transition font-semibold disabled:opacity-50 shadow-lg shadow-[#A855F7]/15"
                >
                  {isSubmitting ? t.contact.sending : t.contact.send}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
