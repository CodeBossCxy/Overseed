import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { messageId, feedback } = await req.json()
  if (!messageId || !['like', 'dislike', null].includes(feedback)) {
    return NextResponse.json({ error: 'Invalid request', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Verify the message belongs to a chat owned by this user
  const userId = (session.user as any).id
  const message = await prisma.aiChatMessage.findUnique({
    where: { id: messageId },
    include: { chat: { select: { userId: true } } },
  })

  if (!message || message.chat.userId !== userId) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  await prisma.aiChatMessage.update({
    where: { id: messageId },
    data: { feedback },
  })

  return NextResponse.json({ ok: true })
}
