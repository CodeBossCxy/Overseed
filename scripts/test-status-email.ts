// One-off test: sends a sample "application accepted" creator notification.
// Run: npx tsx --env-file=.env scripts/test-status-email.ts
import { sendApplicationApprovedEmail } from '../lib/notification-emails'

async function main() {
  const to = process.argv[2] || 'xinyi@overseed.net'
  console.log('Sending application-approved test email to:', to)
  await sendApplicationApprovedEmail(
    {
      email: to,
      name: 'Test Creator',
      preferredLanguage: 'en',
      emailNotifications: true,
      emailCampaignUpdates: true,
      emailCollaborationUpdates: true,
    },
    {
      campaignTitle: 'Summer TikTok Launch (EMAIL TEST — ignore)',
      brandName: 'Test Brand Co.',
    }
  )
  console.log('Done (check console above for any Resend errors)')
}

main()
