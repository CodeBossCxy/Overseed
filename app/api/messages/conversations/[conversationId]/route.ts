import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: Fetch messages in a conversation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Verify user is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    })

    if (!participant) {
      return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    // Pagination
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '50')

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    })

    // Update lastReadAt
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    })

    // Get conversation details
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        application: {
          include: {
            campaign: { select: { id: true, title: true } },
            influencer: {
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
            },
          },
        },
        participants: true,
      },
    })

    // Get the other user's info
    const otherParticipantId = conversation?.participants.find(
      (p) => p.userId !== userId
    )?.userId
    let otherUser = null
    if (otherParticipantId) {
      otherUser = await prisma.user.findUnique({
        where: { id: otherParticipantId },
        select: { id: true, name: true, image: true, userType: true },
      })
    }

    return NextResponse.json({
      messages,
      conversation: {
        id: conversation?.id,
        applicationId: conversation?.applicationId,
        campaignTitle: conversation?.application.campaign.title,
        campaignId: conversation?.application.campaign.id,
        otherUser,
      },
      hasMore: messages.length === limit,
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { message: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
