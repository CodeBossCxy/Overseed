import { prisma } from '@/lib/prisma'
import { EARLY_STAGE_PROMO, VERIFIED_TRIAL_DAYS } from '@/lib/config'

export type SubscriptionTier = 'FREE' | 'CAMPAIGN_PLUS' | 'OUTREACH_PLUS' | 'PRO'

export const PAID_TIERS: SubscriptionTier[] = ['CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO']

export function isPaidTier(tier: string): boolean {
  return PAID_TIERS.includes(tier as SubscriptionTier)
}

/**
 * Early-stage promo: grant a verified user a free Campaign Plus trial
 * (pricing v3 — the old PRO trial maps to Campaign Plus).
 * No-op when the promo is off or the user is already on a paid tier.
 * Returns true when a trial was granted.
 */
export async function grantVerifiedTrial(userId: string): Promise<boolean> {
  if (!EARLY_STAGE_PROMO) return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  })
  if (!user || isPaidTier(user.subscriptionTier)) return false
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: 'CAMPAIGN_PLUS',
      proTrialEndsAt: new Date(Date.now() + VERIFIED_TRIAL_DAYS * 24 * 60 * 60 * 1000),
    },
  })
  return true
}

/**
 * The user's effective tier right now. An expired trial (any paid tier with
 * proTrialEndsAt set) is lazily downgraded back to FREE on read.
 */
export async function getEffectiveTier(userId: string): Promise<SubscriptionTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, proTrialEndsAt: true },
  })
  if (!user) return 'FREE'
  if (
    isPaidTier(user.subscriptionTier) &&
    user.proTrialEndsAt &&
    user.proTrialEndsAt < new Date()
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: 'FREE', proTrialEndsAt: null },
    })
    return 'FREE'
  }
  return user.subscriptionTier as SubscriptionTier
}

/**
 * Verification check shared by gated features (e.g. the AI assistant):
 * brands must have an approved business verification; creators must have a
 * verified profile.
 */
export async function isUserVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      brandProfile: { select: { brandVerificationStatus: true } },
      influencerProfile: { select: { isVerified: true } },
    },
  })
  if (!user) return false
  if (user.brandProfile) return user.brandProfile.brandVerificationStatus === 'APPROVED'
  if (user.influencerProfile) return user.influencerProfile.isVerified
  return false
}
