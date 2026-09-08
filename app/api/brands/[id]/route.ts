import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSupportedLanguage } from '@/lib/db/translations'
import { getTranslatedEntity, getTranslatedEntities } from '@/lib/translation-service'

// GET: Public brand profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const brand = await prisma.brandProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            createdAt: true,
          },
        },
        campaigns: {
          where: {
            status: 'ACTIVE',
          },
          include: {
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
            _count: {
              select: {
                applications: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
    })

    if (!brand) {
      return NextResponse.json({ message: 'Brand not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // Get total completed collaborations
    const completedCollaborations = await prisma.application.count({
      where: {
        campaign: {
          brandId: id,
        },
        status: 'COMPLETED',
      },
    })

    const lang = req.nextUrl.searchParams.get('lang')
    let result: any = { ...brand, completedCollaborations }

    if (lang && isSupportedLanguage(lang)) {
      result = await getTranslatedEntity('BrandProfile', result, lang)
      if (result.campaigns?.length > 0) {
        result.campaigns = await getTranslatedEntities('Campaign', result.campaigns, lang)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching brand profile:', error)
    return NextResponse.json(
      { message: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
