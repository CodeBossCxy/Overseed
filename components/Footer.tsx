'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="text-white/70 mt-auto relative" style={{ backgroundColor: 'rgba(2, 10, 24, 0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(212, 224, 253, 0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">{t.footer.about}</h3>
            <p className="text-sm font-light leading-relaxed">
              {t.footer.tagline}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">{t.footer.quickLinks}</h4>
            <ul className="space-y-2 text-sm font-light">
              <li><Link href="/" className="hover:text-white transition">{t.footer.home}</Link></li>
              <li><Link href="/browse" className="hover:text-white transition">{t.footer.browse}</Link></li>
              <li><Link href="/guidelines" className="hover:text-white transition">{t.footer.guidelines}</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">{t.footer.resources}</h4>
            <ul className="space-y-2 text-sm font-light">
              <li><Link href="/faq" className="hover:text-white transition">{t.footer.faq}</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">{t.footer.contact}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">{t.footer.legal}</h4>
            <ul className="space-y-2 text-sm font-light">
              <li><Link href="/terms" className="hover:text-white transition">{t.footer.terms}</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">{t.footer.privacy}</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">{t.footer.contact}</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-sm text-center text-white/40">
          <p>{t.footer.copyright}</p>
          <span className="hidden sm:inline">·</span>
          <a href="https://overseed.net" className="hover:text-white transition">overseed.net</a>
        </div>
      </div>
    </footer>
  )
}
