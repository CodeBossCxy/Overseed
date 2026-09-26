import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CANCELLABLE_STATUSES = ['DRAFT', 'READY', 'SELECTING']

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const { id } = await params

    const campaign = await prisma.outreachCampaign.findFirst({
      where: { id, userId },
    })

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
    }

    if (!CANCELLABLE_STATUSES.includes(campaign.status)) {
      return NextResponse.json(
        {
          message: `Cannot cancel a campaign with status ${campaign.status}`,
          code: 'INVALID_STATUS',
        },
        { status: 409 }
      )
    }

    await prisma.outreachCampaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('POST /api/outreach/[id]/cancel error:', err)
    return NextResponse.json({ message: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
