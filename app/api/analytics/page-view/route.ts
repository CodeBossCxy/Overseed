import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TRACKED_PATHS = new Set(['/dashboard/brand/discover'])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { path } = await req.json().catch(() => ({ path: '' }))
  if (!TRACKED_PATHS.has(path)) {
    return NextResponse.json({ message: 'Unsupported analytics path' }, { status: 400 })
  }

  await prisma.pageViewEvent.create({
    data: { userId: (session.user as any).id, path },
  })
  return NextResponse.json({ recorded: true })
}
