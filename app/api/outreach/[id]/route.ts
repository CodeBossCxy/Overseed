import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const { id } = await params

    const campaign = await prisma.outreachCampaign.findFirst({
      where: { id, userId },
      include: {
        recipients: {
          orderBy: { matchScore: 'desc' },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ campaign })
  } catch (err: any) {
    console.error('GET /api/outreach/[id] error:', err)
    return NextResponse.json({ message: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
