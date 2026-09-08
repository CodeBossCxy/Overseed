import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, inquiryType, message } = await req.json()

    if (!name || !email || !message) {
      return NextResponse.json(
        { message: 'Name, email, and message are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    const inquiryLabels: Record<string, string> = {
      general: 'General Question',
      demo: 'Request a Demo',
      business: 'Business / Partnership',
      support: 'Technical Support',
    }

    await transporter.sendMail({
      from: `"Overseed Contact Form" <${process.env.EMAIL_FROM}>`,
      to: 'contactus@overseed.net',
      replyTo: email,
      subject: `[Overseed] ${inquiryLabels[inquiryType] || 'Contact'} from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666; width: 120px;"><strong>Name:</strong></td><td style="padding: 8px 0;">${name}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td><td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
            ${company ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Company:</strong></td><td style="padding: 8px 0;">${company}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #666;"><strong>Type:</strong></td><td style="padding: 8px 0;">${inquiryLabels[inquiryType] || inquiryType}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <h3 style="color: #333;">Message</h3>
          <p style="color: #444; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { message: 'Failed to send message', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
