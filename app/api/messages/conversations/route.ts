import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: List conversations for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Get all conversations where user is a participant
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            application: {
              include: {
                campaign: {
                  select: { id: true, title: true, brandId: true },
                },
                influencer: {
                  include: {
                    user: {
                      select: { id: true, name: true, image: true },
                    },
                  },
                },
              },
            },
            participants: {
              include: {
                conversation: false,
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        conversation: { updatedAt: 'desc' },
      },
    })

    // Creators see a star on brands they favorited (any saved campaign of
    // that brand counts as favoriting the brand)
    let favoritedBrandIds = new Set<string>()
    const influencerSelf = await prisma.influencerProfile.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (influencerSelf) {
      const savedRows = await prisma.savedCampaign.findMany({
        where: { influencerId: influencerSelf.id },
        select: { campaign: { select: { brandId: true } } },
      })
      favoritedBrandIds = new Set(savedRows.map((r) => r.campaign.brandId))
    }

    const conversations = await Promise.all(
      participations.map(async (p) => {
        const conv = p.conversation
        const otherParticipant = conv.participants.find(
          (part) => part.userId !== userId
        )

        // Get unread count
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: p.lastReadAt },
            senderId: { not: userId },
          },
        })

        // Get the other user's info
        let otherUser = null
        if (otherParticipant) {
          otherUser = await prisma.user.findUnique({
            where: { id: otherParticipant.userId },
            select: { id: true, name: true, image: true, userType: true },
          })
        }

        return {
          id: conv.id,
          applicationId: conv.applicationId,
          campaignTitle: conv.application.campaign.title,
          campaignId: conv.application.campaign.id,
          influencerId: conv.application.influencerId,
          brandProfileId: conv.application.campaign.brandId,
          favorited: favoritedBrandIds.has(conv.application.campaign.brandId),
          otherUser,
          lastMessage: conv.messages[0] || null,
          unreadCount,
          updatedAt: conv.updatedAt,
        }
      })
    )

    // Total unread
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

    return NextResponse.json({ conversations, totalUnread })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
