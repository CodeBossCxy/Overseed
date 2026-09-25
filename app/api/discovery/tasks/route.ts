import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/discovery/tasks — the current brand user's discovery search
// tasks, most recently used first. Listing is free (no vendor calls).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!brand) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const tasks = await prisma.discoverySearchTask.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      platform: true,
      label: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { pages: true } },
    },
  })

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      platform: t.platform,
      label: t.label,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
      page_count: t._count.pages,
    })),
  })
}
