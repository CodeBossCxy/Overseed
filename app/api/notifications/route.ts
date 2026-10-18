import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — list notifications for the current user
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100)
  const cursor = url.searchParams.get('cursor') || undefined

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

// PATCH — mark notifications as read
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const body = await req.json()
  const { ids, all } = body as { ids?: string[]; all?: boolean }

  if (all) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
  } else if (ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { read: true },
    })
  }

  const unreadCount = await prisma.notification.count({ where: { userId, read: false } })
  return NextResponse.json({ unreadCount })
}
