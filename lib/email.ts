import { Resend } from 'resend'

let resend: Resend

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
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
