import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Look up token
    const token = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: email.toLowerCase(),
          token: otp,
        },
      },
    })

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid verification code', code: 'INVALID_OR_EXPIRED_CODE' },
        { status: 400 }
      )
    }

    if (token.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email.toLowerCase(),
            token: otp,
          },
        },
      })
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.', code: 'INVALID_OR_EXPIRED_CODE' },
        { status: 400 }
      )
    }

    // Mark email as verified and delete the token
    await prisma.$transaction([
      prisma.user.update({
        where: { email: email.toLowerCase() },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email.toLowerCase(),
            token: otp,
          },
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
