import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ownedCampaign(id: string, userId: string) {
  return prisma.campaign.findFirst({
    where: { id, brand: { userId } },
    select: { id: true },
  })
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!(await ownedCampaign(id, (session.user as any).id))) {
    return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
  }
  const queue = await prisma.campaignOutreach.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ queue })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!(await ownedCampaign(id, (session.user as any).id))) {
    return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
  }
  const body = await req.json()
  if (body.action === 'request') {
    await prisma.campaignOutreach.updateMany({
      where: { campaignId: id, status: 'SHORTLISTED' },
      data: { status: 'PENDING_REVIEW', requestedAt: new Date() },
    })
  } else {
    if (!body.creator?.id || !body.creator?.platform) {
      return NextResponse.json({ message: 'Creator is required' }, { status: 400 })
    }
    const c = body.creator
    await prisma.campaignOutreach.upsert({
      where: { campaignId_externalCreatorId: { campaignId: id, externalCreatorId: c.id } },
      create: {
        campaignId: id, externalCreatorId: c.id, platform: c.platform,
        handle: c.handle || null, displayName: c.display_name || null,
        avatarUrl: c.avatar_url || null, followerCount: c.follower_count ?? null,
        engagementRate: c.engagement_rate == null ? null : Number(c.engagement_rate),
        country: c.country || null, nicheTags: Array.isArray(c.niche_tags) ? c.niche_tags.slice(0, 12) : [],
      },
      update: {},
    })
  }
  const queue = await prisma.campaignOutreach.findMany({ where: { campaignId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ queue })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!(await ownedCampaign(id, (session.user as any).id))) {
    return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
  }
  const outreachId = req.nextUrl.searchParams.get('outreachId')
  if (!outreachId) return NextResponse.json({ message: 'outreachId is required' }, { status: 400 })
  await prisma.campaignOutreach.deleteMany({ where: { id: outreachId, campaignId: id, status: 'SHORTLISTED' } })
  const queue = await prisma.campaignOutreach.findMany({ where: { campaignId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ queue })
}
