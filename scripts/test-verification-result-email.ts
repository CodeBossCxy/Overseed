// One-off test: sends the brand "verification approved" (or rejected) notification.
// Run: npx tsx --env-file=.env scripts/test-verification-result-email.ts <email> [rejected]
import { sendVerificationApprovedEmail, sendVerificationRejectedEmail } from '../lib/notification-emails'

async function main() {
  const to = process.argv[2] || 'xinyi@overseed.net'
  const rejected = process.argv[3] === 'rejected'
  const recipient = {
    email: to,
    name: 'Test Brand Admin',
    preferredLanguage: 'en',
    emailNotifications: true,
    emailCampaignUpdates: true,
    emailCollaborationUpdates: true,
  }
  console.log(`Sending verification-${rejected ? 'rejected' : 'approved'} test email to:`, to)
  if (rejected) {
    await sendVerificationRejectedEmail(recipient, {
      companyName: 'Test Brand Co. (EMAIL TEST — ignore)',
      rejectionReason: 'The uploaded business licence was not legible. Please upload a clearer scan.',
    })
  } else {
    await sendVerificationApprovedEmail(recipient, {
      companyName: 'Test Brand Co. (EMAIL TEST — ignore)',
    })
  }
  console.log('Done (check console above for any Resend errors)')
}

main()
