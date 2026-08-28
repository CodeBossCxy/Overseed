import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found' }, { status: 400 })
  }

  const body = await request.json()
  const { viewMode } = body

  if (viewMode !== 'BRAND' && viewMode !== 'INFLUENCER') {
    return NextResponse.json(
      { error: 'Invalid viewMode. Must be BRAND or INFLUENCER' },
      { status: 400 }
    )
  }

  // Update userType in DB — but never demote an ADMIN account
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { userType: true },
  })
  if (current?.userType !== 'ADMIN') {
    await prisma.user.update({
      where: { id: userId },
      data: { userType: viewMode },
    })
  }

  // Auto-create the corresponding profile if it doesn't exist
  if (viewMode === 'BRAND') {
    const existing = await prisma.brandProfile.findUnique({
      where: { userId },
    })
    if (!existing) {
      await prisma.brandProfile.create({
        data: { userId },
      })
    }
  } else {
    const existing = await prisma.influencerProfile.findUnique({
      where: { userId },
    })
    if (!existing) {
      await prisma.influencerProfile.create({
        data: { userId },
      })
    }
  }

  return NextResponse.json({ success: true, userType: viewMode })
}
