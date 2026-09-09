import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const feedback = await prisma.betaFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(feedback)
  } catch (error) {
    console.error('Failed to fetch beta feedback:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { id, status } = await request.json()

    if (!['new', 'reviewed', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const feedback = await prisma.betaFeedback.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json(feedback)
  } catch (error) {
    console.error('Failed to update feedback:', error)
    return NextResponse.json(
      { error: 'Failed to update feedback', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
