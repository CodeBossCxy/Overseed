import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOTPEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { email, locale } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified', code: 'ALREADY_VERIFIED' },
        { status: 400 }
      )
    }

    // Rate limit: check if a token was created less than 60 seconds ago
    const recentToken = await prisma.verificationToken.findFirst({
      where: { identifier: email.toLowerCase() },
      orderBy: { expires: 'desc' },
    })

    if (recentToken) {
      // Token expires in 10min, so it was created at (expires - 10min)
      const createdAt = new Date(recentToken.expires.getTime() - 10 * 60 * 1000)
      const secondsSinceCreation = (Date.now() - createdAt.getTime()) / 1000
      if (secondsSinceCreation < 60) {
        const waitSeconds = Math.ceil(60 - secondsSinceCreation)
        return NextResponse.json(
          { error: `Please wait ${waitSeconds} seconds before requesting a new code`, code: 'RATE_LIMITED' },
          { status: 429 }
        )
      }
    }

    // Delete old tokens
    await prisma.verificationToken.deleteMany({
      where: { identifier: email.toLowerCase() },
    })

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    await prisma.verificationToken.create({
      data: {
        identifier: email.toLowerCase(),
        token: otp,
        expires: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    await sendOTPEmail(email.toLowerCase(), otp, locale || 'en')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Resend OTP error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
