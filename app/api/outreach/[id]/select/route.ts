import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { selectCreators, type OutreachCriteria } from '@/lib/outreach-ai'

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

    if (campaign.status !== 'DRAFT' && campaign.status !== 'READY') {
      return NextResponse.json(
        { message: 'Campaign must be in DRAFT or READY status to select creators', code: 'INVALID_STATUS' },
        { status: 409 }
      )
    }

    await prisma.outreachCampaign.update({
      where: { id },
      data: { status: 'SELECTING' },
    })

    try {
      const existing = await prisma.outreachRecipient.findMany({
        where: { outreachCampaignId: id },
        select: { handle: true },
      })

      const scored = await selectCreators(
        campaign.briefMessage,
        campaign.criteria as unknown as OutreachCriteria,
        campaign.quantity,
        existing.map((e) => e.handle)
      )

      await Promise.all(
        scored.map((creator) =>
          prisma.outreachRecipient.upsert({
            where: {
              outreachCampaignId_handle: {
                outreachCampaignId: id,
                handle: creator.handle,
              },
            },
            create: {
              outreachCampaignId: id,
              creatorProfileId: creator.creatorProfileId,
              platform: creator.platform,
              handle: creator.handle,
              displayName: creator.displayName,
              email: creator.email,
              avatarUrl: creator.avatarUrl,
              followerCount: creator.followerCount,
              engagementRate: creator.engagementRate,
              matchScore: creator.matchScore,
              matchReason: creator.matchReason,
            },
            update: {
              matchScore: creator.matchScore,
              matchReason: creator.matchReason,
            },
          })
        )
      )

      await prisma.outreachCampaign.update({
        where: { id },
        data: { status: 'READY' },
      })

      const recipients = await prisma.outreachRecipient.findMany({
        where: { outreachCampaignId: id },
        orderBy: { matchScore: 'desc' },
      })

      return NextResponse.json({ recipients })
    } catch (selectionErr: any) {
      console.error('POST /api/outreach/[id]/select selection failed:', selectionErr)
      await prisma.outreachCampaign.update({
        where: { id },
        data: { status: 'DRAFT' },
      })
      return NextResponse.json(
        { message: 'Creator selection failed', code: 'SELECTION_FAILED' },
        { status: 502 }
      )
    }
  } catch (err: any) {
    console.error('POST /api/outreach/[id]/select error:', err)
    return NextResponse.json({ message: 'Internal server error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
