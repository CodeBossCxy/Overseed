import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTranslatedEntity } from '@/lib/translation-service'
import { SupportedLanguage, isSupportedLanguage } from '@/lib/db/translations'

// GET: Get single application details
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
    const { searchParams } = new URL(req.url)
    const lang = searchParams.get('lang')

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            brand: true,
            categories: { include: { category: true } },
            platforms: { include: { platform: true } },
          },
        },
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
      },
    })

    if (!application) {
      return NextResponse.json({ message: 'Application not found' }, { status: 404 })
    }

    // Check if user is either the applicant or the campaign owner
    const isApplicant = application.influencer.userId === userId
    const isCampaignOwner = application.campaign.brand.userId === userId

    if (!isApplicant && !isCampaignOwner) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // Translate only when a language is explicitly requested, so omitting
    // lang returns the original (untranslated) text
    if (lang && isSupportedLanguage(lang)) {
      const targetLanguage: SupportedLanguage = lang
      const translatedCampaign = await getTranslatedEntity(
        'Campaign',
        application.campaign,
        targetLanguage
      )

      let translatedBrand = translatedCampaign.brand
      if (translatedCampaign.brand?.description) {
        translatedBrand = await getTranslatedEntity(
          'BrandProfile',
          { ...translatedCampaign.brand, id: translatedCampaign.brand.id },
          targetLanguage
        )
      }

      return NextResponse.json({
        ...application,
        campaign: {
          ...translatedCampaign,
          brand: translatedBrand,
        },
      })
    }

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error fetching application:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Update application status (brand approves/rejects or influencer updates)
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

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            brand: true,
          },
        },
        influencer: true,
      },
    })

    if (!application) {
      return NextResponse.json({ message: 'Application not found' }, { status: 404 })
    }

    const isApplicant = application.influencer.userId === userId
    const isCampaignOwner = application.campaign.brand.userId === userId

    if (!isApplicant && !isCampaignOwner) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const data = await req.json()

    // Different allowed updates based on role
    if (isCampaignOwner) {
      // Brand can update status, add notes, rejection reason
      const allowedStatuses = ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED']

      if (data.status && !allowedStatuses.includes(data.status)) {
        return NextResponse.json(
          { message: 'Invalid status for brand action' },
          { status: 400 }
        )
      }

      const updateData: any = {}

      if (data.status) {
        updateData.status = data.status
        updateData.reviewedAt = new Date()

        if (data.status === 'APPROVED') {
          updateData.approvedAt = new Date()
          // Increment filled slots
          await prisma.campaign.update({
            where: { id: application.campaignId },
            data: { filledSlots: { increment: 1 } },
          })
          // Auto-create conversation if one doesn't exist
          const existingConversation = await prisma.conversation.findUnique({
            where: { applicationId: id },
          })
          if (!existingConversation) {
            await prisma.conversation.create({
              data: {
                applicationId: id,
                participants: {
                  createMany: {
                    data: [
                      { userId: application.campaign.brand.userId },
                      { userId: application.influencer.userId },
                    ],
                  },
                },
                messages: {
                  create: {
                    senderId: userId,
                    content: 'Application approved — you can now discuss collaboration details.',
                    isSystemMessage: true,
                  },
                },
              },
            })
          }
        } else if (data.status === 'COMPLETED') {
          updateData.completedAt = new Date()
        }
      }

      if (data.brandNotes !== undefined) {
        updateData.brandNotes = data.brandNotes
      }

      if (data.rejectionReason !== undefined) {
        updateData.rejectionReason = data.rejectionReason
      }

      const updated = await prisma.application.update({
        where: { id },
        data: updateData,
        include: {
          campaign: {
            select: {
              title: true,
              brand: {
                select: {
                  companyName: true,
                },
              },
            },
          },
          influencer: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    } else if (isApplicant) {
      // Influencer can only update pitch message or proposed rate (if status is PENDING)
      if (application.status !== 'PENDING') {
        return NextResponse.json(
          { message: 'Can only update pending applications' },
          { status: 400 }
        )
      }

      const updateData: any = {}

      if (data.pitchMessage !== undefined) {
        updateData.pitchMessage = data.pitchMessage
      }

      if (data.proposedRate !== undefined) {
        updateData.proposedRate = data.proposedRate
      }

      if (data.socialAccountId !== undefined) {
        updateData.socialAccountId = data.socialAccountId
      }

      const updated = await prisma.application.update({
        where: { id },
        data: updateData,
        include: {
          campaign: {
            select: {
              title: true,
              brand: {
                select: {
                  companyName: true,
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
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  } catch (error) {
    console.error('Error updating application:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Withdraw application (influencer only)
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

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        influencer: true,
      },
    })

    if (!application) {
      return NextResponse.json({ message: 'Application not found' }, { status: 404 })
    }

    if (application.influencer.userId !== userId) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // Only allow withdrawal if status is PENDING or UNDER_REVIEW
    if (!['PENDING', 'UNDER_REVIEW'].includes(application.status)) {
      return NextResponse.json(
        { message: 'Cannot withdraw application in current status' },
        { status: 400 }
      )
    }

    // Update status to WITHDRAWN instead of deleting
    await prisma.application.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    })

    return NextResponse.json({ message: 'Application withdrawn successfully' })
  } catch (error) {
    console.error('Error withdrawing application:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
