import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_PLATFORMS = ['instagram', 'youtube', 'tiktok']

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const brand = await prisma.brandProfile.findUnique({ where: { userId } })
    if (!brand) {
      return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const { title, briefMessage, quantity, platform, criteria } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'title is required', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    if (!briefMessage || typeof briefMessage !== 'string' || briefMessage.length < 10 || briefMessage.length > 2000) {
      return NextResponse.json(
        { message: 'briefMessage must be between 10 and 2000 characters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (typeof quantity !== 'number' || quantity < 1 || quantity > 100) {
      return NextResponse.json(
        { message: 'quantity must be between 1 and 100', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { message: 'platform must be one of instagram, youtube, tiktok', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const campaign = await prisma.outreachCampaign.create({
      data: {
        userId,
        brandId: brand.id,
        title: title.trim(),
        briefMessage,
        quantity,
        platform,
        criteria: criteria ?? null,
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/outreach error:', err)
    return NextResponse.json({ message: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}

export async function GET(_: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const raw = await prisma.outreachCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { recipients: true } },
      },
    })

    const campaigns = raw.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      quantity: c.quantity,
      platform: c.platform,
      totalSent: c.totalSent,
      totalFailed: c.totalFailed,
      creditsCost: c.creditsCost,
      recipientCount: c._count.recipients,
      createdAt: c.createdAt,
    }))

    return NextResponse.json({ campaigns })
  } catch (err: any) {
    console.error('GET /api/outreach error:', err)
    return NextResponse.json({ message: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
