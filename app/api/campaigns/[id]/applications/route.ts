import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTranslatedEntities } from '@/lib/translation-service'
import { SupportedLanguage, isSupportedLanguage } from '@/lib/db/translations'

// GET: View all applications for a campaign (brand only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Check if campaign exists and user owns it
    const campaign = await prisma.campaign.findUnique({
      where: { id: id },
      include: {
        brand: true,
      },
    })

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.brand.userId !== userId) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: any = { campaignId: id }
    if (status) {
      where.status = status
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        influencer: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                image: true,
              },
            },
            socialAccounts: {
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
        payment: true,
      },
      orderBy: {
        appliedAt: 'desc',
      },
    })

    // Translate pitch messages only when a language is explicitly requested,
    // so omitting lang returns the original (untranslated) text
    const lang = searchParams.get('lang')
    if (lang && isSupportedLanguage(lang)) {
      const targetLanguage: SupportedLanguage = lang
      const translatedApplications = await getTranslatedEntities(
        'Application',
        applications,
        targetLanguage
      )
      return NextResponse.json(translatedApplications)
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
