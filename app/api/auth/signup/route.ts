import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendOTPEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { name, email, password, userType, locale, inviteCode, businessLegalName, businessRegistrationNo, businessCountry, businessWebsite } = await request.json()

    // Validate inputs
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    // Beta invite code validation
    if (!inviteCode) {
      return NextResponse.json(
        { error: 'An invite code is required to join the beta' },
        { status: 400 }
      )
    }

    const betaCode = await prisma.betaInviteCode.findUnique({
      where: { code: inviteCode.trim().toUpperCase() },
    })

    if (!betaCode || !betaCode.isActive) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 400 }
      )
    }

    if (betaCode.expiresAt && betaCode.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invite code has expired' },
        { status: 400 }
      )
    }

    if (betaCode.usedCount >= betaCode.maxUses) {
      return NextResponse.json(
        { error: 'This invite code has reached its usage limit' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password and create user
    const hashedPassword = await hash(password, 12)

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        userType: userType === 'brand' ? 'BRAND' : 'INFLUENCER',
        subscriptionTier: 'PRO',
        emailVerified: null,
      },
    })

    // Create brand profile with verification info for brand signups
    if (userType === 'brand') {
      await prisma.brandProfile.create({
        data: {
          userId: newUser.id,
          companyName: businessLegalName || name,
          businessLegalName: businessLegalName || null,
          businessRegistrationNo: businessRegistrationNo || null,
          businessCountry: businessCountry || null,
          businessWebsite: businessWebsite || null,
          brandVerificationStatus: 'PENDING',
          verificationSubmittedAt: new Date(),
        },
      })
    }

    // Record invite code usage
    await prisma.$transaction([
      prisma.betaInviteCode.update({
        where: { id: betaCode.id },
        data: { usedCount: { increment: 1 } },
      }),
      prisma.betaInviteUsage.create({
        data: {
          inviteCodeId: betaCode.id,
          userId: newUser.id,
        },
      }),
    ])

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email.toLowerCase() },
    })

    // Store OTP in VerificationToken table (expires in 10 minutes)
    await prisma.verificationToken.create({
      data: {
        identifier: email.toLowerCase(),
        token: otp,
        expires: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    // Send OTP email (non-blocking — don't fail signup if email fails)
    try {
      await sendOTPEmail(email.toLowerCase(), otp, locale || 'en')
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError)
      // User is created, they can use "Resend OTP" on the verification screen
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
