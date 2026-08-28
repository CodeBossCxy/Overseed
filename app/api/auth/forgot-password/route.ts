import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOTPEmail } from '@/lib/email'

// Requests a password-reset code. Always responds success so the endpoint
// does not reveal whether an account exists for the given email.
export async function POST(request: Request) {
  try {
    const { email, locale } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = String(email).toLowerCase()
    const identifier = `reset:${normalizedEmail}`

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Only send a code for accounts that exist and have a password
    if (user?.password) {
      // Rate limit: token expires in 10min, so createdAt = expires - 10min
      const recentToken = await prisma.verificationToken.findFirst({
        where: { identifier },
        orderBy: { expires: 'desc' },
      })
      if (recentToken) {
        const createdAt = new Date(recentToken.expires.getTime() - 10 * 60 * 1000)
        const secondsSinceCreation = (Date.now() - createdAt.getTime()) / 1000
        if (secondsSinceCreation < 60) {
          const waitSeconds = Math.ceil(60 - secondsSinceCreation)
          return NextResponse.json(
            { error: `Please wait ${waitSeconds} seconds before requesting a new code` },
            { status: 429 }
          )
        }
      }

      await prisma.verificationToken.deleteMany({ where: { identifier } })

      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      await prisma.verificationToken.create({
        data: {
          identifier,
          token: otp,
          expires: new Date(Date.now() + 10 * 60 * 1000),
        },
      })

      await sendOTPEmail(normalizedEmail, otp, locale || 'en')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
