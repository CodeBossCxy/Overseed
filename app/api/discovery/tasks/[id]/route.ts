import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/discovery/tasks/[id] — one discovery search task: its stored
// search parameters, which pages are snapshotted (free to view), and the
// requested page's snapshot (?page=N, default 0). Never calls the vendor
// or charges credits — unseen pages go through /api/discovery/club-search
// with task_id instead.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const { id } = await params

  const task = await prisma.discoverySearchTask.findFirst({
    where: { id, userId },
    include: { pages: { select: { page: true }, orderBy: { page: 'asc' } } },
  })
  if (!task) {
    return NextResponse.json({ message: 'Search task not found', code: 'TASK_NOT_FOUND' }, { status: 404 })
  }

  const pageParam = Number(req.nextUrl.searchParams.get('page') ?? 0)
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? Math.floor(pageParam) : 0
  const snapshot = await prisma.discoveryTaskPage.findUnique({
    where: { taskId_page: { taskId: task.id, page } },
  })

  return NextResponse.json({
    id: task.id,
    platform: task.platform,
    label: task.label,
    request: task.request,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    pages: task.pages.map((p) => p.page),
    page,
    data: snapshot ? snapshot.data : null,
  })
}
