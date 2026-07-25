import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Application as ApplicationSM, assertTransition, type ApplicationStatus } from '@/lib/status'

// GET /api/collaborations?role=brand|creator&status=ACTIVE
// Lists collaborations for the signed-in user's side.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') === 'creator' ? 'creator' : 'brand'
  const status = searchParams.get('status') || undefined
  const campaignId = searchParams.get('campaignId') || undefined

  const where: any = {}
  if (status) where.status = status
  if (campaignId) where.campaignId = campaignId

  if (role === 'brand') {
    const brand = await prisma.brandProfile.findUnique({ where: { userId }, select: { id: true } })
    if (!brand) return NextResponse.json({ collaborations: [] })
    where.brandId = brand.id
  } else {
    const influencer = await prisma.influencerProfile.findUnique({ where: { userId }, select: { id: true } })
    if (!influencer) return NextResponse.json({ collaborations: [] })
    where.influencerId = influencer.id
  }

  const collaborations = await prisma.collaboration.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      campaign: { select: { id: true, title: true, images: true } },
      influencer: { select: { id: true, displayName: true, avatarUrl: true, user: { select: { name: true, image: true } } } },
      brand: { select: { id: true, companyName: true, logoUrl: true } },
      payment: { select: { status: true, amount: true, currency: true } },
    },
  })

  return NextResponse.json({ collaborations })
}

// POST /api/collaborations
// Brand selects a creator: locks the offer terms and creates a Collaboration
// in AWAITING_CONFIRMATION, moving the Application to APPROVED (Selected).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const body = await req.json()
    const { applicationId } = body
    if (!applicationId) {
      return NextResponse.json({ message: 'applicationId is required' }, { status: 400 })
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        campaign: { include: { brand: { select: { id: true, userId: true } } } },
        influencer: { select: { id: true, userId: true } },
        collaboration: { select: { id: true } },
      },
    })
    if (!application) {
      return NextResponse.json({ message: 'Application not found' }, { status: 404 })
    }
    // Only the campaign owner (brand) may select.
    if (application.campaign.brand.userId !== userId) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
    if (application.collaboration) {
      return NextResponse.json({ message: 'Collaboration already exists for this application' }, { status: 409 })
    }

    // Guard the Application transition (Applied/Under Review → Selected).
    try {
      assertTransition(ApplicationSM, 'Application', application.status as ApplicationStatus, 'APPROVED')
    } catch {
      return NextResponse.json(
        { message: `Cannot select a creator whose application is ${application.status}` },
        { status: 400 },
      )
    }

    const collaboration = await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: { status: 'APPROVED', approvedAt: new Date(), reviewedAt: new Date() },
      })
      await tx.campaign.update({
        where: { id: application.campaignId },
        data: { filledSlots: { increment: 1 } },
      })

      // Ensure a conversation exists so the two sides can talk.
      const existing = await tx.conversation.findUnique({ where: { applicationId } })
      if (!existing) {
        await tx.conversation.create({
          data: {
            applicationId,
            participants: {
              createMany: {
                data: [
                  { userId: application.campaign.brand.userId },
                  { userId: application.influencer.userId },
                ],
              },
            },
          },
        })
      }

      return tx.collaboration.create({
        data: {
          campaignId: application.campaignId,
          applicationId,
          influencerId: application.influencerId,
          brandId: application.campaign.brand.id,
          status: 'AWAITING_CONFIRMATION',
          deliverables: body.deliverables ?? null,
          fee: body.fee != null ? body.fee : null,
          currency: body.currency ?? 'USD',
          productCompensation: body.productCompensation ?? null,
          deadline: body.deadline ? new Date(body.deadline) : null,
          revisionRounds: body.revisionRounds != null ? Number(body.revisionRounds) : 2,
          usageRights: body.usageRights ?? null,
        },
      })
    })

    return NextResponse.json({ collaboration }, { status: 201 })
  } catch (error) {
    console.error('Error creating collaboration:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
