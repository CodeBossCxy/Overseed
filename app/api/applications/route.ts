import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTranslatedEntities } from '@/lib/translation-service'
import { SupportedLanguage, isSupportedLanguage } from '@/lib/db/translations'

// GET: Get my applications (influencer)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const lang = searchParams.get('lang')

    // Check if user has an influencer profile
    const influencerProfile = await prisma.influencerProfile.findUnique({
      where: { userId },
    })

    if (!influencerProfile) {
      return NextResponse.json(
        { message: 'Influencer profile not found' },
        { status: 404 }
      )
    }

    const where: any = { influencerId: influencerProfile.id }
    if (status) {
      where.status = status
    }

    const applications = await prisma.application.findMany({
      where,
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
          },
        },
        socialAccount: {
          include: {
            platform: true,
          },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    })

    // Translate campaigns only when a language is explicitly requested,
    // so omitting lang returns the original (untranslated) text
    if (lang && isSupportedLanguage(lang)) {
      const targetLanguage: SupportedLanguage = lang
      const translatedCampaigns = await getTranslatedEntities(
        'Campaign',
        applications.map((a) => a.campaign),
        targetLanguage
      )

      // Brand profile isn't fetched with `description` on this list route (only
      // id/companyName/logoUrl/isVerified are shown), so there's nothing to translate there.
      const reassembledApplications = applications.map((application, index) => ({
        ...application,
        campaign: translatedCampaigns[index],
      }))

      return NextResponse.json(reassembledApplications)
    }

    return NextResponse.json(applications)
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
