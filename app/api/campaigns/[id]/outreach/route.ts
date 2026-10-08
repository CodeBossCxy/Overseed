import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits, hasPriorCharge, gateFeature } from '@/lib/metering'
import { discoveryEnrichForOutreach } from '@/lib/discovery-provider'
import { sendOutreachBatch, type OutreachEmailInput } from '@/lib/outreach-email'

async function ownedCampaign(id: string, userId: string) {
  return prisma.campaign.findFirst({
    where: { id, brand: { userId } },
    select: { id: true, title: true },
  })
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  const { id } = await params
  if (!(await ownedCampaign(id, (session.user as any).id))) {
    return NextResponse.json({ message: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
  }
  const queue = await prisma.campaignOutreach.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ queue })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  const userId = (session.user as any).id
  const { id } = await params

  const campaign = await ownedCampaign(id, userId)
  if (!campaign) {
    return NextResponse.json({ message: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
  }

  const body = await req.json()

  // ── action: send — enrich, charge, email all PENDING_REVIEW creators ──
  if (body.action === 'send') {
    return handleSend(id, userId, campaign, body.briefMessage)
  }

  // ── action: request — transition SHORTLISTED → PENDING_REVIEW ──
  if (body.action === 'request') {
    await prisma.campaignOutreach.updateMany({
      where: { campaignId: id, status: 'SHORTLISTED' },
      data: { status: 'PENDING_REVIEW', requestedAt: new Date() },
    })
  } else {
    // ── default: upsert a creator into the shortlist ──
    if (!body.creator?.id || !body.creator?.platform) {
      return NextResponse.json({ message: 'Creator is required', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const c = body.creator
    await prisma.campaignOutreach.upsert({
      where: { campaignId_externalCreatorId: { campaignId: id, externalCreatorId: c.id } },
      create: {
        campaignId: id, externalCreatorId: c.id, platform: c.platform,
        handle: c.handle || null, displayName: c.display_name || null,
        avatarUrl: c.avatar_url || null, followerCount: c.follower_count ?? null,
        engagementRate: c.engagement_rate == null ? null : Number(c.engagement_rate),
        country: c.country || null, nicheTags: Array.isArray(c.niche_tags) ? c.niche_tags.slice(0, 12) : [],
      },
      update: {},
    })
  }

  const queue = await prisma.campaignOutreach.findMany({ where: { campaignId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ queue })
}

// ── Send pipeline for campaign outreach ────────────────────────────────────────
// Mirrors the mass-outreach send flow: enrich → charge → email → track.
async function handleSend(
  campaignId: string,
  userId: string,
  campaign: { id: string; title: string | null },
  briefMessage?: string,
) {
  const pending = await prisma.campaignOutreach.findMany({
    where: { campaignId, status: 'PENDING_REVIEW' },
  })
  if (pending.length === 0) {
    return NextResponse.json({ message: 'No creators pending review', code: 'NO_RECIPIENTS' }, { status: 400 })
  }

  // Need a brief message to send
  if (!briefMessage || typeof briefMessage !== 'string' || briefMessage.trim().length < 10) {
    return NextResponse.json(
      { message: 'briefMessage is required (min 10 chars)', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  const [brand, user] = await Promise.all([
    prisma.brandProfile.findUnique({ where: { userId }, select: { companyName: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
  ])
  if (!brand || !user?.email) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  // Mark all as SENDING to prevent concurrent sends
  await prisma.campaignOutreach.updateMany({
    where: { campaignId, status: 'PENDING_REVIEW' },
    data: { status: 'SENDING' },
  })

  // Enrich each creator to get contact emails
  const enriched: { entry: typeof pending[0]; email: string }[] = []
  const noEmail: typeof pending = []

  for (const entry of pending) {
    if (!entry.handle) {
      noEmail.push(entry)
      continue
    }
    try {
      const result = await discoveryEnrichForOutreach(entry.platform, entry.handle, { logUserId: userId })
      if (result.email) {
        enriched.push({ entry, email: result.email })
      } else {
        noEmail.push(entry)
      }
    } catch {
      noEmail.push(entry)
    }
  }

  // Mark creators with no email as FAILED
  if (noEmail.length > 0) {
    await Promise.all(
      noEmail.map((e) =>
        prisma.campaignOutreach.update({
          where: { id: e.id },
          data: { status: 'FAILED', errorMessage: 'No contact email found' },
        }),
      ),
    )
  }

  if (enriched.length === 0) {
    return NextResponse.json({
      totalSent: 0,
      totalFailed: noEmail.length,
      creditsCost: 0,
      message: 'No contact emails found for any creators',
    })
  }

  // Billing: pre-flight credit charge per creator (shared profile_view dedup)
  let totalCreditsCost = 0
  const chargeResults: Map<string, { cost: number; refund: () => Promise<void> } | null> = new Map()

  if (CREDIT_SYSTEM_ENABLED) {
    for (const { entry } of enriched) {
      const unlockRef = `profile_view:${entry.platform}:${entry.handle!.toLowerCase()}`
      const alreadyUnlocked = await hasPriorCharge(userId, unlockRef)

      if (alreadyUnlocked) {
        const gate = await gateFeature(userId, 'outreach')
        if (!gate.ok) {
          // Roll back charges made so far
          for (const [, charge] of chargeResults) {
            if (charge) await charge.refund().catch(() => {})
          }
          // Revert statuses back to PENDING_REVIEW
          await prisma.campaignOutreach.updateMany({
            where: { campaignId, status: 'SENDING' },
            data: { status: 'PENDING_REVIEW' },
          })
          return NextResponse.json(gate.body, { status: gate.status })
        }
        chargeResults.set(entry.id, null)
      } else {
        const ref = `campaign_outreach:${campaignId}:${entry.handle!.toLowerCase()}`
        const charge = await chargeCredits(userId, 'outreach', ref)
        if (!charge.ok) {
          for (const [, prior] of chargeResults) {
            if (prior) await prior.refund().catch(() => {})
          }
          await prisma.campaignOutreach.updateMany({
            where: { campaignId, status: 'SENDING' },
            data: { status: 'PENDING_REVIEW' },
          })
          return NextResponse.json(charge.body, { status: charge.status })
        }
        totalCreditsCost += charge.cost
        chargeResults.set(entry.id, { cost: charge.cost, refund: charge.refund })
      }
    }
  }

  // Send emails
  const brandName = brand.companyName || user.name || 'A brand on Overseed'
  const inputs: OutreachEmailInput[] = enriched.map(({ entry, email }) => ({
    recipientEmail: email,
    recipientName: entry.displayName,
    brandName,
    brandEmail: user.email!,
    briefMessage: briefMessage.trim(),
    platform: entry.platform,
    handle: entry.handle!,
    campaignId,
  }))

  const results = await sendOutreachBatch(inputs)

  let totalSent = 0
  let totalFailed = noEmail.length

  await Promise.all(
    enriched.map(async ({ entry }) => {
      const result = results.get(entry.handle!)
      const success = result?.success ?? false

      await prisma.campaignOutreach.update({
        where: { id: entry.id },
        data: {
          status: success ? 'SENT' : 'FAILED',
          sentAt: success ? new Date() : null,
          errorMessage: success ? null : (result?.error ?? 'Unknown error'),
        },
      })

      if (success) {
        totalSent++
        // Create a conversation so the brand can see the outreach in Messages
        await prisma.conversation.create({
          data: {
            participants: { create: [{ userId }] },
            messages: {
              create: [{
                senderId: userId,
                content: briefMessage.trim(),
                isSystemMessage: true,
                messageType: 'outreach',
              }],
            },
          },
        }).catch(() => {})
      } else {
        totalFailed++
        // Refund credits for failed sends
        if (CREDIT_SYSTEM_ENABLED) {
          const charge = chargeResults.get(entry.id)
          if (charge) await charge.refund().catch(() => {})
        }
      }
    }),
  )

  return NextResponse.json({ totalSent, totalFailed, creditsCost: totalCreditsCost })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  const { id } = await params
  if (!(await ownedCampaign(id, (session.user as any).id))) {
    return NextResponse.json({ message: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
  }
  const outreachId = req.nextUrl.searchParams.get('outreachId')
  if (!outreachId) return NextResponse.json({ message: 'outreachId is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  await prisma.campaignOutreach.deleteMany({ where: { id: outreachId, campaignId: id, status: 'SHORTLISTED' } })
  const queue = await prisma.campaignOutreach.findMany({ where: { campaignId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ queue })
}
