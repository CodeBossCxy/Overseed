// One-off test: sends a sample brand-verification notification email.
// Run: npx tsx --env-file=.env scripts/test-verification-email.ts
import { sendVerificationSubmittedEmail } from '../lib/email'

async function main() {
  console.log('Sending to:', process.env.VERIFICATION_NOTIFY_EMAIL || 'xinyi@overseed.net (fallback)')
  await sendVerificationSubmittedEmail({
    companyName: 'Test Brand Co. (EMAIL TEST — ignore)',
    userEmail: 'brand-test@example.com',
    submission: {
      type: 'brand',
      method: 'trademark',
      business: {
        legalName: 'Test Brand Co. Ltd.',
        registrationNo: 'TEST-123456',
        country: 'United States',
      },
      docUrls: [],
    },
  })
  console.log('Sent OK')
}

main().catch((err) => {
  console.error('Send failed:', err)
  process.exit(1)
})
