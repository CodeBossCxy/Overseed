import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getTranslatedEntities } from '@/lib/translation-service'
import { SupportedLanguage, isSupportedLanguage } from '@/lib/db/translations'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const platform = searchParams.get('platform')
    const compensation = searchParams.get('compensation')
    const minFollowers = searchParams.get('minFollowers')
    const maxFollowers = searchParams.get('maxFollowers')
    const sort = searchParams.get('sort') || 'latest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const lang = searchParams.get('lang') || 'en'
    const targetLanguage: SupportedLanguage = isSupportedLanguage(lang) ? lang : 'en'

    const where: Prisma.CampaignWhereInput = {
      status: 'ACTIVE',
    }

    // Category filter
    if (category && category !== 'all') {
      where.categories = {
        some: {
          category: {
            slug: category,
          },
        },
      }
    }

    // Platform filter
    if (platform && platform !== 'all') {
      where.platforms = {
        some: {
          platform: {
            slug: platform,
          },
        },
      }
    }

    // Compensation type filter
    if (compensation) {
      where.compensationType = compensation as any
    }

    // Build sort query
    let orderBy: Prisma.CampaignOrderByWithRelationInput = {}
    if (sort === 'latest') orderBy = { createdAt: 'desc' }
    else if (sort === 'deadline') orderBy = { deadline: 'asc' }
    else if (sort === 'payment') orderBy = { paymentMax: 'desc' }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
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
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ])

    // Translate campaigns if needed
    const translatedCampaigns = await getTranslatedEntities(
      'Campaign',
      campaigns,
      targetLanguage
    )

    return NextResponse.json({
      data: translatedCampaigns,
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        language: targetLanguage,
      },
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Check if user has a brand profile
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { userId },
    })

    if (!brandProfile) {
      return NextResponse.json(
        { message: 'Brand profile required to create campaigns' },
        { status: 403 }
      )
    }

    const data = await req.json()

    // Unverified brands may draft campaigns but not submit them for review
    if (brandProfile.brandVerificationStatus !== 'APPROVED' && data.status && data.status !== 'DRAFT') {
      return NextResponse.json(
        { message: 'Your brand must be verified before you can publish campaigns. You can save this campaign as a draft.' },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!data.title || !data.compensationType) {
      return NextResponse.json(
        { message: 'Title and compensation type are required' },
        { status: 400 }
      )
    }

    // Publishing goes through Overseed review: a brand-submitted "ACTIVE"
    // lands in PENDING_REVIEW; only the admin review flow sets ACTIVE.
    const requestedStatus = data.status === 'ACTIVE' ? 'PENDING_REVIEW' : data.status || 'DRAFT'

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        brandId: brandProfile.id,
        title: data.title,
        description: data.description,
        status: requestedStatus,
        deadline: data.deadline ? new Date(data.deadline) : null,
        campaignStartDate: data.campaignStartDate ? new Date(data.campaignStartDate) : null,
        campaignEndDate: data.campaignEndDate ? new Date(data.campaignEndDate) : null,
        totalSlots: data.totalSlots || 10,
        compensationType: data.compensationType,
        paymentMin: data.paymentMin,
        paymentMax: data.paymentMax,
        giftDescription: data.giftDescription,
        giftValue: data.giftValue,
        requiresProductPurchase: data.requiresProductPurchase || false,
        productPurchaseAmount: data.productPurchaseAmount,
        isProductReimbursed: data.isProductReimbursed || false,
        contentType: data.contentType,
        contentGuidelines: data.contentGuidelines,
        wordCountMin: data.wordCountMin,
        wordCountMax: data.wordCountMax,
        hashtagsRequired: data.hashtagsRequired,
        mentionsRequired: data.mentionsRequired,
        images: data.images || [],
        isFeatured: false,
      },
    })

    // Add platforms
    if (data.platformIds && data.platformIds.length > 0) {
      await prisma.campaignPlatform.createMany({
        data: data.platformIds.map((platformId: number) => ({
          campaignId: campaign.id,
          platformId,
        })),
      })
    }

    // Add categories
    if (data.categoryIds && data.categoryIds.length > 0) {
      await prisma.campaignCategory.createMany({
        data: data.categoryIds.map((categoryId: number) => ({
          campaignId: campaign.id,
          categoryId,
        })),
      })
    }

    // Add follower requirements
    if (data.followerRequirements && data.followerRequirements.length > 0) {
      await prisma.campaignFollowerRequirement.createMany({
        data: data.followerRequirements.map((req: any) => ({
          campaignId: campaign.id,
          platformId: req.platformId,
          minFollowers: req.minFollowers || 0,
          maxFollowers: req.maxFollowers,
          minEngagementRate: req.minEngagementRate,
        })),
      })
    }

    // Fetch full campaign with relations
    const fullCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: {
        brand: true,
        categories: { include: { category: true } },
        platforms: { include: { platform: true } },
        followerRequirements: { include: { platform: true } },
      },
    })

    return NextResponse.json(fullCampaign, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
