import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: list all chats for the user (sidebar)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const chats = await prisma.aiChat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        provider: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(chats)
  } catch (error: any) {
    console.error('Chat history GET error:', error)
    return NextResponse.json({ error: error.message || 'Internal error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}

// POST: create a new chat
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { provider } = await req.json()

    const chat = await prisma.aiChat.create({
      data: {
        userId,
        provider: provider || 'openai',
      },
    })

    return NextResponse.json(chat)
  } catch (error: any) {
    console.error('Chat history POST error:', error)
    return NextResponse.json({ error: error.message || 'Internal error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}

// DELETE: delete a chat
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { chatId } = await req.json()

    await prisma.aiChat.deleteMany({
      where: { id: chatId, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Chat history DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Internal error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}

// PATCH: rename a chat
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { chatId, title } = await req.json()

    if (!chatId || !title?.trim()) {
      return NextResponse.json({ error: 'Chat ID and title are required', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    await prisma.aiChat.updateMany({
      where: { id: chatId, userId },
      data: { title: title.trim() },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Chat history PATCH error:', error)
    return NextResponse.json({ error: error.message || 'Internal error', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
