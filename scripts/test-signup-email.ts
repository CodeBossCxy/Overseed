// One-off test: sends a sample new-user signup notification email.
// Run: npx tsx --env-file=.env scripts/test-signup-email.ts
import { sendNewUserSignupEmail } from '../lib/email'

async function main() {
  console.log('Sending to:', process.env.SIGNUP_NOTIFY_EMAIL || 'xinyi@overseed.net (fallback)')
  await sendNewUserSignupEmail({
    name: 'Test User (EMAIL TEST — ignore)',
    email: 'test-signup@example.com',
    userType: 'BRAND',
    method: 'credentials',
    inviteCode: 'OS-TEST',
    companyName: 'Test Co',
  })
  console.log('done — if no Resend error was logged above, the send was accepted')
}

main()
