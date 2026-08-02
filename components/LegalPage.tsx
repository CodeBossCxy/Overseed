'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/MainLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface LegalPageProps {
  enPath: string
  zhPath: string
  fallbackTitle: string
}

export default function LegalPage({ enPath, zhPath, fallbackTitle }: LegalPageProps) {
  const { locale, t } = useLanguage()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const path = locale === 'zh' ? zhPath : enPath
    fetch(path)
      .then((res) => res.text())
      .then((text) => {
        setContent(text)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [locale, enPath, zhPath])

  return (
    <MainLayout>
      <div className="relative min-h-screen">
        <div className="fixed inset-0 bg-cover bg-center opacity-30 pointer-events-none" style={{ backgroundImage: "url('/background_2.jpg')" }} />
        <div className="fixed inset-0 bg-[#020a18]/60 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {loading ? (
            <div className="text-center text-white/60 py-20">{t.common?.loading || 'Loading...'}</div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-12">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-6" style={{ fontFamily: 'var(--font-manrope), var(--font-noto-sans-sc), system-ui, sans-serif', fontWeight: 900 }}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl md:text-2xl font-semibold text-white mt-10 mb-4">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-semibold text-white mt-6 mb-3">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-white/70 leading-relaxed mb-4">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 mb-4 ml-4">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="space-y-2 mb-4 ml-4 list-decimal">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-white/70 text-sm leading-relaxed flex items-start gap-2">
                      <span className="text-[#ff769f] mt-0.5 flex-shrink-0">&#x2022;</span>
                      <span>{children}</span>
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-white/60 italic">{children}</em>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="text-[#ff769f] hover:text-[#ff9bbc] underline transition" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  hr: () => (
                    <hr className="border-white/10 my-8" />
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-[#ff769f]/50 pl-4 my-4 text-white/60 italic">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-sm border-collapse">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="border-b border-white/20">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="text-left text-white font-semibold py-3 px-4">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="text-white/70 py-3 px-4 border-b border-white/5">{children}</td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
