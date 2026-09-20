import { prisma } from '@/lib/prisma'

// Beta promo (2026-09-20): the first 20 new registrations — via invite-code
// signup or OAuth — get Growth Plus (OUTREACH_PLUS enum); after that, new
// users default to Campaign Plus again. Counted as users created since the
// promo start, so both signup paths increment the count.
const GROWTH_PLUS_PROMO_START = new Date('2026-09-20T00:00:00Z')
const GROWTH_PLUS_PROMO_LIMIT = 20

// `userAlreadyCounted`: pass true when the new user row already exists at
// call time (OAuth createUser event) so they don't count against themselves.
export async function defaultSignupTier(opts?: {
  userAlreadyCounted?: boolean
}): Promise<'OUTREACH_PLUS' | 'CAMPAIGN_PLUS'> {
  try {
    const count = await prisma.user.count({
      where: { createdAt: { gte: GROWTH_PLUS_PROMO_START } },
    })
    const priorSignups = opts?.userAlreadyCounted ? count - 1 : count
    return priorSignups < GROWTH_PLUS_PROMO_LIMIT ? 'OUTREACH_PLUS' : 'CAMPAIGN_PLUS'
  } catch (error) {
    // Counting must never block signup — fall back to the standard tier.
    console.error('defaultSignupTier count failed:', error)
    return 'CAMPAIGN_PLUS'
  }
}
