import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Collaboration as CollaborationSM, assertTransition, type CollaborationStatus } from '@/lib/status'

async function loadCollaboration(id: string) {
  return prisma.collaboration.findUnique({
    where: { id },
    include: {
      campaign: { select: { id: true, title: true, images: true } },
      brand: { select: { id: true, userId: true, companyName: true, logoUrl: true } },
      influencer: { select: { id: true, userId: true, displayName: true, avatarUrl: true } },
      application: { select: { id: true } },
      deliverableItems: true,
      payment: true,
    },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const collaboration = await loadCollaboration(id)
  if (!collaboration) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const isBrand = collaboration.brand.userId === userId
  const isCreator = collaboration.influencer.userId === userId
  if (!isBrand && !isCreator) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ collaboration, viewerRole: isBrand ? 'brand' : 'creator' })
}

// PATCH: drive the collaboration lifecycle. Body: { action, ...payload }.
// creator: accept | decline | submit    brand: approve | request_revision
// either: cancel | dispute
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id

    const collaboration = await loadCollaboration(id)
    if (!collaboration) return NextResponse.json({ message: 'Not found' }, { status: 404 })

    const isBrand = collaboration.brand.userId === userId
    const isCreator = collaboration.influencer.userId === userId
    if (!isBrand && !isCreator) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { action } = body
    const current = collaboration.status as CollaborationStatus

    const creatorActions = ['accept', 'decline', 'submit', 'upload_draft']
    const brandActions = ['approve', 'request_revision']
    if (creatorActions.includes(action) && !isCreator) {
      return NextResponse.json({ message: 'Only the creator can perform this action' }, { status: 403 })
    }
    if (brandActions.includes(action) && !isBrand) {
      return NextResponse.json({ message: 'Only the brand can perform this action' }, { status: 403 })
    }

    let next: CollaborationStatus | null = null
    const data: any = {}

    switch (action) {
      case 'accept': // creator accepts locked terms → Active
        next = 'ACTIVE'
        data.confirmedAt = new Date()
        data.termsLockedAt = collaboration.termsLockedAt ?? new Date()
        break
      case 'decline': // creator declines → Cancelled
        next = 'CANCELLED'
        data.cancelledAt = new Date()
        break
      case 'upload_draft': {
        // Creator uploads a draft for brand feedback; status stays Active
        if (current !== 'ACTIVE') {
          return NextResponse.json(
            { message: 'Drafts can only be uploaded while the collaboration is Active' },
            { status: 400 },
          )
        }
        if (!body.fileUrl) {
          return NextResponse.json({ message: 'fileUrl is required' }, { status: 400 })
        }
        const deliverable = await prisma.collaborationDeliverable.create({
          data: {
            collaborationId: id,
            title: body.title || 'Draft',
            type: 'draft',
            status: 'submitted',
            fileUrl: body.fileUrl,
            note: body.note || null,
            submittedAt: new Date(),
          },
        })
        return NextResponse.json({ deliverable })
      }
      case 'submit': // creator submits deliverables + published evidence → Submitted
        next = 'SUBMITTED'
        data.submittedAt = new Date()
        if (body.publishedUrl !== undefined) data.publishedUrl = body.publishedUrl
        if (body.publishedPlatform !== undefined) data.publishedPlatform = body.publishedPlatform
        if (body.publishedAt !== undefined) data.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null
        if (body.evidenceScreenshot !== undefined) data.evidenceScreenshot = body.evidenceScreenshot
        break
      case 'approve': // brand approves submission → Completed
        next = 'COMPLETED'
        data.completedAt = new Date()
        break
      case 'request_revision': // brand requests changes → back to Active
        if (collaboration.revisionsUsed >= collaboration.revisionRounds) {
          return NextResponse.json(
            { message: 'No revision rounds remaining' },
            { status: 400 },
          )
        }
        next = 'ACTIVE'
        data.revisionsUsed = { increment: 1 }
        data.reviewNote = body.reviewNote ?? null
        break
      case 'cancel':
        next = 'CANCELLED'
        data.cancelledAt = new Date()
        break
      case 'dispute':
        // A dispute is tracked as a timestamp; the payment carries the DISPUTED state.
        data.disputedAt = new Date()
        break
      default:
        return NextResponse.json({ message: 'Unknown action' }, { status: 400 })
    }

    if (next) {
      try {
        assertTransition(CollaborationSM, 'Collaboration', current, next)
      } catch {
        return NextResponse.json(
          { message: `Cannot ${action} a collaboration that is ${current}` },
          { status: 400 },
        )
      }
      data.status = next
    }

    const updated = await prisma.$transaction(async (tx) => {
      const col = await tx.collaboration.update({ where: { id }, data })
      // When the brand approves, the underlying application is Completed too.
      if (action === 'approve') {
        await tx.application.update({
          where: { id: collaboration.applicationId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
      }
      // A creator declining frees the campaign slot.
      if (action === 'decline' || action === 'cancel') {
        await tx.campaign.update({
          where: { id: collaboration.campaignId },
          data: { filledSlots: { decrement: 1 } },
        }).catch(() => {})
      }
      return col
    })

    return NextResponse.json({ collaboration: updated })
  } catch (error) {
    console.error('Error updating collaboration:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
