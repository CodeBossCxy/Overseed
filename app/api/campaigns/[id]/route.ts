import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTranslatedEntity } from '@/lib/translation-service'
import { SupportedLanguage, isSupportedLanguage } from '@/lib/db/translations'
import { Campaign, assertTransition, type CampaignStatus } from '@/lib/status'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    // Translate only when a language is explicitly requested, so omitting
    // lang returns the original (untranslated) text
    const lang = searchParams.get('lang')
    const targetLanguage: SupportedLanguage | null = lang && isSupportedLanguage(lang) ? lang : null

    const campaign = await prisma.campaign.findUnique({
      where: { id: id },
      include: {
        brand: {
          select: {
            id: true,
            userId: true,
            companyName: true,
            logoUrl: true,
            websiteUrl: true,
            description: true,
            industry: true,
            countries: true,
            isVerified: true,
          },
        },
        agency: {
          select: {
            id: true,
            agencyName: true,
            logoUrl: true,
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
        media: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
    }

    // Internal workspace translation fetches should not inflate public views.
    if (searchParams.get('track') !== '0') {
      await prisma.campaign.update({
        where: { id: id },
        data: { viewCount: { increment: 1 } },
      })
    }

    if (!targetLanguage) {
      return NextResponse.json(campaign)
    }

    // Translate campaign if needed
    const translatedCampaign = await getTranslatedEntity(
      'Campaign',
      campaign,
      targetLanguage
    )

    // Also translate nested brand profile description
    let translatedBrand = translatedCampaign.brand
    if (translatedCampaign.brand?.description) {
      translatedBrand = await getTranslatedEntity(
        'BrandProfile',
        { ...translatedCampaign.brand, id: translatedCampaign.brand.id },
        targetLanguage
      )
    }

    return NextResponse.json({
      ...translatedCampaign,
      brand: translatedBrand,
      _meta: { language: targetLanguage },
    })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: true,
      },
    })

    if (!existingCampaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
    }

    if (existingCampaign.brand.userId !== userId) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const data = await req.json()

    // Publishing goes through Overseed review: a brand-submitted "ACTIVE"
    // lands in PENDING_REVIEW (unless the campaign is already live); only the
    // admin review flow sets ACTIVE. Guard everything else with the machine.
    let requestedStatus: CampaignStatus | undefined = data.status
    if (requestedStatus === 'ACTIVE' && existingCampaign.status !== 'ACTIVE' && existingCampaign.status !== 'PAUSED') {
      requestedStatus = 'PENDING_REVIEW'
    }
    // Unverified brands can keep drafting but not submit for review
    if (
      requestedStatus === 'PENDING_REVIEW' &&
      existingCampaign.brand.brandVerificationStatus !== 'APPROVED'
    ) {
      return NextResponse.json(
        { message: 'Your brand must be verified before you can publish campaigns. You can keep this campaign as a draft.' },
        { status: 403 }
      )
    }
    if (requestedStatus && requestedStatus !== existingCampaign.status) {
      try {
        assertTransition(Campaign, 'campaign', existingCampaign.status as CampaignStatus, requestedStatus)
      } catch {
        return NextResponse.json(
          { message: `Cannot move campaign from ${existingCampaign.status} to ${requestedStatus}` },
          { status: 422 }
        )
      }
    }

    // Update campaign
    const campaign = await prisma.campaign.update({
      where: { id: id },
      data: {
        title: data.title,
        description: data.description,
        status: requestedStatus,
        // Resubmitting for review clears the previous review note
        reviewNote: requestedStatus === 'PENDING_REVIEW' ? null : undefined,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        campaignStartDate: data.campaignStartDate ? new Date(data.campaignStartDate) : undefined,
        campaignEndDate: data.campaignEndDate ? new Date(data.campaignEndDate) : undefined,
        totalSlots: data.totalSlots,
        compensationType: data.compensationType,
        paymentMin: data.paymentMin,
        paymentMax: data.paymentMax,
        giftDescription: data.giftDescription,
        giftValue: data.giftValue,
        requiresProductPurchase: data.requiresProductPurchase,
        productPurchaseAmount: data.productPurchaseAmount,
        isProductReimbursed: data.isProductReimbursed,
        contentType: data.contentType,
        contentGuidelines: data.contentGuidelines,
        wordCountMin: data.wordCountMin,
        wordCountMax: data.wordCountMax,
        hashtagsRequired: data.hashtagsRequired,
        mentionsRequired: data.mentionsRequired,
        images: data.images,
        publishedAt: requestedStatus === 'ACTIVE' && !existingCampaign.publishedAt ? new Date() : undefined,
      },
    })

    // Update platforms if provided
    if (data.platformIds !== undefined) {
      await prisma.campaignPlatform.deleteMany({
        where: { campaignId: id },
      })
      if (data.platformIds.length > 0) {
        await prisma.campaignPlatform.createMany({
          data: data.platformIds.map((platformId: number) => ({
            campaignId: id,
            platformId,
          })),
        })
      }
    }

    // Update categories if provided
    if (data.categoryIds !== undefined) {
      await prisma.campaignCategory.deleteMany({
        where: { campaignId: id },
      })
      if (data.categoryIds.length > 0) {
        await prisma.campaignCategory.createMany({
          data: data.categoryIds.map((categoryId: number) => ({
            campaignId: id,
            categoryId,
          })),
        })
      }
    }

    // Update follower requirements if provided
    if (data.followerRequirements !== undefined) {
      await prisma.campaignFollowerRequirement.deleteMany({
        where: { campaignId: id },
      })
      if (data.followerRequirements.length > 0) {
        await prisma.campaignFollowerRequirement.createMany({
          data: data.followerRequirements.map((req: any) => ({
            campaignId: id,
            platformId: req.platformId,
            minFollowers: req.minFollowers || 0,
            maxFollowers: req.maxFollowers,
            minEngagementRate: req.minEngagementRate,
          })),
        })
      }
    }

    // Fetch updated campaign with relations
    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: id },
      include: {
        brand: true,
        categories: { include: { category: true } },
        platforms: { include: { platform: true } },
        followerRequirements: { include: { platform: true } },
      },
    })

    return NextResponse.json(updatedCampaign)
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
      where: { id },
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

    // ?mode=cancel → soft cancel (keeps history); default → hard delete (relations cascade)
    if (req.nextUrl.searchParams.get('mode') === 'cancel') {
      await prisma.campaign.update({
        where: { id: id },
        data: { status: 'CANCELLED' },
      })
      return NextResponse.json({ message: 'Campaign cancelled successfully' })
    }

    await prisma.campaign.delete({ where: { id } })
    return NextResponse.json({ message: 'Campaign deleted successfully' })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
