import { Resend } from 'resend'

// Mass outreach email sending with rate limiting and tracking.

let resend: Resend

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface OutreachEmailInput {
  recipientEmail: string
  recipientName: string | null
  brandName: string
  brandEmail: string
  briefMessage: string
  platform: string
  handle: string
}

export interface OutreachEmailResult {
  success: boolean
  error?: string
}

function buildHtml(input: OutreachEmailInput): string {
  const brandName = esc(input.brandName)
  const briefMessage = esc(input.briefMessage)
  return `<div style="background:#ffffff;padding:24px 12px;">
  <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <p style="font-size:13px;color:#757575;margin:0 0 28px;">Collaboration invitation via <a href="https://www.overseed.net" style="color:#757575;">Overseed</a></p>
    <h1 style="font-size:28px;line-height:1.3;font-weight:700;margin:0 0 6px;color:#1a1a1a;">${brandName} would like to collaborate with you</h1>
    <p style="font-size:15px;color:#616161;margin:0 0 28px;">A message from ${brandName}</p>
    <div style="font-size:16px;line-height:1.7;color:#1a1a1a;white-space:pre-wrap;">${briefMessage}</div>
    <p style="font-size:16px;margin:28px 0 8px;"><a href="https://www.overseed.net" style="color:#1a73e8;font-weight:600;text-decoration:none;">View &amp; respond on Overseed →</a></p>
    <p style="font-size:14px;color:#757575;margin:0 0 4px;">Prefer email? Simply reply to this message — it goes straight to ${brandName}.</p>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0 20px;"/>
    <img src="https://www.overseed.net/email-logo-overseed.png" alt="Overseed" width="161" height="32" style="display:block;border:0;margin:0 0 10px;" />
    <p style="font-size:14px;line-height:1.6;color:#424242;margin:0 0 2px;"><strong>The Overseed Team</strong></p>
    <p style="font-size:13px;line-height:1.6;color:#757575;margin:0 0 2px;">Overseed connects brands with creators for authentic collaborations.</p>
    <p style="font-size:13px;line-height:1.6;margin:0 0 14px;"><a href="https://www.overseed.net" style="color:#1a73e8;text-decoration:none;">overseed.net</a></p>
    <p style="font-size:12px;color:#9e9e9e;line-height:1.6;margin:0;">This email was sent by Overseed on behalf of ${brandName}.</p>
  </div>
</div>`
}

function buildText(input: OutreachEmailInput): string {
  return `Collaboration invitation via Overseed

${input.brandName} would like to collaborate with you

A message from ${input.brandName}:

${input.briefMessage}

View & respond on Overseed: https://www.overseed.net

Prefer email? Simply reply to this message — it goes straight to ${input.brandName}.

---
The Overseed Team
Overseed connects brands with creators for authentic collaborations.
https://www.overseed.net

This email was sent by Overseed on behalf of ${input.brandName}.`
}

export async function sendOutreachEmail(input: OutreachEmailInput): Promise<OutreachEmailResult> {
  try {
    const to = process.env.CLUB_OUTREACH_TEST_RECIPIENT || input.recipientEmail
    const { error } = await getResend().emails.send({
      from: `Overseed <${process.env.EMAIL_FROM}>`,
      to,
      replyTo: input.brandEmail,
      subject: `${input.brandName} would like to collaborate with you`,
      html: buildHtml(input),
      text: buildText(input),
    })
    if (error) {
      return { success: false, error: `${error.name} — ${error.message}` }
    }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function sendOutreachBatch(
  inputs: OutreachEmailInput[],
  options?: { delayMs?: number }
): Promise<Map<string, OutreachEmailResult>> {
  const delayMs = options?.delayMs ?? 200
  const results = new Map<string, OutreachEmailResult>()

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const result = await sendOutreachEmail(input)
    results.set(input.handle, result)
    console.log(`[outreach] Sent ${i + 1}/${inputs.length}: ${input.handle}`)
    if (i < inputs.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return results
}
