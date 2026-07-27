import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPusher } from '@/lib/pusher'
import { containsBannedContent } from '@/lib/message-filter'

// POST: Send a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Verify user is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    })

    if (!participant) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { content } = await req.json()

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { message: 'Message content is required' },
        { status: 400 }
      )
    }

    if (containsBannedContent(content)) {
      return NextResponse.json(
        { message: 'Message contains prohibited content', code: 'BANNED_CONTENT' },
        { status: 422 }
      )
    }

    // Create message and update conversation timestamp
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: content.trim(),
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      // Update sender's lastReadAt
      prisma.conversationParticipant.update({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        data: { lastReadAt: new Date() },
      }),
    ])

    // Trigger Pusher events for real-time updates
    try {
      const pusher = getPusher()

      // Notify the conversation channel (for users viewing this conversation)
      await pusher.trigger(`conversation-${conversationId}`, 'new-message', message)

      // Notify each other participant's user channel (for inbox badge updates)
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId, userId: { not: userId } },
      })
      for (const p of participants) {
        await pusher.trigger(`user-${p.userId}`, 'conversation-updated', {
          conversationId,
        })
      }
    } catch (pusherError) {
      // Non-critical — message is already saved, just log the error
      console.error('Pusher trigger error:', pusherError)
    }

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
