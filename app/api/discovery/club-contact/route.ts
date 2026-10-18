import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Resend } from 'resend'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { containsBannedContent } from '@/lib/message-filter'
import { type ClubPlatform } from '@/lib/influencers-club'
import { resolveCreatorEmail } from '@/lib/discovery-provider'
import { consumeQuota, releaseQuota } from '@/lib/plan'
import { getEffectiveTier } from '@/lib/subscription'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits, gateFeature } from '@/lib/metering'

// POST /api/discovery/club-contact — brand requests outreach to a creator.
// Instead of emailing the creator directly, we notify the Overseed team at
// xinyi@overseed.net with all details so they can reach out manually.

const MAX_FILES = 3
const MAX_FILE_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

const OPS_EMAIL = 'xinyi@overseed.net'
const OUTREACH_COST = 2

const PROFILE_URL: Record<string, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const [brand, user] = await Promise.all([
    prisma.brandProfile.findUnique({
      where: { userId },
      select: { companyName: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
  ])
  if (!brand || !user) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const form = await req.formData()
  const platform = String(form.get('platform') || '') as ClubPlatform
  const handle = String(form.get('handle') || '').trim()
  const message = String(form.get('message') || '').trim()

  if (!platform || !handle) {
    return NextResponse.json({ message: 'platform and handle required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (message.length < 10 || message.length > 2000) {
    return NextResponse.json(
      { message: 'Message must be between 10 and 2000 characters', code: 'MESSAGE_LENGTH' },
      { status: 400 }
    )
  }
  if (containsBannedContent(message)) {
    return NextResponse.json(
      {
        message:
          'Message contains contact info or off-platform links, which are not allowed.',
        code: 'BANNED_CONTENT',
      },
      { status: 422 }
    )
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length > MAX_FILES) {
    return NextResponse.json({ message: `At most ${MAX_FILES} attachments`, code: 'ATTACHMENT_TOO_MANY' }, { status: 400 })
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { message: `"${f.name}" exceeds the 4MB attachment limit`, code: 'ATTACHMENT_TOO_LARGE' },
        { status: 400 }
      )
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      return NextResponse.json(
        { message: `"${f.name}": only images and PDF are supported`, code: 'ATTACHMENT_TYPE' },
        { status: 400 }
      )
    }
  }

  // Try to find creator's email via shared cache + CreatorDB.
  // resolveCreatorEmail handles all caching internally.
  let creatorEmail: string | null = null
  let creatorHasEmail: boolean | null = null
  try {
    const resolved = await resolveCreatorEmail(platform, handle)
    creatorEmail = resolved.email
    creatorHasEmail = resolved.hasEmail
  } catch {
    // Non-critical — team notification will note that email is missing
  }

  // ── Billing: 5 credits per outreach request ──
  let outreachCharge: { refund: () => Promise<void> } | null = null
  let quota: { ok: boolean; used: number; limit: number; usageId?: string } | null = null
  if (CREDIT_SYSTEM_ENABLED) {
    const ref = `outreach:${platform}:${handle.toLowerCase()}:${userId}:${Date.now()}`
    const gate = await gateFeature(userId, 'outreach')
    if (!gate.ok) {
      return NextResponse.json(gate.body, { status: gate.status })
    }
    const charge = await chargeCredits(userId, 'outreach', ref, { costOverride: OUTREACH_COST })
    if (!charge.ok) {
      return NextResponse.json(charge.body, { status: charge.status })
    }
    outreachCharge = charge
  } else {
    const tier = await getEffectiveTier(userId)
    quota = await consumeQuota(userId, tier, 'outreach')
    if (!quota.ok) {
      return NextResponse.json(
        {
          message:
            quota.limit === 0
              ? 'Managed outreach is not included in your plan. Upgrade to contact creators directly.'
              : 'Monthly outreach limit reached. Upgrade your plan for more outreach.',
          code: 'OUTREACH_QUOTA_EXCEEDED',
          used: quota.used,
          limit: quota.limit,
        },
        { status: 402 }
      )
    }
  }

  const brandName = brand.companyName || user.name || 'A brand on Overseed'
  const profileUrl = PROFILE_URL[platform]?.(handle) || `${platform}:${handle}`

  const attachments = await Promise.all(
    files.map(async (f) => ({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()),
    }))
  )

  // ── Notify Overseed team ──
  let emailStatus: string
  if (creatorEmail) {
    emailStatus = `<span style="color:#16a34a;font-weight:bold;">&#x2705; Found: ${esc(creatorEmail)}</span>`
  } else if (creatorHasEmail === true) {
    emailStatus = `<span style="color:#d97706;font-weight:bold;">&#x26A0;&#xFE0F; Has email but fetch failed</span>`
  } else if (creatorHasEmail === false) {
    emailStatus = `<span style="color:#dc2626;font-weight:bold;">&#x274C; No email found</span>`
  } else {
    emailStatus = `<span style="color:#6b7280;font-weight:bold;">&#x2753; Unknown — not checked yet</span>`
  }

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto;">
      <h2 style="color:#1F2A44;">New Creator Contact Request</h2>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:140px;">Brand</td>
          <td style="padding:8px 12px;">${esc(brandName)} (${esc(user.email || '')})</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Creator</td>
          <td style="padding:8px 12px;">
            <a href="${esc(profileUrl)}" style="color:#2563eb;text-decoration:none;">@${esc(handle)}</a>
            (${platform})
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Creator Email</td>
          <td style="padding:8px 12px;">${emailStatus}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Attachments</td>
          <td style="padding:8px 12px;">${attachments.length > 0 ? attachments.map((a) => esc(a.filename)).join(', ') : 'None'}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;">Credits Charged</td>
          <td style="padding:8px 12px;">${OUTREACH_COST}</td>
        </tr>
      </table>

      <h3 style="color:#1F2A44;margin:24px 0 8px;">Brand's Message</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.7;white-space:pre-wrap;">${esc(message)}</div>

      <p style="margin-top:24px;color:#6b7280;font-size:12px;">
        This is an automated notification from Overseed. Please reach out to the creator on behalf of the brand.
      </p>
    </div>
  `

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: `Overseed Ops <${process.env.EMAIL_FROM}>`,
      to: OPS_EMAIL,
      replyTo: user.email || undefined,
      subject: `[Outreach] ${brandName} → @${handle} (${platform})`,
      html,
      attachments,
    })
    if (error) throw new Error(error.message)
  } catch (err: any) {
    // Send failed — refund credits
    if (outreachCharge) {
      try {
        await outreachCharge.refund()
      } catch (refundErr) {
        console.error('Outreach credit refund failed:', refundErr)
      }
    }
    if (quota?.usageId) {
      try {
        await releaseQuota(quota.usageId)
      } catch (releaseErr) {
        console.error('Quota release failed:', releaseErr)
      }
    }
    return NextResponse.json(
      { message: err?.message || 'Failed to submit outreach request', code: 'UPSTREAM_ERROR' },
      { status: 502 }
    )
  }

  await prisma.pageViewEvent
    .create({ data: { userId, path: 'action:club-outreach' } })
    .catch(() => {})

  return NextResponse.json({ success: true })
}
