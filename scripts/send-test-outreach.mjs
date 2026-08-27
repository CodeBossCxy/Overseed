// TEMP: one-off preview of the club-contact outreach email template.
// Usage: node scripts/send-test-outreach.mjs [classic|minimal]
import { Resend } from 'resend'
import { readFileSync } from 'node:fs'

const variant = process.argv[2] || 'minimal'
// Inline (cid) logo so the test renders before the asset is deployed to overseed.net.
const logoPng = readFileSync(new URL('../public/email-logo-overseed.png', import.meta.url))

const to = 'iamcaitlyn0531@gmail.com'
const brandName = 'Aurora Beauty'
const message = `Hi there,

We love your content and think you'd be a great fit for our upcoming campaign. We're launching something exciting and would love to have you on board.

Please take a look at the brief and product information attached.
We can't wait to hear your thoughts!

Best,
Aurora Beauty Team`

const minimalPdf = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
xref
0 4
0000000000 65535 f
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`
)

const attachments = [
  { filename: 'Campaign Brief.pdf', content: minimalPdf },
  { filename: 'Product Info.pdf', content: minimalPdf },
]

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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

const html = `
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
`

const minimalHtml = `
  <div style="background:#ffffff;padding:24px 12px;">
    <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <p style="font-size:13px;color:#757575;margin:0 0 28px;">Collaboration invitation via <a href="${SITE}" style="color:#757575;">Overseed</a></p>
      <h1 style="font-size:28px;line-height:1.3;font-weight:700;margin:0 0 6px;color:#1a1a1a;">${esc(brandName)} would like to collaborate with you</h1>
      <p style="font-size:15px;color:#616161;margin:0 0 28px;">A message from ${esc(brandName)}</p>
      <div style="font-size:16px;line-height:1.7;color:#1a1a1a;white-space:pre-wrap;">${esc(message)}</div>
      <p style="font-size:15px;font-weight:700;margin:28px 0 6px;">Attached</p>
      ${attachments.map((a) => `<p style="font-size:15px;margin:0 0 4px;color:#1a1a1a;">&#128206;&nbsp; ${esc(a.filename)}</p>`).join('')}
      <p style="font-size:16px;margin:28px 0 8px;"><a href="${SITE}" style="color:#1a73e8;font-weight:600;text-decoration:none;">View &amp; respond on Overseed &rarr;</a></p>
      <p style="font-size:14px;color:#757575;margin:0 0 4px;">Prefer email? Simply reply to this message &mdash; it goes straight to ${esc(brandName)}.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0 20px;"/>
      <img src="cid:overseed-logo" alt="Overseed" width="121" height="39" style="display:block;border:0;margin:0 0 10px;" />
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
  `Attached: ${attachments.map((a) => a.filename).join(', ')}`,
  '',
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

const resend = new Resend(process.env.RESEND_API_KEY)
const { data, error } = await resend.emails.send({
  from: `Overseed <${process.env.EMAIL_FROM}>`,
  to,
  subject: `${brandName} would like to collaborate with you`,
  attachments: [
    ...attachments,
    { filename: 'overseed-logo.png', content: logoPng, contentId: 'overseed-logo' },
  ],
  text: minimalText,
  html: variant === 'minimal' ? minimalHtml : html,
})
if (error) {
  console.error('FAILED:', error)
  process.exit(1)
}
console.log('Sent:', data)
