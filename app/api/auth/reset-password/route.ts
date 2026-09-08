import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { email, code, password } = await request.json()

    if (!email || !code || !password) {
      return NextResponse.json(
        { error: 'Email, code, and new password are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).toLowerCase()
    const identifier = `reset:${normalizedEmail}`

    const token = await prisma.verificationToken.findFirst({
      where: { identifier, token: String(code) },
    })

    if (!token || token.expires < new Date()) {
      return NextResponse.json(
        { error: 'Invalid or expired code', code: 'INVALID_OR_EXPIRED_CODE' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired code', code: 'INVALID_OR_EXPIRED_CODE' }, { status: 400 })
    }

    const hashedPassword = await hash(String(password), 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    await prisma.verificationToken.deleteMany({ where: { identifier } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
