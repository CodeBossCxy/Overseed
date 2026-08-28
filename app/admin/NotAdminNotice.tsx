'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NotAdminNotice() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/'), 3000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div data-solid className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900">You are not an admin</h1>
        <p className="text-sm text-gray-500 mt-1">您不是管理员</p>
        <p className="text-sm text-gray-600 mt-3">Redirecting you to the main page… / 正在跳转到主页…</p>
      </div>
    </div>
  )
}
