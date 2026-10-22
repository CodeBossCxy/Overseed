'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const errorMessages: Record<string, { en: string; zh: string }> = {
  OAuthCallback: {
    en: 'Something went wrong during sign in. Please try again.',
    zh: '登录过程中出现问题，请重试。',
  },
  OAuthSignin: {
    en: 'Something went wrong during sign in. Please try again.',
    zh: '登录过程中出现问题，请重试。',
  },
  Callback: {
    en: 'Something went wrong during sign in. Please try again.',
    zh: '登录过程中出现问题，请重试。',
  },
  AccessDenied: {
    en: 'Access denied. You do not have permission.',
    zh: '访问被拒绝。',
  },
  CredentialsSignin: {
    en: 'Invalid email or password.',
    zh: '邮箱或密码错误。',
  },
}

const defaultMessage = {
  en: 'An unexpected error occurred. Please try again.',
  zh: '发生意外错误，请重试。',
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const { locale } = useLanguage()

  const errorCode = searchParams.get('error') ?? ''
  const messages = errorMessages[errorCode] ?? defaultMessage
  const message = locale === 'zh' ? messages.zh : messages.en

  const tryAgainLabel = locale === 'zh' ? '重试' : 'Try Again'
  const goHomeLabel = locale === 'zh' ? '返回首页' : 'Go Home'
  const titleLabel = locale === 'zh' ? '登录失败' : 'Sign in failed'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.png" alt="Overseed" className="h-14 w-auto overseed-logo-ink" />
        </Link>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          {titleLabel}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md text-center">
            {message}
          </div>

          <div className="mt-6 flex flex-col space-y-3">
            <Link
              href="/auth/signin"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition"
            >
              {tryAgainLabel}
            </Link>
            <Link
              href="/"
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              {goHomeLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
