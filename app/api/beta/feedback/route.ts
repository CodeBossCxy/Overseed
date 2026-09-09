import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { type, content, page } = await request.json()

    if (!type || !content) {
      return NextResponse.json(
        { error: 'Type and content are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    if (!['bug', 'feature', 'general'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid feedback type', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const feedback = await prisma.betaFeedback.create({
      data: {
        userId,
        type,
        content,
        page: page || null,
      },
    })

    return NextResponse.json({ success: true, id: feedback.id })
  } catch (error) {
    console.error('Beta feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
