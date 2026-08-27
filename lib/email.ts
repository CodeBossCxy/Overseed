import { Resend } from 'resend'

let resend: Resend

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const VERIFICATION_NOTIFY_EMAIL = 'xinyi@overseed.net'

export interface VerificationSubmission {
  companyName: string
  accountType: string
  businessLegalName: string
  businessRegistrationNo: string
  businessCountry: string
  businessWebsite?: string
  contactName: string
  contactJobTitle?: string
  contactEmail: string
  contactPhone?: string
  documentUrls: string[]
  userEmail: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendVerificationSubmittedEmail(submission: VerificationSubmission) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://overseed.net'

  const rows: [string, string][] = [
    ['Company (display name)', submission.companyName],
    ['Account Type', submission.accountType],
    ['Legal Business Name', submission.businessLegalName],
    ['Registration Number', submission.businessRegistrationNo],
    ['Country / Region of Registration', submission.businessCountry],
    ['Business Website', submission.businessWebsite || '—'],
    ['Contact Name', submission.contactName],
    ['Job Title', submission.contactJobTitle || '—'],
    ['Work Email', submission.contactEmail],
    ['Contact Phone', submission.contactPhone || '—'],
    ['Account Email', submission.userEmail],
  ]

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 8px 12px; color: #6B7280; font-size: 13px; white-space: nowrap; vertical-align: top;">${escapeHtml(label)}</td>
          <td style="padding: 8px 12px; color: #111827; font-size: 13px;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('')

  const docsHtml = submission.documentUrls.length
    ? submission.documentUrls
        .map((url, i) => {
          const absolute = url.startsWith('http') ? url : `${baseUrl}${url}`
          return `<li style="margin-bottom: 4px;"><a href="${escapeHtml(absolute)}" style="color: #4F46E5; font-size: 13px;">Document ${i + 1}</a></li>`
        })
        .join('')
    : '<li style="color: #6B7280; font-size: 13px;">No documents uploaded</li>'

  await getResend().emails.send({
    from: `Overseed <${process.env.EMAIL_FROM}>`,
    to: VERIFICATION_NOTIFY_EMAIL,
    subject: `[Verification] New business verification: ${submission.businessLegalName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #4F46E5; font-size: 24px; margin-bottom: 8px;">Overseed</h1>
        <p style="color: #374151; font-size: 15px; margin-bottom: 20px;">
          A brand has submitted a business verification request.
        </p>
        <table style="width: 100%; border-collapse: collapse; background: #F9FAFB; border-radius: 8px; margin-bottom: 20px;">
          ${rowsHtml}
        </table>
        <p style="color: #374151; font-size: 14px; font-weight: bold; margin-bottom: 8px;">Uploaded documents</p>
        <ul style="margin: 0 0 24px; padding-left: 18px;">${docsHtml}</ul>
        <a href="${baseUrl}/admin" style="display: inline-block; background: #4F46E5; color: #ffffff; font-size: 14px; font-weight: bold; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
          Review in Admin Dashboard
        </a>
      </div>
    `,
  })
}

export async function sendOTPEmail(to: string, otp: string, locale: string = 'en') {
  const isZh = locale === 'zh'

  const subject = isZh
    ? '您的 Overseed 验证码'
    : 'Your Overseed verification code'

  const bodyText = isZh
    ? '请输入以下验证码来验证您的邮箱地址：'
    : 'Enter the following code to verify your email address:'

  const expiryText = isZh
    ? '此验证码将在10分钟后过期。如果您没有请求此验证码，请忽略此邮件。'
    : 'This code expires in 10 minutes. If you didn\'t request this, you can safely ignore this email.'

  await getResend().emails.send({
    from: `Overseed <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #4F46E5; font-size: 28px; margin-bottom: 8px;">Overseed</h1>
        <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
          ${bodyText}
        </p>
        <div style="background: #F3F4F6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111827;">${otp}</span>
        </div>
        <p style="color: #6B7280; font-size: 14px;">
          ${expiryText}
        </p>
      </div>
    `,
  })
}
