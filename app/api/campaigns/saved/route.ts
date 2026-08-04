import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTranslatedEntities } from '@/lib/translation-service'
import { SupportedLanguage, isSupportedLanguage } from '@/lib/db/translations'

// GET /api/campaigns/saved — list the current user's saved campaigns
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id

  const influencerProfile = await prisma.influencerProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!influencerProfile) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const lang = searchParams.get('lang')

  const savedCampaigns = await prisma.savedCampaign.findMany({
    where: { influencerId: influencerProfile.id },
    include: {
      campaign: {
        include: {
          brand: {
            select: {
              id: true,
              companyName: true,
              logoUrl: true,
              isVerified: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
          platforms: {
            include: {
              platform: true,
            },
          },
          followerRequirements: {
            include: {
              platform: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  // Translate only when a language is explicitly requested, so omitting
  // lang returns the original (untranslated) text
  if (lang && isSupportedLanguage(lang)) {
    const targetLanguage: SupportedLanguage = lang
    const translatedCampaigns = await getTranslatedEntities(
      'Campaign',
      savedCampaigns.map((item) => item.campaign),
      targetLanguage
    )

    const result = savedCampaigns.map((item, index) => ({
      ...item,
      campaign: translatedCampaigns[index],
    }))

    return NextResponse.json(result)
  }

  return NextResponse.json(savedCampaigns)
}
