import { prisma } from '@/lib/prisma'
import { EARLY_STAGE_PROMO, VERIFIED_TRIAL_DAYS } from '@/lib/config'

/**
 * Early-stage promo: grant a verified user a free PRO trial.
 * No-op when the promo is off or the user already has PRO.
 * Returns true when a trial was granted.
 */
export async function grantVerifiedTrial(userId: string): Promise<boolean> {
  if (!EARLY_STAGE_PROMO) return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  })
  if (!user || user.subscriptionTier === 'PRO') return false
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: 'PRO',
      proTrialEndsAt: new Date(Date.now() + VERIFIED_TRIAL_DAYS * 24 * 60 * 60 * 1000),
    },
  })
  return true
}

/**
 * The user's effective tier right now. Trial PRO that has expired is lazily
 * downgraded back to FREE on read.
 */
export async function getEffectiveTier(userId: string): Promise<'FREE' | 'PRO'> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, proTrialEndsAt: true },
  })
  if (!user) return 'FREE'
  if (
    user.subscriptionTier === 'PRO' &&
    user.proTrialEndsAt &&
    user.proTrialEndsAt < new Date()
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: 'FREE', proTrialEndsAt: null },
    })
    return 'FREE'
  }
  return user.subscriptionTier as 'FREE' | 'PRO'
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
