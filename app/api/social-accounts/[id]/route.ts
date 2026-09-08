import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH: Update social account
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Check if user owns this social account
    const socialAccount = await prisma.influencerSocialAccount.findUnique({
      where: { id },
      include: {
        influencer: true,
      },
    })

    if (!socialAccount) {
      return NextResponse.json({ message: 'Social account not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    if (socialAccount.influencer.userId !== userId) {
      return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    const data = await req.json()

    // Build update data
    const updateData: Record<string, any> = {
      username: data.username,
      profileUrl: data.profileUrl,
      followerCount: data.followerCount,
      engagementRate: data.engagementRate,
    }

    if (data.likesCount !== undefined) {
      updateData.likesCount = data.likesCount
    }

    if (data.verificationMethod) {
      updateData.verificationMethod = data.verificationMethod
      const isVerified = data.verificationMethod === 'url' || data.verificationMethod === 'screenshot'
      updateData.isVerified = isVerified
      if (isVerified) {
        updateData.verifiedAt = new Date()
      }
    }

    if (data.screenshotUrl !== undefined) {
      updateData.screenshotUrl = data.screenshotUrl
    }

    const updated = await prisma.influencerSocialAccount.update({
      where: { id },
      data: updateData,
      include: {
        platform: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating social account:', error)
    return NextResponse.json(
      { message: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

// DELETE: Unlink social account
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Check if user owns this social account
    const socialAccount = await prisma.influencerSocialAccount.findUnique({
      where: { id },
      include: {
        influencer: true,
      },
    })

    if (!socialAccount) {
      return NextResponse.json({ message: 'Social account not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    if (socialAccount.influencer.userId !== userId) {
      return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    await prisma.influencerSocialAccount.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Social account unlinked successfully' })
  } catch (error) {
    console.error('Error unlinking social account:', error)
    return NextResponse.json(
      { message: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
