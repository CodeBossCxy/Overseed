import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { resolveCreatorEmail } from '@/lib/discovery-provider'

// Extract email addresses from a bio/text string
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
function extractEmailFromBio(bio: string | null | undefined): string | null {
  if (!bio) return null
  const matches = bio.match(EMAIL_RE)
  return matches?.[0] || null
}

export const maxDuration = 30

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

      // Extract email from bio if available
      const bioEmail = extractEmailFromBio(c.bio)

      // Upsert CreatorProfile so we have a foreign key target
      const profile = await prisma.creatorProfile.upsert({
        where: { platform_handle: { platform: c.platform || platform, handle } },
        create: {
          platform: c.platform || platform,
          handle,
          displayName: c.displayName || null,
          avatarUrl: c.avatarUrl || null,
          bio: c.bio || null,
          email: bioEmail,
          followerCount: typeof c.followerCount === 'number' ? c.followerCount : null,
          engagementRate: typeof c.engagementRate === 'number' ? c.engagementRate : null,
          country: c.country || null,
          nicheTags: Array.isArray(c.nicheTags) ? c.nicheTags : [],
        },
        update: {
          displayName: c.displayName || undefined,
          avatarUrl: c.avatarUrl || undefined,
          bio: c.bio || undefined,
          email: bioEmail || undefined,
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
          email: bioEmail || profile.email,
          status: 'PENDING',
        },
        update: {},
      })
    })
  )

  // Look up contact info (scrape bios) and email results to ops team.
  // Done synchronously so the notification email contains scraped emails.
  // Adds ~5-10s to the response time but the user sees a spinner anyway.
  const campaignId = campaign.id
  const brandName = brand.companyName || 'Brand'
  const userEmail = (session.user as any).email || ''
  try {
    await lookupContactsAndNotify(campaignId, brandName, userEmail, platform)
  } catch (err) {
    console.error('[outreach-submit] Contact lookup failed:', err)
  }

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
    select: { id: true, handle: true, displayName: true, platform: true, followerCount: true, email: true },
  })

  // Try to find contact info from existing caches
  const results: { handle: string; displayName: string | null; platform: string; followers: number | null; email: string | null; hasEmail: boolean | null; emailSource: 'bio' | 'db' | 'cache' | 'contact-api' | 'cap' | 'none'; profileUrl: string | null }[] = []

  const PROFILE_URL: Record<string, (h: string) => string> = {
    instagram: (h) => `https://www.instagram.com/${h}/`,
    youtube: (h) => `https://www.youtube.com/@${h}`,
    tiktok: (h) => `https://www.tiktok.com/@${h}`,
  }

  // Step 1: Check DB caches first (free, instant), then call resolveCreatorEmail (capped at 10 /contact API calls)
  const CONTACT_API_CAP = 10
  let contactApiFetchCount = 0

  for (const r of recipients) {
    let email: string | null = r.email || null
    let emailSource: 'bio' | 'db' | 'cache' | 'contact-api' | 'cap' | 'none' = 'none'
    let hasEmail: boolean | null = null

    if (email) {
      emailSource = 'bio'
      hasEmail = true
    }

    if (!email) {
      const profile = await prisma.creatorProfile.findUnique({
        where: { platform_handle: { platform: r.platform, handle: r.handle } },
        select: { email: true },
      })
      if (profile?.email) {
        email = profile.email
        emailSource = 'db'
        hasEmail = true
      }
    }

    if (!email) {
      const cached = await prisma.creatorEnrichmentCache
        .findUnique({
          where: { platform_handle: { platform: r.platform, handle: r.handle } },
          select: { data: true },
        })
        .catch(() => null)
      if (cached?.data && typeof cached.data === 'object') {
        const data = cached.data as any
        const cacheEmail = data.email || data._email || null
        if (cacheEmail) {
          email = cacheEmail
          emailSource = 'cache'
          hasEmail = true
        }
      }
    }

    if (!email) {
      if (contactApiFetchCount < CONTACT_API_CAP) {
        try {
          const resolved = await resolveCreatorEmail(r.platform, r.handle)
          email = resolved.email
          hasEmail = resolved.hasEmail
          emailSource = resolved.source === 'contact-api' ? 'contact-api' : resolved.source === 'cache' ? 'cache' : 'none'
          if (resolved.source === 'contact-api') contactApiFetchCount++
        } catch (err) {
          console.error(`[outreach-submit] resolveCreatorEmail failed for ${r.handle}:`, err)
          emailSource = 'none'
          hasEmail = null
        }
      } else {
        // Cap reached — show cache status without fetching
        emailSource = 'cap'
        hasEmail = null
      }
    }

    const profileUrl = PROFILE_URL[r.platform]?.(r.handle) || null
    results.push({ handle: r.handle, displayName: r.displayName, platform: r.platform, followers: r.followerCount, email, hasEmail, emailSource, profileUrl })
  }

  // Note: Bio scraping from Instagram is blocked on datacenter IPs (Vercel).
  // The notification email includes clickable profile links for manual lookup.
  // TODO: Add optional CreatorDB Profile API enrichment (2 credits/creator) as a future toggle.

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
    const handleCell = r.profileUrl
      ? `<a href="${r.profileUrl}" style="color:#2563eb;text-decoration:none">@${r.handle}</a>`
      : `@${r.handle}`
    let emailCell: string
    if (r.email) {
      emailCell = `<span style="color:#16a34a">${r.email}</span>`
    } else if (r.emailSource === 'cap') {
      emailCell = `<span style="color:#d97706">not fetched (cap)</span>`
    } else {
      emailCell = `<span style="color:#ef4444">N/A</span>`
    }
    let hasEmailCell: string
    if (r.hasEmail === true) {
      hasEmailCell = `<span style="color:#16a34a">true</span>`
    } else if (r.hasEmail === false) {
      hasEmailCell = `<span style="color:#ef4444">false</span>`
    } else if (r.emailSource === 'cap') {
      hasEmailCell = `<span style="color:#d97706">unknown (cap)</span>`
    } else {
      hasEmailCell = `<span style="color:#6b7280">unknown</span>`
    }
    return `<tr>
      <td style="padding:8px;border:1px solid #e5e7eb">${r.displayName || r.handle}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">${handleCell}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">${r.platform}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">${followers}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">${hasEmailCell}</td>
      <td style="padding:8px;border:1px solid #e5e7eb">${emailCell}</td>
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
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">hasEmail</th>
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
