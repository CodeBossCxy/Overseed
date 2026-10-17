import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Resend } from 'resend'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits, hasPriorCharge, gateFeature } from '@/lib/metering'
import { discoveryEnrichForOutreach, resolveCreatorEmail } from '@/lib/discovery-provider'
import { sendOutreachBatch, type OutreachEmailInput } from '@/lib/outreach-email'

const OPS_EMAIL = 'xinyi@overseed.net'

const PROFILE_URL: Record<string, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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

  const contentType = req.headers.get('content-type') || ''
  let body: any = {}
  let formMessage: string | null = null
  let formFiles: File[] = []

  if (contentType.includes('multipart/form-data')) {
    const fd = await req.formData()
    const creatorRaw = fd.get('creator')
    if (creatorRaw) {
      try { body.creator = JSON.parse(String(creatorRaw)) } catch {}
    }
    const actionRaw = fd.get('action')
    if (actionRaw) body.action = String(actionRaw)
    const msgRaw = fd.get('message')
    if (msgRaw) formMessage = String(msgRaw).trim()
    formFiles = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  } else {
    body = await req.json()
  }

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
    try {
      await prisma.campaignOutreach.upsert({
        where: { campaignId_externalCreatorId: { campaignId: id, externalCreatorId: c.id } },
        create: {
          campaignId: id, externalCreatorId: c.id, platform: c.platform,
          handle: c.handle || null, displayName: c.display_name || null,
          avatarUrl: c.avatar_url || null, followerCount: c.follower_count ?? null,
          engagementRate: c.engagement_rate == null ? null : Number(c.engagement_rate),
          country: c.country || null, nicheTags: Array.isArray(c.niche_tags) ? c.niche_tags.slice(0, 12) : [],
          message: formMessage || null,
        },
        update: { message: formMessage || undefined },
      })
    } catch (dbErr) {
      console.error('[campaign outreach] upsert failed:', dbErr)
      return NextResponse.json({ message: 'Failed to save creator to queue', code: 'DB_ERROR' }, { status: 500 })
    }

    // ── Notify ops team when a message is included ──
    if (formMessage && formMessage.length >= 10) {
      const normalizedHandle = (c.handle || c.id).replace(/^@/, '').toLowerCase()
      const [brand, user, contactResult] = await Promise.all([
        prisma.brandProfile.findUnique({ where: { userId }, select: { companyName: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
        resolveCreatorEmail(c.platform, normalizedHandle),
      ])
      if (brand && user?.email) {
        const brandName = brand.companyName || user.name || 'A brand on Overseed'
        const handle = c.handle || c.id
        const profileUrl = PROFILE_URL[c.platform]?.(handle.replace(/^@/, '')) || `${c.platform}:${handle}`
        const displayName = c.display_name || handle
        const emailStatus = contactResult.email
          ? `✅ Found: ${contactResult.email}`
          : contactResult.hasEmail === true
            ? '⚠️ Has email but fetch failed'
            : contactResult.hasEmail === false
              ? '❌ No email found'
              : '❓ Unknown — not checked yet'
        const attachments = await Promise.all(
          formFiles.map(async (f) => ({
            filename: f.name,
            content: Buffer.from(await f.arrayBuffer()),
          }))
        )
        const html = `
<div style="font-family:sans-serif;max-width:700px;margin:0 auto;">
  <h2 style="color:#1F2A44;">Campaign Outreach Request</h2>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:140px;">Campaign</td><td style="padding:8px 12px;">${esc(campaign.title || id)}</td></tr>
    <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Brand</td><td style="padding:8px 12px;">${esc(brandName)} (${esc(user.email)})</td></tr>
    <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Creator</td><td style="padding:8px 12px;"><a href="${esc(profileUrl)}" style="color:#2563eb;text-decoration:none;">@${esc(handle.replace(/^@/, ''))}</a> (${esc(c.platform)})</td></tr>
    <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Display Name</td><td style="padding:8px 12px;">${esc(displayName)}</td></tr>
    <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Email Reachable</td><td style="padding:8px 12px;">${emailStatus}</td></tr>
    <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Attachments</td><td style="padding:8px 12px;">${attachments.length > 0 ? attachments.map((a) => esc(a.filename)).join(', ') : 'None'}</td></tr>
  </table>
  <h3 style="color:#1F2A44;margin:24px 0 8px;">Brand's Message</h3>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.7;white-space:pre-wrap;">${esc(formMessage)}</div>
  <p style="margin-top:24px;color:#6b7280;font-size:12px;">This is an automated notification from Overseed. Please reach out to the creator on behalf of the brand.</p>
</div>`
        try {
          const resend = new Resend(process.env.RESEND_API_KEY)
          const { error } = await resend.emails.send({
            from: `Overseed Ops <${process.env.EMAIL_FROM}>`,
            to: OPS_EMAIL,
            replyTo: user.email,
            subject: `[Campaign Outreach] ${brandName} → @${handle.replace(/^@/, '')} (${c.platform})`,
            html,
            attachments,
          })
          if (error) console.error('[campaign outreach] resend error:', error)
        } catch (err) {
          console.error('[campaign outreach] failed to send notification email:', err)
        }
      }
    }
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
