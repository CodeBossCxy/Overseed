import { NextRequest, NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

// POST /api/outreach/submit — save outreach campaign with selected creators,
// then asynchronously look up contact info and email results to the ops team.
// No enrichment or automated emailing happens synchronously — just a fast save.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true, companyName: true },
  })
  if (!brand) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await req.json()
  const { title, briefMessage, platform, criteria, collaborationDetails, creators } = body

  if (!title?.trim() || !briefMessage?.trim()) {
    return NextResponse.json({ message: 'Title and message are required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!Array.isArray(creators) || creators.length === 0) {
    return NextResponse.json({ message: 'At least one creator must be selected', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Create the outreach campaign
  const campaign = await prisma.outreachCampaign.create({
    data: {
      userId,
      brandId: brand.id,
      title: title.trim(),
      briefMessage: briefMessage.trim(),
      quantity: creators.length,
      platform: platform || 'instagram',
      criteria: criteria || {},
      collaborationDetails: collaborationDetails || {},
      status: 'READY',
    },
  })

  // Save each selected creator as a recipient (status: PENDING)
  await Promise.all(
    creators.map(async (c: any) => {
      const handle = (c.handle || '').replace(/^@/, '').toLowerCase()
      if (!handle) return

      // Upsert CreatorProfile so we have a foreign key target
      const profile = await prisma.creatorProfile.upsert({
        where: { platform_handle: { platform: c.platform || platform, handle } },
        create: {
          platform: c.platform || platform,
          handle,
          displayName: c.displayName || null,
          avatarUrl: c.avatarUrl || null,
          followerCount: typeof c.followerCount === 'number' ? c.followerCount : null,
          engagementRate: typeof c.engagementRate === 'number' ? c.engagementRate : null,
          country: c.country || null,
          nicheTags: Array.isArray(c.nicheTags) ? c.nicheTags : [],
        },
        update: {
          displayName: c.displayName || undefined,
          avatarUrl: c.avatarUrl || undefined,
          followerCount: typeof c.followerCount === 'number' ? c.followerCount : undefined,
        },
      })

      await prisma.outreachRecipient.upsert({
        where: {
          outreachCampaignId_handle: { outreachCampaignId: campaign.id, handle },
        },
        create: {
          outreachCampaignId: campaign.id,
          creatorProfileId: profile.id,
          platform: c.platform || platform,
          handle,
          displayName: c.displayName || null,
          avatarUrl: c.avatarUrl || null,
          followerCount: typeof c.followerCount === 'number' ? c.followerCount : null,
          engagementRate: typeof c.engagementRate === 'number' ? c.engagementRate : null,
          status: 'PENDING',
        },
        update: {},
      })
    })
  )

  // Background: look up contact info and email results to ops team
  const campaignId = campaign.id
  const brandName = brand.companyName || 'Brand'
  const userEmail = (session.user as any).email || ''
  after(async () => {
    try {
      await lookupContactsAndNotify(campaignId, brandName, userEmail, platform)
    } catch (err) {
      console.error('[outreach-submit] Background contact lookup failed:', err)
    }
  })

  return NextResponse.json({ campaign: { id: campaign.id } })
}

// ── Background: look up contacts and email results ──────────────────────────

async function lookupContactsAndNotify(
  campaignId: string,
  brandName: string,
  userEmail: string,
  platform: string,
) {
  const recipients = await prisma.outreachRecipient.findMany({
    where: { outreachCampaignId: campaignId },
    select: { id: true, handle: true, displayName: true, platform: true, followerCount: true },
  })

  // Try to find contact info from existing caches first
  const results: { handle: string; displayName: string | null; platform: string; followers: number | null; email: string | null }[] = []

  for (const r of recipients) {
    let email: string | null = null

    // Check CreatorProfile cache
    const profile = await prisma.creatorProfile.findUnique({
      where: { platform_handle: { platform: r.platform, handle: r.handle } },
      select: { email: true },
    })
    if (profile?.email) {
      email = profile.email
    }

    // Check enrichment cache
    if (!email) {
      const cached = await prisma.creatorEnrichmentCache
        .findUnique({
          where: { platform_handle: { platform: r.platform, handle: r.handle } },
          select: { data: true },
        })
        .catch(() => null)
      if (cached?.data && typeof cached.data === 'object') {
        const data = cached.data as any
        if (data.email) email = data.email
        if (!email && data._email) email = data._email
      }
    }

    // Optionally: call CreatorDB Contact API here if you want to spend 15 credits
    // For now, we skip paid enrichment — ops team will handle manually

    // Update recipient with found email
    if (email) {
      await prisma.outreachRecipient.update({
        where: { id: r.id },
        data: { email },
      }).catch(() => {})
    }

    results.push({
      handle: r.handle,
      displayName: r.displayName,
      platform: r.platform,
      followers: r.followerCount,
      email,
    })
  }

  // Update campaign status
  await prisma.outreachCampaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })

  // Email results to ops team
  const apiKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM
  if (!apiKey || !emailFrom) {
    console.warn('[outreach-submit] Cannot send notification — RESEND_API_KEY or EMAIL_FROM not set')
    return
  }

  const resend = new Resend(apiKey)

  const found = results.filter((r) => r.email)
  const notFound = results.filter((r) => !r.email)

  const tableRows = results.map((r) => {
    const followers = r.followers ? (r.followers >= 1_000_000 ? `${(r.followers / 1_000_000).toFixed(1)}M` : r.followers >= 1_000 ? `${Math.round(r.followers / 1_000)}K` : String(r.followers)) : '—'
    return `<tr>
      <td style="padding:8px;border:1px solid #e5e7eb">${r.displayName || r.handle}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">@${r.handle}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">${r.platform}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">${followers}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">${r.email || '<span style="color:#ef4444">N/A</span>'}</td>
    </tr>`
  }).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
      <h2>New Mass Outreach Submitted</h2>
      <p><strong>Brand:</strong> ${brandName} (${userEmail})</p>
      <p><strong>Campaign:</strong> ${campaignId}</p>
      <p><strong>Platform:</strong> ${platform}</p>
      <p><strong>Total creators:</strong> ${results.length} (${found.length} with email, ${notFound.length} without)</p>

      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Name</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Handle</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Platform</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Followers</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Email</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <p style="margin-top:16px;color:#6b7280;font-size:12px">
        This is an automated notification from Overseed Mass Outreach.
        Please reach out to the creators manually using the contact information above.
      </p>
    </div>
  `

  try {
    await resend.emails.send({
      from: `Overseed Ops <${emailFrom}>`,
      to: 'xinyi@overseed.net',
      subject: `[Outreach] ${brandName} — ${results.length} creators (${found.length} with email)`,
      html,
    })
    console.log(`[outreach-submit] Notification email sent for campaign ${campaignId}`)
  } catch (err) {
    console.error('[outreach-submit] Failed to send notification email:', err)
  }
}
