import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getBrandId(userId: string) {
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  return brand?.id ?? null
}

// GET /api/saved-creators/discovery — list saved discovery creators.
// ?keysOnly=1 returns just platform:handle pairs (for toggling save state).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const brandId = await getBrandId((session.user as any).id)
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  if (req.nextUrl.searchParams.get('keysOnly')) {
    const rows = await prisma.savedDiscoveryCreator.findMany({
      where: { brandId },
      select: { platform: true, handle: true },
    })
    return NextResponse.json({ keys: rows.map((r) => `${r.platform}:${r.handle}`) })
  }

  const saved = await prisma.savedDiscoveryCreator.findMany({
    where: { brandId },
    orderBy: { savedAt: 'desc' },
  })
  return NextResponse.json({ saved })
}

// POST /api/saved-creators/discovery — bookmark a discovery creator
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const brandId = await getBrandId((session.user as any).id)
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await req.json()
  const platform = (body.platform || '').trim()
  const handle = (body.handle || '').trim().replace(/^@/, '').toLowerCase()
  if (!platform || !handle) {
    return NextResponse.json({ message: 'platform and handle are required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  await prisma.savedDiscoveryCreator.upsert({
    where: { brandId_platform_handle: { brandId, platform, handle } },
    create: {
      brandId,
      platform,
      handle,
      displayName: body.displayName || null,
      avatarUrl: body.avatarUrl || null,
      followerCount: typeof body.followerCount === 'number' ? body.followerCount : null,
      engagementRate: typeof body.engagementRate === 'number' ? body.engagementRate : null,
      nicheTags: Array.isArray(body.nicheTags) ? body.nicheTags : [],
    },
    update: {
      displayName: body.displayName || undefined,
      avatarUrl: body.avatarUrl || undefined,
      followerCount: typeof body.followerCount === 'number' ? body.followerCount : undefined,
      engagementRate: typeof body.engagementRate === 'number' ? body.engagementRate : undefined,
    },
  })
  return NextResponse.json({ saved: true })
}

// DELETE /api/saved-creators/discovery?platform=...&handle=... — remove bookmark
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const brandId = await getBrandId((session.user as any).id)
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const platform = req.nextUrl.searchParams.get('platform')?.trim()
  const handle = req.nextUrl.searchParams.get('handle')?.trim().replace(/^@/, '').toLowerCase()
  if (!platform || !handle) {
    return NextResponse.json({ message: 'platform and handle are required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  await prisma.savedDiscoveryCreator.deleteMany({ where: { brandId, platform, handle } })
  return NextResponse.json({ saved: false })
}
