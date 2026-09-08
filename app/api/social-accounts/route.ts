import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST: Link a social account
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const subscriptionTier = (session.user as any).subscriptionTier || 'FREE'

    // Free users cannot link social accounts
    if (subscriptionTier === 'FREE') {
      return NextResponse.json(
        { message: 'Upgrade to Pro to link social media accounts', code: 'UPGRADE_REQUIRED' },
        { status: 403 }
      )
    }

    // Check if user has an influencer profile
    const influencerProfile = await prisma.influencerProfile.findUnique({
      where: { userId },
    })

    if (!influencerProfile) {
      return NextResponse.json(
        { message: 'Influencer profile required to add social accounts', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const data = await req.json()

    // Validate required fields
    if (!data.platformId || !data.username) {
      return NextResponse.json(
        { message: 'Platform and username are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Check if platform exists
    const platform = await prisma.platform.findUnique({
      where: { id: data.platformId },
    })

    if (!platform) {
      return NextResponse.json(
        { message: 'Invalid platform', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Check if already linked
    const existing = await prisma.influencerSocialAccount.findUnique({
      where: {
        influencerId_platformId: {
          influencerId: influencerProfile.id,
          platformId: data.platformId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { message: 'Platform already linked', code: 'CONFLICT' },
        { status: 400 }
      )
    }

    // Determine verification status
    const verificationMethod = data.verificationMethod || 'manual'
    const isVerified = verificationMethod === 'url' || verificationMethod === 'screenshot'
    const verifiedAt = isVerified ? new Date() : null

    // Create social account
    const socialAccount = await prisma.influencerSocialAccount.create({
      data: {
        influencerId: influencerProfile.id,
        platformId: data.platformId,
        username: data.username,
        profileUrl: data.profileUrl,
        followerCount: data.followerCount || 0,
        likesCount: data.likesCount || null,
        engagementRate: data.engagementRate,
        isVerified,
        verificationMethod,
        screenshotUrl: data.screenshotUrl || null,
        verifiedAt,
      },
      include: {
        platform: true,
      },
    })

    return NextResponse.json(socialAccount, { status: 201 })
  } catch (error) {
    console.error('Error linking social account:', error)
    return NextResponse.json(
      { message: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

// GET: Get my social accounts
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const influencerProfile = await prisma.influencerProfile.findUnique({
      where: { userId },
    })

    if (!influencerProfile) {
      return NextResponse.json(
        { message: 'Influencer profile not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const socialAccounts = await prisma.influencerSocialAccount.findMany({
      where: { influencerId: influencerProfile.id },
      include: {
        platform: true,
      },
      orderBy: {
        followerCount: 'desc',
      },
    })

    return NextResponse.json(socialAccounts)
  } catch (error) {
    console.error('Error fetching social accounts:', error)
    return NextResponse.json(
      { message: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
