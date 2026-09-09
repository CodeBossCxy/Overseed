import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

function generateCode(): string {
  return 'BETA-' + crypto.randomBytes(4).toString('hex').toUpperCase()
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const codes = await prisma.betaInviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        usedBy: {
          select: {
            userId: true,
            usedAt: true,
          },
        },
      },
    })

    return NextResponse.json(codes)
  } catch (error) {
    console.error('Failed to fetch beta codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch codes', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { count = 1, maxUses = 1, note, expiresInDays } = await request.json()

    const codes = []
    for (let i = 0; i < Math.min(count, 50); i++) {
      const code = await prisma.betaInviteCode.create({
        data: {
          code: generateCode(),
          maxUses,
          note: note || null,
          expiresAt: expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null,
        },
      })
      codes.push(code)
    }

    return NextResponse.json({ success: true, codes })
  } catch (error) {
    console.error('Failed to generate beta codes:', error)
    return NextResponse.json(
      { error: 'Failed to generate codes', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { id, isActive } = await request.json()

    const code = await prisma.betaInviteCode.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json(code)
  } catch (error) {
    console.error('Failed to update beta code:', error)
    return NextResponse.json(
      { error: 'Failed to update code', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
