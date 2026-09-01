import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { grantVerifiedTrial } from '@/lib/subscription'
import { sendVerificationApprovedEmail, sendVerificationRejectedEmail } from '@/lib/notification-emails'

// GET: List brand profiles by verification status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'PENDING'

    const brands = await prisma.brandProfile.findMany({
      where: { brandVerificationStatus: status as any },
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
      },
      orderBy: { verificationSubmittedAt: 'asc' },
    })

    return NextResponse.json({ brands })
  } catch (error) {
    console.error('Error fetching brand verifications:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Approve or reject a brand
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const adminUserId = (session.user as any).id
    const { brandProfileId, action, rejectionReason } = await req.json()

    if (!brandProfileId || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ message: 'brandProfileId and action (APPROVE/REJECT) are required' }, { status: 400 })
    }

    if (action === 'REJECT' && !rejectionReason) {
      return NextResponse.json({ message: 'A rejection reason is required' }, { status: 400 })
    }

    const updated = await prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        brandVerificationStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        isVerified: action === 'APPROVE',
        verificationDate: action === 'APPROVE' ? new Date() : undefined,
        verificationReviewedAt: new Date(),
        verificationReviewedBy: adminUserId,
        rejectionReason: action === 'REJECT' ? rejectionReason : null,
      },
      select: {
        brandVerificationStatus: true,
        userId: true,
        companyName: true,
        user: {
          select: {
            email: true,
            name: true,
            preferredLanguage: true,
            emailNotifications: true,
            emailCampaignUpdates: true,
            emailCollaborationUpdates: true,
          },
        },
      },
    })

    // Early-stage promo: newly verified users get a free PRO trial
    let trialGranted = false
    if (action === 'APPROVE') {
      trialGranted = await grantVerifiedTrial(updated.userId)
    }

    // Notify the brand by email (fire-and-forget; never blocks the response)
    const recipient = { ...updated.user }
    if (action === 'APPROVE') {
      void sendVerificationApprovedEmail(recipient, { companyName: updated.companyName })
    } else {
      void sendVerificationRejectedEmail(recipient, {
        companyName: updated.companyName,
        rejectionReason,
      })
    }

    return NextResponse.json({ success: true, status: updated.brandVerificationStatus, trialGranted })
  } catch (error) {
    console.error('Error updating brand verification:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
