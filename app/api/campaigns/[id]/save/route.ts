import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getInfluencerId(userId: string) {
  const profile = await prisma.influencerProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  return profile?.id ?? null
}

// POST /api/campaigns/[id]/save — bookmark a campaign
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const influencerId = await getInfluencerId((session.user as any).id)
  if (!influencerId) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }
  const { id: campaignId } = await params

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  })
  if (!campaign) {
    return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
  }

  await prisma.savedCampaign.upsert({
    where: { influencerId_campaignId: { influencerId, campaignId } },
    create: { influencerId, campaignId },
    update: {},
  })
  return NextResponse.json({ saved: true })
}

// DELETE /api/campaigns/[id]/save — remove a bookmark
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const influencerId = await getInfluencerId((session.user as any).id)
  if (!influencerId) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }
  const { id: campaignId } = await params

  await prisma.savedCampaign.deleteMany({
    where: { influencerId, campaignId },
  })
  return NextResponse.json({ saved: false })
}
