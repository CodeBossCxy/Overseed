import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { inviteCode } = await req.json()

    if (!inviteCode) {
      return NextResponse.json({ valid: false, error: 'Invite code is required', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const betaCode = await prisma.betaInviteCode.findUnique({
      where: { code: inviteCode.trim().toUpperCase() },
    })

    if (!betaCode || !betaCode.isActive) {
      return NextResponse.json({ valid: false, error: 'Invalid invite code', code: 'INVALID_INVITE_CODE' }, { status: 400 })
    }

    if (betaCode.expiresAt && betaCode.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: 'This invite code has expired', code: 'INVITE_CODE_EXPIRED' }, { status: 400 })
    }

    if (betaCode.usedCount >= betaCode.maxUses) {
      return NextResponse.json({ valid: false, error: 'This invite code has reached its usage limit', code: 'INVITE_CODE_EXHAUSTED' }, { status: 400 })
    }

    return NextResponse.json({ valid: true })
  } catch (error: any) {
    console.error('Beta validate error:', error)
    return NextResponse.json({ valid: false, error: 'Internal error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
