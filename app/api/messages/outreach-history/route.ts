import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/messages/outreach-history
// Returns all outreached creators for the current brand user,
// combining campaign outreach (pipeline) and mass outreach recipients.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!brand) return NextResponse.json({ items: [] })

  // 1. Campaign pipeline outreach (CampaignOutreach)
  const campaignOutreach = await prisma.campaignOutreach.findMany({
    where: {
      campaign: { brandId: brand.id },
      OR: [
        { status: { not: 'SHORTLISTED' } },        // Creators past shortlisting
        { message: { not: null }, NOT: { message: '' } }, // Shortlisted but with a message from the brand
      ],
    },
    select: {
      id: true,
      platform: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      followerCount: true,
      status: true,
      message: true,
      requestedAt: true,
      sentAt: true,
      campaign: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // 2. Mass outreach recipients (OutreachRecipient)
  const massOutreach = await prisma.outreachRecipient.findMany({
    where: {
      outreachCampaign: { userId },
      status: { in: ['SENT', 'DELIVERED'] },
    },
    select: {
      id: true,
      platform: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      followerCount: true,
      status: true,
      sentAt: true,
      conversation: { select: { id: true } },
      outreachCampaign: { select: { id: true, title: true, briefMessage: true } },
    },
    orderBy: { sentAt: 'desc' },
    take: 200,
  })

  // Build ConversationItem-compatible entries
  const items = [
    ...campaignOutreach.map((o) => ({
      id: `co:${o.id}`,
      type: 'outreach' as const,
      applicationId: null,
      campaignTitle: o.campaign.title,
      campaignId: o.campaign.id,
      outreachRecipientId: o.id,
      creatorHandle: o.handle,
      creatorName: o.displayName,
      creatorAvatar: o.avatarUrl,
      creatorPlatform: o.platform,
      outreachStatus: o.status,
      otherUser: null,
      lastMessage: o.message
        ? { id: o.id, content: o.message, senderId: userId, isSystemMessage: true, createdAt: (o.sentAt || o.requestedAt || new Date()).toISOString() }
        : null,
      unreadCount: 0,
      updatedAt: (o.sentAt || o.requestedAt || new Date()).toISOString(),
    })),
    ...massOutreach
      .filter((o) => !o.conversation) // Exclude ones that already have conversations (they'll show in normal list)
      .map((o) => ({
        id: `mo:${o.id}`,
        type: 'outreach' as const,
        applicationId: null,
        campaignTitle: o.outreachCampaign.title,
        campaignId: o.outreachCampaign.id,
        outreachRecipientId: o.id,
        creatorHandle: o.handle,
        creatorName: o.displayName,
        creatorAvatar: o.avatarUrl,
        creatorPlatform: o.platform,
        outreachStatus: o.status,
        otherUser: null,
        lastMessage: o.outreachCampaign.briefMessage
          ? { id: o.id, content: o.outreachCampaign.briefMessage, senderId: userId, isSystemMessage: true, createdAt: (o.sentAt || new Date()).toISOString() }
          : null,
        unreadCount: 0,
        updatedAt: (o.sentAt || new Date()).toISOString(),
      })),
  ]

  // Sort by date descending
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return NextResponse.json({ items })
}
