import { Resend } from 'resend'

let resend: Resend

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

type Locale = 'en' | 'zh'
type Localized = { en: string; zh: string }

export interface NotificationRecipient {
  email: string
  name?: string | null
  preferredLanguage?: string | null
  emailNotifications: boolean
  emailCampaignUpdates: boolean
  emailCollaborationUpdates: boolean
}

export interface StatusEmailOptions {
  recipient: NotificationRecipient
  category: 'campaign' | 'collaboration'
  subject: Localized
  title: Localized
  intro: Localized
  details?: { label: Localized; value: string | null | undefined }[]
  note?: { label: Localized; value: string }
  cta: { label: Localized; path: string }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const FOOTER: Localized = {
  en: "You're receiving this because you have email notifications enabled. Manage preferences in Settings.",
  zh: '您收到此邮件是因为您已开启邮件通知。可在设置中管理通知偏好。',
}

// Sends a branded status-change email. Respects the recipient's notification
// preferences and NEVER throws — failures are logged and swallowed so email
// delivery can never break an API response.
export async function sendStatusEmail(opts: StatusEmailOptions) {
  try {
    const { recipient } = opts
    if (!recipient?.email) return
    if (!recipient.emailNotifications) return
    if (opts.category === 'campaign' && !recipient.emailCampaignUpdates) return
    if (opts.category === 'collaboration' && !recipient.emailCollaborationUpdates) return

    const locale: Locale = recipient.preferredLanguage === 'zh' ? 'zh' : 'en'
    const t = (s: Localized) => s[locale]
    const baseUrl = process.env.NEXTAUTH_URL || 'https://overseed.net'
    const ctaUrl = opts.cta.path.startsWith('http') ? opts.cta.path : `${baseUrl}${opts.cta.path}`

    const detailRows = (opts.details || [])
      .filter((row) => row.value)
      .map(
        (row) => `
          <tr>
            <td style="padding: 8px 12px; color: #6B7280; font-size: 13px; white-space: nowrap; vertical-align: top;">${escapeHtml(t(row.label))}</td>
            <td style="padding: 8px 12px; color: #111827; font-size: 13px;">${escapeHtml(row.value!)}</td>
          </tr>`
      )
      .join('')

    const noteBlock = opts.note
      ? `
        <div style="background: #FEF3C7; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
          <p style="color: #92400E; font-size: 13px; font-weight: bold; margin: 0 0 4px;">${escapeHtml(t(opts.note.label))}</p>
          <p style="color: #78350F; font-size: 13px; margin: 0;">${escapeHtml(opts.note.value)}</p>
        </div>`
      : ''

    await getResend().emails.send({
      from: `Overseed <${process.env.EMAIL_FROM}>`,
      to: opts.recipient.email,
      subject: t(opts.subject),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
          <img src="${baseUrl}/email-logo-overseed.png" alt="Overseed" style="height:32px">
          <h1 style="color: #111827; font-size: 20px; margin: 24px 0 8px;">${escapeHtml(t(opts.title))}</h1>
          <p style="color: #6B7280; font-size: 14px; margin-bottom: 20px;">${escapeHtml(t(opts.intro))}</p>
          ${detailRows ? `
          <table style="width: 100%; border-collapse: collapse; background: #F9FAFB; border-radius: 8px; margin-bottom: 20px;">
            ${detailRows}
          </table>` : ''}
          ${noteBlock}
          <div style="margin-bottom: 28px;">
            <a href="${ctaUrl}" style="display: inline-block; background: #4F46E5; color: #ffffff; font-size: 14px; font-weight: bold; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
              ${escapeHtml(t(opts.cta.label))}
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; border-top: 1px solid #E5E7EB; padding-top: 16px;">
            ${escapeHtml(t(FOOTER))}
          </p>
        </div>
      `,
    })
  } catch (error) {
    console.error('Failed to send status notification email:', error)
  }
}

const CAMPAIGN_LABEL: Localized = { en: 'Campaign', zh: '任务' }
const BRAND_LABEL: Localized = { en: 'Brand', zh: '品牌' }
const CREATOR_LABEL: Localized = { en: 'Creator', zh: '创作者' }

// ---- Application events (category: campaign) ----

export function sendApplicationApprovedEmail(
  recipient: NotificationRecipient,
  info: { campaignTitle: string; brandName: string | null | undefined }
) {
  return sendStatusEmail({
    recipient,
    category: 'campaign',
    subject: {
      en: `Your application was accepted — ${info.campaignTitle}`,
      zh: `您的申请已通过 — ${info.campaignTitle}`,
    },
    title: { en: 'Application accepted', zh: '申请已通过' },
    intro: {
      en: 'Good news — the brand has accepted your application. You can now discuss collaboration details.',
      zh: '好消息 — 品牌已接受您的申请，您现在可以沟通合作细节了。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: BRAND_LABEL, value: info.brandName },
    ],
    cta: {
      label: { en: 'View application', zh: '查看申请' },
      path: '/dashboard/influencer/applications',
    },
  })
}

export function sendApplicationRejectedEmail(
  recipient: NotificationRecipient,
  info: { campaignTitle: string; brandName: string | null | undefined; rejectionReason?: string | null }
) {
  return sendStatusEmail({
    recipient,
    category: 'campaign',
    subject: {
      en: `Update on your application — ${info.campaignTitle}`,
      zh: `申请状态更新 — ${info.campaignTitle}`,
    },
    title: { en: 'Application not selected', zh: '申请未通过' },
    intro: {
      en: 'Unfortunately, the brand did not select your application this time.',
      zh: '很遗憾，品牌这次没有选择您的申请。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: BRAND_LABEL, value: info.brandName },
    ],
    note: info.rejectionReason
      ? { label: { en: 'Reason', zh: '原因' }, value: info.rejectionReason }
      : undefined,
    cta: {
      label: { en: 'Browse more campaigns', zh: '浏览更多任务' },
      path: '/dashboard/influencer/applications',
    },
  })
}

export function sendApplicationSubmittedEmail(
  recipient: NotificationRecipient,
  info: { campaignId: string; campaignTitle: string; creatorName: string | null | undefined }
) {
  return sendStatusEmail({
    recipient,
    category: 'campaign',
    subject: {
      en: `New application — ${info.campaignTitle}`,
      zh: `新的申请 — ${info.campaignTitle}`,
    },
    title: { en: 'New application received', zh: '收到新的申请' },
    intro: {
      en: 'A creator has applied to your campaign.',
      zh: '一位创作者申请了您的任务。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: CREATOR_LABEL, value: info.creatorName },
    ],
    cta: {
      label: { en: 'Review application', zh: '审核申请' },
      path: `/dashboard/brand/campaigns/${info.campaignId}/applications`,
    },
  })
}

export function sendCampaignCancelledEmail(
  recipient: NotificationRecipient,
  info: { campaignTitle: string; brandName: string | null | undefined }
) {
  return sendStatusEmail({
    recipient,
    category: 'campaign',
    subject: {
      en: `Campaign cancelled — ${info.campaignTitle}`,
      zh: `任务已取消 — ${info.campaignTitle}`,
    },
    title: { en: 'Campaign cancelled', zh: '任务已取消' },
    intro: {
      en: 'A campaign you applied to has been cancelled by the brand.',
      zh: '您申请的一个任务已被品牌取消。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: BRAND_LABEL, value: info.brandName },
    ],
    cta: {
      label: { en: 'View your applications', zh: '查看我的申请' },
      path: '/dashboard/influencer/applications',
    },
  })
}

// ---- Collaboration events (category: collaboration) ----

export function sendCollaborationAcceptedEmail(
  recipient: NotificationRecipient,
  info: { collaborationId: string; campaignTitle: string; creatorName: string | null | undefined }
) {
  return sendStatusEmail({
    recipient,
    category: 'collaboration',
    subject: {
      en: `Collaboration accepted — ${info.campaignTitle}`,
      zh: `合作已接受 — ${info.campaignTitle}`,
    },
    title: { en: 'Collaboration accepted', zh: '合作已接受' },
    intro: {
      en: 'The creator has accepted the collaboration terms. The collaboration is now active.',
      zh: '创作者已接受合作条款，合作现已开始。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: CREATOR_LABEL, value: info.creatorName },
    ],
    cta: {
      label: { en: 'View collaboration', zh: '查看合作' },
      path: `/dashboard/brand/collaborations/${info.collaborationId}`,
    },
  })
}

export function sendCollaborationDeclinedEmail(
  recipient: NotificationRecipient,
  info: { collaborationId: string; campaignTitle: string; creatorName: string | null | undefined }
) {
  return sendStatusEmail({
    recipient,
    category: 'collaboration',
    subject: {
      en: `Collaboration declined — ${info.campaignTitle}`,
      zh: `合作已被拒绝 — ${info.campaignTitle}`,
    },
    title: { en: 'Collaboration declined', zh: '合作已被拒绝' },
    intro: {
      en: 'The creator has declined the collaboration terms. The campaign slot has been freed.',
      zh: '创作者拒绝了合作条款，该任务名额已释放。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: CREATOR_LABEL, value: info.creatorName },
    ],
    cta: {
      label: { en: 'View collaboration', zh: '查看合作' },
      path: `/dashboard/brand/collaborations/${info.collaborationId}`,
    },
  })
}

export function sendWorkSubmittedEmail(
  recipient: NotificationRecipient,
  info: { collaborationId: string; campaignTitle: string; creatorName: string | null | undefined }
) {
  return sendStatusEmail({
    recipient,
    category: 'collaboration',
    subject: {
      en: `Work submitted for review — ${info.campaignTitle}`,
      zh: `作品已提交审核 — ${info.campaignTitle}`,
    },
    title: { en: 'Work submitted for review', zh: '作品已提交审核' },
    intro: {
      en: 'The creator has submitted their work. Please review and approve or request a revision.',
      zh: '创作者已提交作品，请审核并批准或提出修改要求。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: CREATOR_LABEL, value: info.creatorName },
    ],
    cta: {
      label: { en: 'Review submission', zh: '审核作品' },
      path: `/dashboard/brand/collaborations/${info.collaborationId}`,
    },
  })
}

export function sendWorkApprovedEmail(
  recipient: NotificationRecipient,
  info: { collaborationId: string; campaignTitle: string; brandName: string | null | undefined }
) {
  return sendStatusEmail({
    recipient,
    category: 'collaboration',
    subject: {
      en: `Work approved — ${info.campaignTitle}`,
      zh: `作品已通过 — ${info.campaignTitle}`,
    },
    title: { en: 'Work approved — collaboration complete', zh: '作品已通过 — 合作完成' },
    intro: {
      en: 'The brand has approved your work. The collaboration is now complete.',
      zh: '品牌已通过您的作品，合作已完成。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: BRAND_LABEL, value: info.brandName },
    ],
    cta: {
      label: { en: 'View collaboration', zh: '查看合作' },
      path: `/dashboard/influencer/collaborations/${info.collaborationId}`,
    },
  })
}

export function sendRevisionRequestedEmail(
  recipient: NotificationRecipient,
  info: {
    collaborationId: string
    campaignTitle: string
    brandName: string | null | undefined
    reviewNote?: string | null
  }
) {
  return sendStatusEmail({
    recipient,
    category: 'collaboration',
    subject: {
      en: `Revision requested — ${info.campaignTitle}`,
      zh: `修改要求 — ${info.campaignTitle}`,
    },
    title: { en: 'Revision requested', zh: '品牌提出修改要求' },
    intro: {
      en: 'The brand has reviewed your submission and requested changes.',
      zh: '品牌已审核您的作品并提出修改要求。',
    },
    details: [
      { label: CAMPAIGN_LABEL, value: info.campaignTitle },
      { label: BRAND_LABEL, value: info.brandName },
    ],
    note: info.reviewNote
      ? { label: { en: 'Revision note', zh: '修改说明' }, value: info.reviewNote }
      : undefined,
    cta: {
      label: { en: 'View collaboration', zh: '查看合作' },
      path: `/dashboard/influencer/collaborations/${info.collaborationId}`,
    },
  })
}

export function sendCollaborationCancelledEmail(
  recipient: NotificationRecipient,
  info: {
    collaborationId: string
    campaignTitle: string
    recipientRole: 'brand' | 'creator'
  }
) {
  return sendStatusEmail({
    recipient,
    category: 'collaboration',
    subject: {
      en: `Collaboration cancelled — ${info.campaignTitle}`,
      zh: `合作已取消 — ${info.campaignTitle}`,
    },
    title: { en: 'Collaboration cancelled', zh: '合作已取消' },
    intro: {
      en: 'The other party has cancelled this collaboration.',
      zh: '对方已取消此次合作。',
    },
    details: [{ label: CAMPAIGN_LABEL, value: info.campaignTitle }],
    cta: {
      label: { en: 'View collaboration', zh: '查看合作' },
      path:
        info.recipientRole === 'brand'
          ? `/dashboard/brand/collaborations/${info.collaborationId}`
          : `/dashboard/influencer/collaborations/${info.collaborationId}`,
    },
  })
}
