import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Campaign, assertTransition, type CampaignStatus } from '@/lib/status'

// GET: campaigns awaiting Overseed review
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const campaigns = await prisma.campaign.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: {
        brand: { select: { id: true, companyName: true, logoUrl: true, isVerified: true } },
        categories: { include: { category: true } },
        platforms: { include: { platform: true } },
      },
      orderBy: { updatedAt: 'asc' },
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Error fetching campaigns for review:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: approve (→ Live) or request changes (→ Draft + review note)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { campaignId, action, reviewNote } = await req.json()
    if (!campaignId || !['approve', 'request_changes'].includes(action)) {
      return NextResponse.json({ message: 'campaignId and a valid action are required' }, { status: 400 })
    }
    if (action === 'request_changes' && !reviewNote?.trim()) {
      return NextResponse.json({ message: 'A review note is required when requesting changes' }, { status: 400 })
    }

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
    }

    const to: CampaignStatus = action === 'approve' ? 'ACTIVE' : 'DRAFT'
    try {
      assertTransition(Campaign, 'campaign', campaign.status as CampaignStatus, to)
    } catch {
      return NextResponse.json(
        { message: `Campaign is ${campaign.status}, not awaiting review` },
        { status: 422 }
      )
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: to,
        reviewNote: action === 'request_changes' ? reviewNote.trim() : null,
        publishedAt: to === 'ACTIVE' && !campaign.publishedAt ? new Date() : undefined,
      },
    })

    return NextResponse.json({ campaign: updated })
  } catch (error) {
    console.error('Error reviewing campaign:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
