import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — list image sessions (with images) for the current user
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId')

  // If sessionId is provided, return that session's images
  if (sessionId) {
    const imgSession = await prisma.aiImageSession.findUnique({
      where: { id: sessionId },
      include: { images: { orderBy: { createdAt: 'asc' } } },
    })
    if (!imgSession || imgSession.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ session: imgSession })
  }

  // Otherwise return session list (without full images, just counts + first thumbnail)
  const sessions = await prisma.aiImageSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      images: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { url: true },
      },
      _count: { select: { images: true } },
    },
  })

  return NextResponse.json({
    sessions: sessions.map(s => ({
      id: s.id,
      title: s.title,
      prompt: s.prompt,
      imageType: s.imageType,
      imageCount: s._count.images,
      thumbnail: s.images[0]?.url || null,
      createdAt: s.createdAt.toISOString(),
    })),
  })
}

// DELETE — delete a session or a single image
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const { id, sessionId } = await req.json()

  if (sessionId) {
    // Delete entire session and its images
    await prisma.aiImageSession.deleteMany({ where: { id: sessionId, userId } })
    return NextResponse.json({ ok: true })
  }

  if (id) {
    // Delete single image
    await prisma.aiGeneratedImage.deleteMany({ where: { id, userId } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Missing id or sessionId' }, { status: 400 })
}
