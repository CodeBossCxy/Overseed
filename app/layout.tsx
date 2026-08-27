import type { Metadata, Viewport } from 'next'
import { DM_Serif_Display, Manrope, Noto_Sans_SC } from 'next/font/google'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SessionProvider from '@/components/SessionProvider'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import ThemeProvider from '@/components/ThemeProvider'
import BetaFeedbackWidget from '@/components/BetaFeedbackWidget'

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
})
const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-noto-sans-sc',
})
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Extend under notches/rounded corners; pair with env(safe-area-inset-*) padding.
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: 'Overseed - Connect Brands with Creators',
    template: '%s | Overseed',
  },
  description: 'A global platform connecting brands with creators for cross-border marketing collaborations.',
  keywords: 'creator marketing, brand collaborations, content creators, influencer marketing, cross-border marketing, KOL',
  metadataBase: new URL('https://overseed.net'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Overseed - Connect Brands with Creators',
    description: 'AI-powered cross-border creator collaboration platform. Launch campaigns, discover creators, manage partnerships.',
    type: 'website',
    siteName: 'Overseed',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Overseed - Connect Brands with Creators',
    description: 'AI-powered cross-border creator collaboration platform.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en" suppressHydrationWarning style={{ colorScheme: 'light' }}>
      <head>
        <link rel="icon" type="image/png" href="/icon-pink.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Overseed',
              url: 'https://overseed.net',
              logo: 'https://overseed.net/icon-pink.png',
              description:
                'AI-powered cross-border creator collaboration platform connecting brands with creators.',
            }),
          }}
        />
      </head>
      <body className={`${manrope.variable} ${notoSansSC.variable} ${GeistMono.variable} ${dmSerifDisplay.variable} font-sans`}>
        <SessionProvider session={session}>
          <LanguageProvider>
            <ThemeProvider>
              {children}
              <BetaFeedbackWidget />
            </ThemeProvider>
          </LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
