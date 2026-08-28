import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendApplicationSubmittedEmail } from '@/lib/notification-emails'

// POST: Apply to a campaign (influencer only)
export async function POST(
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
    const subscriptionTier = (session.user as any).subscriptionTier || 'FREE'

    // Free users cannot apply to campaigns
    if (subscriptionTier === 'FREE') {
      return NextResponse.json(
        { message: 'Upgrade to Pro to apply to campaigns' },
        { status: 403 }
      )
    }

    // Check if user has an influencer profile
    const influencerProfile = await prisma.influencerProfile.findUnique({
      where: { userId },
      include: { socialAccounts: { select: { isVerified: true } } },
    })

    if (!influencerProfile) {
      return NextResponse.json(
        { message: 'Influencer profile required to apply' },
        { status: 403 }
      )
    }

    // Per spec: at least one verified social account before applying
    if (!influencerProfile.socialAccounts.some((a) => a.isVerified)) {
      return NextResponse.json(
        {
          message: 'Verify at least one social account before applying to campaigns.',
          code: 'SOCIAL_VERIFICATION_REQUIRED',
        },
        { status: 403 }
      )
    }

    // Check if campaign exists and is active
    const campaign = await prisma.campaign.findUnique({
      where: { id: id },
      include: {
        followerRequirements: true,
        brand: {
          select: {
            companyName: true,
            user: {
              select: {
                name: true,
                email: true,
                preferredLanguage: true,
                emailNotifications: true,
                emailCampaignUpdates: true,
                emailCollaborationUpdates: true,
              },
            },
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'ACTIVE') {
      return NextResponse.json(
        { message: 'Campaign is not accepting applications' },
        { status: 400 }
      )
    }

    // Check if deadline has passed
    if (campaign.deadline && new Date(campaign.deadline) < new Date()) {
      return NextResponse.json(
        { message: 'Application deadline has passed' },
        { status: 400 }
      )
    }

    // Check if slots are full
    if (campaign.filledSlots >= campaign.totalSlots) {
      return NextResponse.json(
        { message: 'All slots have been filled' },
        { status: 400 }
      )
    }

    // Check if already applied
    const existingApplication = await prisma.application.findUnique({
      where: {
        campaignId_influencerId: {
          campaignId: id,
          influencerId: influencerProfile.id,
        },
      },
    })

    if (existingApplication) {
      return NextResponse.json(
        { message: 'You have already applied to this campaign' },
        { status: 400 }
      )
    }

    const data = await req.json()

    // Create application
    const application = await prisma.application.create({
      data: {
        campaignId: id,
        influencerId: influencerProfile.id,
        socialAccountId: data.socialAccountId,
        pitchMessage: data.pitchMessage,
        proposedRate: data.proposedRate,
        status: 'PENDING',
      },
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

    // Fire-and-forget: notify the brand of the new application
    void sendApplicationSubmittedEmail(campaign.brand.user, {
      campaignId: id,
      campaignTitle: campaign.title,
      creatorName: influencerProfile.displayName,
    })

    return NextResponse.json(application, { status: 201 })
  } catch (error) {
    console.error('Error creating application:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
