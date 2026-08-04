import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSupportedLanguage } from '@/lib/db/translations'
import { getTranslatedEntities } from '@/lib/translation-service'

async function getBrandId(userId: string) {
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  return brand?.id ?? null
}

// GET /api/saved-creators — the brand's bookmarked creators.
// ?idsOnly=1 returns just the influencer ids (for toggling save state in lists).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const brandId = await getBrandId((session.user as any).id)
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  if (req.nextUrl.searchParams.get('idsOnly')) {
    const rows = await prisma.savedCreator.findMany({
      where: { brandId },
      select: { influencerId: true },
    })
    return NextResponse.json({ ids: rows.map((r) => r.influencerId) })
  }

  const saved = await prisma.savedCreator.findMany({
    where: { brandId },
    orderBy: { savedAt: 'desc' },
    include: {
      influencer: {
        include: {
          user: { select: { name: true, image: true } },
          socialAccounts: {
            include: { platform: true },
            orderBy: { followerCount: 'desc' },
          },
        },
      },
    },
  })

  const lang = req.nextUrl.searchParams.get('lang')
  if (lang && isSupportedLanguage(lang)) {
    const translatedProfiles = await getTranslatedEntities(
      'InfluencerProfile',
      saved.map((row) => row.influencer),
      lang
    )
    const translatedSaved = saved.map((row, i) => ({ ...row, influencer: translatedProfiles[i] }))
    return NextResponse.json({ saved: translatedSaved })
  }

  return NextResponse.json({ saved })
}

// POST /api/saved-creators { influencerId } — bookmark a creator
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const brandId = await getBrandId((session.user as any).id)
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { influencerId } = await req.json()
  if (!influencerId) {
    return NextResponse.json({ message: 'influencerId is required' }, { status: 400 })
  }
  const influencer = await prisma.influencerProfile.findUnique({
    where: { id: influencerId },
    select: { id: true },
  })
  if (!influencer) {
    return NextResponse.json({ message: 'Creator not found' }, { status: 404 })
  }

  await prisma.savedCreator.upsert({
    where: { brandId_influencerId: { brandId, influencerId } },
    create: { brandId, influencerId },
    update: {},
  })
  return NextResponse.json({ saved: true })
}

// DELETE /api/saved-creators?influencerId=... — remove a bookmark
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const brandId = await getBrandId((session.user as any).id)
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const influencerId = req.nextUrl.searchParams.get('influencerId')
  if (!influencerId) {
    return NextResponse.json({ message: 'influencerId is required' }, { status: 400 })
  }

  await prisma.savedCreator.deleteMany({ where: { brandId, influencerId } })
  return NextResponse.json({ saved: false })
}
