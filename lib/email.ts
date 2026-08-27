import { Resend } from 'resend'

let resend: Resend

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const VERIFICATION_NOTIFY_EMAIL = 'xinyi@overseed.net'

export interface VerificationEmailInput {
  companyName: string
  submission: Record<string, any>
  userEmail: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const FIELD_LABELS: Record<string, string> = {
  type: 'Account Type',
  country: 'Country / Region of Registration',
  brandProof: 'Brand or Store Proof',
  business: 'Business Information',
  companyProof: 'Company Proof',
  applicantAuth: 'Applicant Authority Verification',
  agency: 'Agency Business Information',
  contact: 'Contact Information',
  authProof: 'Proof of Authorisation',
  method: 'Method',
  brandName: 'Brand Name',
  storeName: 'Store Name',
  registryLink: 'Registry Link',
  legalName: 'Legal Name',
  creditCode: 'Unified Social Credit Code',
  registrationNo: 'Registration Number',
  stateProvince: 'Country / State / Province',
  legalRepName: 'Legal Representative Name',
  legalRepIdNo: 'Legal Representative ID Number',
  applicantName: 'Applicant Name',
  applicantPosition: 'Position',
  declaration: 'Truth Declaration Signed',
  tin: 'Tax Number (TIN)',
  website: 'Website',
  representedBrand: 'Brand Being Represented',
  brandWebsite: 'Brand Website',
  fullName: 'Full Name',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  docUrls: 'Documents',
}

const METHOD_LABELS: Record<string, string> = {
  trademark: 'Brand name + trademark certificate / authorisation',
  store: 'Store name + seller dashboard screenshot',
  document: 'Uploaded document',
  face: 'Legal representative identity verification',
  letter: 'Authorisation letter',
  director: 'Director / Officer verification',
  tin: 'Company tax number (TIN)',
  brandEmail: 'Brand company-email confirmation',
  chat: 'Communication records with the brand',
  registryLink: 'Government registry page link',
}

export async function sendVerificationSubmittedEmail(input: VerificationEmailInput) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://overseed.net'

  const renderValue = (key: string, value: any): string => {
    if (key === 'docUrls' && Array.isArray(value)) {
      if (value.length === 0) return '—'
      return value
        .map((url: string, i: number) => {
          const absolute = url.startsWith('http') ? url : `${baseUrl}${url}`
          return `<a href="${escapeHtml(absolute)}" style="color: #4F46E5;">Document ${i + 1}</a>`
        })
        .join(' · ')
    }
    if (key === 'method') return escapeHtml(METHOD_LABELS[value] || String(value))
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return escapeHtml(String(value))
  }

  const renderRows = (obj: Record<string, any>, indent = false): string =>
    Object.entries(obj)
      .filter(([, val]) => val !== undefined && val !== null && val !== '')
      .map(([key, val]) => {
        const label = FIELD_LABELS[key] || key
        if (typeof val === 'object' && !Array.isArray(val)) {
          return `
            <tr><td colspan="2" style="padding: 12px 12px 4px; color: #111827; font-size: 13px; font-weight: bold;">${escapeHtml(label)}</td></tr>
            ${renderRows(val, true)}`
        }
        return `
          <tr>
            <td style="padding: 4px 12px 4px ${indent ? '24px' : '12px'}; color: #6B7280; font-size: 13px; white-space: nowrap; vertical-align: top;">${escapeHtml(label)}</td>
            <td style="padding: 4px 12px; color: #111827; font-size: 13px;">${renderValue(key, val)}</td>
          </tr>`
      })
      .join('')

  const typeLabel =
    input.submission.type === 'agency'
      ? 'Agency / PR'
      : input.submission.type === 'individual_pr'
        ? 'Individual PR Representative'
        : 'Brand / Merchant'

  const subjectName =
    input.submission.business?.legalName ||
    input.submission.agency?.legalName ||
    input.submission.fullName ||
    input.companyName

  await getResend().emails.send({
    from: `Overseed <${process.env.EMAIL_FROM}>`,
    to: VERIFICATION_NOTIFY_EMAIL,
    subject: `[Verification] ${typeLabel}: ${subjectName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #4F46E5; font-size: 24px; margin-bottom: 8px;">Overseed</h1>
        <p style="color: #374151; font-size: 15px; margin-bottom: 20px;">
          A new <strong>${escapeHtml(typeLabel)}</strong> verification request has been submitted.
        </p>
        <table style="width: 100%; border-collapse: collapse; background: #F9FAFB; border-radius: 8px; margin-bottom: 8px;">
          <tr>
            <td style="padding: 8px 12px; color: #6B7280; font-size: 13px;">Company (display name)</td>
            <td style="padding: 8px 12px; color: #111827; font-size: 13px;">${escapeHtml(input.companyName)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px; color: #6B7280; font-size: 13px;">Account Email</td>
            <td style="padding: 4px 12px; color: #111827; font-size: 13px;">${escapeHtml(input.userEmail)}</td>
          </tr>
          ${renderRows(input.submission)}
        </table>
        <div style="margin-top: 20px;">
          <a href="${baseUrl}/admin" style="display: inline-block; background: #4F46E5; color: #ffffff; font-size: 14px; font-weight: bold; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
            Review in Admin Dashboard
          </a>
        </div>
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
