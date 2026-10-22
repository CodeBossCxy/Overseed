'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAiToast, type AiToast } from '@/lib/ai-toast'

const DISMISS_MS = 6000

export default function AiToastRenderer() {
  const [toasts, setToasts] = useState<(AiToast & { exiting?: boolean })[]>([])
  const router = useRouter()

  useEffect(() => {
    return onAiToast((toast) => {
      setToasts(prev => [toast, ...prev].slice(0, 5))
      // Auto-dismiss
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === toast.id ? { ...t, exiting: true } : t))
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id))
        }, 300)
      }, DISMISS_MS)
    })
  }, [])

  const dismiss = (id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
  }

  const handleClick = (toast: AiToast) => {
    if (toast.href) router.push(toast.href)
    dismiss(toast.id)
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px' }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => handleClick(toast)}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 bg-white rounded-2xl shadow-2xl border border-gray-100 cursor-pointer hover:bg-gray-50 transition-all duration-300 ${
            toast.exiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0 animate-[slideInRight_300ms_ease-out]'
          }`}
        >
          <span className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ${
            toast.type === 'image'
              ? 'bg-violet-100 text-violet-600'
              : 'bg-primary-100 text-primary-600'
          }`}>
            {toast.type === 'image' ? '✦' : '💬'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{toast.body}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(toast.id) }}
            className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
