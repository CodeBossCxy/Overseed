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
const MAX_FILE_BYTES = 5 * 1024 * 1024
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
        { message: `"${f.name}" exceeds the 5MB attachment limit` },
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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: `Overseed <${process.env.EMAIL_FROM}>`,
      to,
      replyTo: user.email,
      subject: `${brandName} would like to collaborate with you`,
      attachments,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #DB2777; font-size: 24px; margin-bottom: 4px;">Overseed</h1>
          <p style="color: #6B7280; font-size: 13px; margin: 0 0 24px;">Brand & creator collaborations</p>
          <p style="color: #111827; font-size: 15px;">
            <strong>${esc(brandName)}</strong> found your ${esc(platform)} profile and sent you a message:
          </p>
          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin: 16px 0; color: #374151; font-size: 15px; white-space: pre-wrap;">${esc(message)}</div>
          ${attachments.length ? `<p style="color: #6B7280; font-size: 13px;">${attachments.length} attachment(s) included.</p>` : ''}
          <p style="color: #374151; font-size: 14px; margin-top: 24px;">
            Reply to this email to respond, or join
            <a href="https://www.overseed.net" style="color: #DB2777;">Overseed</a>
            to manage collaborations, contracts and payments in one place.
          </p>
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
