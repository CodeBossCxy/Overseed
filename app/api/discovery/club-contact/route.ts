import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Resend } from 'resend'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { containsBannedContent } from '@/lib/message-filter'
import { getCreatorContactEmail, type ClubPlatform } from '@/lib/influencers-club'

// TEMP: POST /api/discovery/club-contact — brand outreach to an influencers.club
// creator. The creator's email lives only in the server-side cache populated by
// club-enrich; it is never sent to the browser. Outreach goes out via Resend
// from EMAIL_FROM with Reply-To set to the brand account's email.
// Set CLUB_OUTREACH_TEST_RECIPIENT to reroute ALL outreach to a test inbox
// (recommended for local dev). Remove with the other TEMP club pieces.

const MAX_FILES = 3
const MAX_FILE_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
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
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const form = await req.formData()
  const platform = String(form.get('platform') || '') as ClubPlatform
  const handle = String(form.get('handle') || '').trim()
  const message = String(form.get('message') || '').trim()

  if (!platform || !handle) {
    return NextResponse.json({ message: 'platform and handle required' }, { status: 400 })
  }
  if (message.length < 10 || message.length > 2000) {
    return NextResponse.json(
      { message: 'Message must be between 10 and 2000 characters' },
      { status: 400 }
    )
  }
  // Same policy as in-app messages: no off-platform contact info
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
    return NextResponse.json({ message: `At most ${MAX_FILES} attachments` }, { status: 400 })
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { message: `"${f.name}" exceeds the 4MB attachment limit` },
        { status: 400 }
      )
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      return NextResponse.json(
        { message: `"${f.name}": only images and PDF are supported` },
        { status: 400 }
      )
    }
  }

  const creatorEmail = getCreatorContactEmail(platform, handle)
  if (!creatorEmail) {
    return NextResponse.json(
      { message: 'This creator cannot be reached yet', code: 'NOT_REACHABLE' },
      { status: 404 }
    )
  }

  const to = process.env.CLUB_OUTREACH_TEST_RECIPIENT || creatorEmail
  const brandName = brand.companyName || user.name || 'A brand on Overseed'

  const attachments = await Promise.all(
    files.map(async (f) => ({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()),
    }))
  )

  const SITE = 'https://www.overseed.net'
  const attachmentRows = attachments
    .map((a) => {
      const isPdf = /\.pdf$/i.test(a.filename)
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFD;border:1px solid #E3EAF4;border-radius:12px;margin:0 0 10px;">
          <tr>
            <td style="padding:14px 16px;width:44px;vertical-align:middle;">
              <div style="width:36px;height:42px;background:#7B9FE0;border-radius:6px;text-align:center;">
                <span style="display:inline-block;padding-top:14px;font-family:Arial,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;letter-spacing:1px;">${isPdf ? 'PDF' : 'FILE'}</span>
              </div>
            </td>
            <td style="padding:14px 8px;vertical-align:middle;">
              <span style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#1F2A44;">${esc(a.filename)}</span><br/>
              <span style="font-family:Arial,sans-serif;font-size:13px;color:#7B9FE0;">View attachment</span>
            </td>
            <td style="padding:14px 16px;width:16px;vertical-align:middle;text-align:right;">
              <span style="font-family:Arial,sans-serif;font-size:16px;color:#9AA9C4;">&#8250;</span>
            </td>
          </tr>
        </table>`
    })
    .join('')

  // Variant 'minimal': newsletter-like, text-first layout (fewer promo signals,
  // more likely to land in Gmail Primary). Default 'classic' = designed template.
  const variant = String(form.get('variant') || 'classic')

  const minimalHtml = `
    <div style="background:#ffffff;padding:24px 12px;">
      <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
        <p style="font-size:13px;color:#757575;margin:0 0 28px;">Collaboration invitation via <a href="${SITE}" style="color:#757575;">Overseed</a></p>
        <h1 style="font-size:28px;line-height:1.3;font-weight:700;margin:0 0 6px;color:#1a1a1a;">${esc(brandName)} would like to collaborate with you</h1>
        <p style="font-size:15px;color:#616161;margin:0 0 28px;">A message from ${esc(brandName)}</p>
        <div style="font-size:16px;line-height:1.7;color:#1a1a1a;white-space:pre-wrap;">${esc(message)}</div>
        ${
          attachments.length
            ? `<p style="font-size:15px;font-weight:700;margin:28px 0 6px;">Attached</p>${attachments
                .map(
                  (a) =>
                    `<p style="font-size:15px;margin:0 0 4px;color:#1a1a1a;">&#128206;&nbsp; ${esc(a.filename)}</p>`
                )
                .join('')}`
            : ''
        }
        <p style="font-size:16px;margin:28px 0 8px;"><a href="${SITE}" style="color:#1a73e8;font-weight:600;text-decoration:none;">View &amp; respond on Overseed &rarr;</a></p>
        <p style="font-size:14px;color:#757575;margin:0 0 4px;">Prefer email? Simply reply to this message &mdash; it goes straight to ${esc(brandName)}.</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0 20px;"/>
        <img src="${SITE}/email-logo-overseed.png" alt="Overseed" width="161" height="32" style="display:block;border:0;margin:0 0 10px;" />
        <p style="font-size:14px;line-height:1.6;color:#424242;margin:0 0 2px;"><strong>The Overseed Team</strong></p>
        <p style="font-size:13px;line-height:1.6;color:#757575;margin:0 0 2px;">Overseed is a collaboration platform where brands discover creators, then manage briefs, content and payments in one place.</p>
        <p style="font-size:13px;line-height:1.6;margin:0 0 14px;"><a href="${SITE}" style="color:#1a73e8;text-decoration:none;">overseed.net</a></p>
        <p style="font-size:12px;color:#9e9e9e;line-height:1.6;margin:0;">This email was sent by Overseed on behalf of ${esc(brandName)}.</p>
      </div>
    </div>`

  const minimalText = [
    `${brandName} would like to collaborate with you`,
    '',
    message,
    '',
    ...(attachments.length ? [`Attached: ${attachments.map((a) => a.filename).join(', ')}`, ''] : []),
    `View & respond on Overseed: ${SITE}`,
    `Prefer email? Simply reply to this message — it goes straight to ${brandName}.`,
    '',
    '—',
    'The Overseed Team',
    'Overseed is a collaboration platform where brands discover creators, then manage briefs, content and payments in one place.',
    'https://www.overseed.net',
    '',
    `This email was sent by Overseed on behalf of ${brandName}.`,
  ].join('\n')

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: `Overseed <${process.env.EMAIL_FROM}>`,
      to,
      replyTo: user.email,
      subject: `${brandName} would like to collaborate with you`,
      attachments,
      text: minimalText,
      html: variant === 'minimal' ? minimalHtml : `
        <div style="background:#EEF2F7;padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#F4F7FB;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="background:#DCE7F5 url('${SITE}/home/hero-bridge.png') right center / cover no-repeat;padding:32px 28px 60px;">
                <img src="${SITE}/blue_logo_with_txt.png" alt="Overseed" width="170" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 8px;text-align:center;">
                <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:14px;color:#7B9FE0;">&#10022;&nbsp; Collaboration invitation via Overseed</p>
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.25;font-weight:bold;color:#1F2A44;">${esc(brandName)} would like<br/>to collaborate with you</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;">
                  <tr>
                    <td style="padding:28px;">
                      <h2 style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:18px;color:#1F2A44;">A message from ${esc(brandName)}</h2>
                      <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#374151;white-space:pre-wrap;">${esc(message)}</div>
                      ${attachments.length ? `<hr style="border:none;border-top:1px solid #E9EEF6;margin:24px 0;" />${attachmentRows}` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;text-align:center;">
                <a href="${SITE}" style="display:inline-block;background:#7BA3E8;color:#FFFFFF;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;text-decoration:none;padding:16px 44px;border-radius:999px;">View &amp; Respond on Overseed&nbsp;&nbsp;&#8599;</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 4px;text-align:center;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#6B7A99;">Create a free account to communicate with the brand,<br/>view files and manage the collaboration in one place.</p>
                <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:14px;color:#7B9FE0;">&#9993;&nbsp; Prefer email? Simply reply to this message.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 32px;text-align:center;border-top:1px solid #E3EAF4;">
                <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#8A98B5;">
                  This email was sent by Overseed on behalf of ${esc(brandName)}.<br/>
                  Overseed helps brands and creators connect and manage collaborations.<br/>
                  <a href="${SITE}" style="color:#8A98B5;">Overseed</a>
                  &nbsp;&middot;&nbsp;
                  <a href="${SITE}/terms" style="color:#8A98B5;">Terms</a>
                  &nbsp;&middot;&nbsp;
                  <a href="${SITE}/contact" style="color:#8A98B5;">Unsubscribe</a>
                </p>
              </td>
            </tr>
          </table>
        </div>
      `,
    })
    if (error) throw new Error(error.message)
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'Failed to send message' },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true })
}
