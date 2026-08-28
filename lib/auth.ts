import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import FacebookProvider from 'next-auth/providers/facebook'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import { compare } from 'bcryptjs'
import type { OAuthConfig } from 'next-auth/providers/oauth'

// Custom WeChat OAuth Provider
function WeChatProvider(options: {
  clientId: string
  clientSecret: string
}): OAuthConfig<any> {
  return {
    id: 'wechat',
    name: 'WeChat',
    type: 'oauth',
    authorization: {
      url: 'https://open.weixin.qq.com/connect/qrconnect',
      params: {
        appid: options.clientId,
        scope: 'snsapi_login',
        response_type: 'code',
      },
    },
    token: {
      url: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      async request({ params, provider }) {
        const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token')
        url.searchParams.append('appid', options.clientId)
        url.searchParams.append('secret', options.clientSecret)
        url.searchParams.append('code', params.code!)
        url.searchParams.append('grant_type', 'authorization_code')

        const response = await fetch(url.toString())
        const tokens = await response.json()
        // WeChat reports failures as errcode/errmsg inside a 200 response
        if (tokens.errcode) {
          throw new Error(`WeChat token error ${tokens.errcode}: ${tokens.errmsg}`)
        }
        return { tokens }
      },
    },
    userinfo: {
      url: 'https://api.weixin.qq.com/sns/userinfo',
      async request({ tokens, provider }) {
        const url = new URL('https://api.weixin.qq.com/sns/userinfo')
        url.searchParams.append('access_token', tokens.access_token as string)
        url.searchParams.append('openid', tokens.openid as string)
        url.searchParams.append('lang', 'en')

        const response = await fetch(url.toString())
        const profile = await response.json()
        if (profile.errcode) {
          throw new Error(`WeChat userinfo error ${profile.errcode}: ${profile.errmsg}`)
        }
        return profile
      },
    },
    profile(profile) {
      return {
        // unionid is stable across a WeChat Open Platform account's apps;
        // fall back to openid when the account has no mobile/official app
        id: profile.unionid || profile.openid,
        name: profile.nickname,
        email: profile.email || `${profile.openid}@wechat.local`,
        image: profile.headimgurl,
      }
    },
    // WeChat does not support PKCE; state is echoed back by qrconnect
    checks: ['state'],
    style: {
      logo: '/wechat-logo.svg',
      bg: '#07C160',
      text: '#fff',
    },
    options,
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      // openid-client defaults to 3500ms, which this network's round-trips
      // to Google can exceed (RPError: outgoing request timed out).
      httpOptions: { timeout: 15000 },
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
      httpOptions: { timeout: 15000 },
    }),
    WeChatProvider({
      clientId: process.env.WECHAT_APP_ID || '',
      clientSecret: process.env.WECHAT_APP_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }

        const isCorrectPassword = await compare(credentials.password, user.password)

        if (!isCorrectPassword) {
          throw new Error('Invalid credentials')
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email first')
        }

        return user
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile, credentials }) {
      // Auto-link OAuth accounts to existing users with the same email
      if (account?.provider && account.provider !== 'credentials' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        })
        if (existingUser) {
          // Check if this OAuth account is already linked
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
          })
          if (!existingAccount) {
            // Link the OAuth account to the existing user
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
            })
          }
          // Update user image/name from OAuth if missing
          if (!existingUser.image && (user as any).image) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { image: (user as any).image },
            })
          }
        }
      }
      return true
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id
        token.userType = (user as any).userType
        token.activeView = (user as any).activeView || null
        token.subscriptionTier = (user as any).subscriptionTier || 'FREE'
        // Load brand verification status for brand users (ADMIN acts as brand)
        if ((user as any).userType === 'BRAND' || (user as any).userType === 'ADMIN') {
          const bp = await prisma.brandProfile.findUnique({
            where: { userId: user.id },
            select: { brandVerificationStatus: true },
          })
          token.brandVerificationStatus = bp?.brandVerificationStatus || 'PENDING'
        }
      }
      // Re-read userType from DB when session.update() is called client-side
      if (trigger === 'update' && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { userType: true, activeView: true, subscriptionTier: true, brandProfile: { select: { brandVerificationStatus: true } } },
        })
        if (dbUser) {
          token.userType = dbUser.userType
          token.activeView = dbUser.activeView || null
          token.subscriptionTier = dbUser.subscriptionTier
          token.brandVerificationStatus = dbUser.brandProfile?.brandVerificationStatus || null
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user && token) {
        (session.user as any).id = `${token.sub || token.id || ''}`;
        (session.user as any).userType = token.userType;
        (session.user as any).activeView = token.activeView || null;
        (session.user as any).subscriptionTier = token.subscriptionTier || 'FREE';
        (session.user as any).brandVerificationStatus = token.brandVerificationStatus || null
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // New OAuth users get PRO tier (beta invite code was validated client-side before OAuth)
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionTier: 'PRO' },
        })
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
