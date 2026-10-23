'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const ERROR_KEY_MAP: Record<string, 'oauth' | 'accessDenied' | 'credentials' | 'generic'> = {
  OAuthCallback: 'oauth',
  OAuthSignin: 'oauth',
  Callback: 'oauth',
  AccessDenied: 'accessDenied',
  CredentialsSignin: 'credentials',
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  const errorCode = searchParams.get('error') ?? ''
  const messageKey = ERROR_KEY_MAP[errorCode] ?? 'generic'
  const e = t.auth.error

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.png" alt="Overseed" className="h-14 w-auto overseed-logo-ink" />
        </Link>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          {e.title}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md text-center">
            {e[messageKey]}
          </div>

          <div className="mt-6 flex flex-col space-y-3">
            <Link
              href="/auth/signin"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition"
            >
              {e.tryAgain}
            </Link>
            <Link
              href="/"
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              {e.goHome}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
