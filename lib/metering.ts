// Pricing v4 deduction middleware — the single path between metered feature
// routes and the credit wallet. Handles tier gating, the Free-tier
// anti-farming verification gate, balance pre-check + atomic deduction, and
// hands back a refund closure for upstream failures.
//
// Only active when CREDIT_SYSTEM_ENABLED; routes keep their legacy v3
// behavior in the else-branch until the flag is on everywhere.

import { getEffectiveTier, isUserVerified, type SubscriptionTier } from '@/lib/subscription'
import {
  walletDeduct,
  walletRefund,
  walletHasDeduction,
  type WalletBalance,
} from '@/lib/wallet'

/** Features only available on specific tiers (beyond credit volume). */
const TIER_GATES: Record<string, SubscriptionTier[]> = {
  outreach: ['OUTREACH_PLUS', 'PRO'],
  analytics: ['PRO'],
}

/**
 * Anti-farming: FREE users cannot spend credits on creator-data features
 * until verified (brand verification / creator verification).
 */
const CREATOR_DATA_FEATURES = new Set([
  'discovery_search',
  'profile_view',
  'outreach',
  'analytics',
])

export type ChargeFailure = {
  ok: false
  status: number
  body: Record<string, unknown>
}

export type ChargeSuccess = {
  ok: true
  tier: SubscriptionTier
  cost: number
  balance: WalletBalance
  /** Roll the deduction back (upstream failure, zero results). */
  refund: () => Promise<void>
}

export type ChargeResult = ChargeSuccess | ChargeFailure

export async function gateFeature(
  userId: string,
  featureKey: string,
): Promise<{ ok: true; tier: SubscriptionTier } | ChargeFailure> {
  const tier = await getEffectiveTier(userId)

  const allowedTiers = TIER_GATES[featureKey]
  if (allowedTiers && !allowedTiers.includes(tier)) {
    return {
      ok: false,
      status: 403,
      body: {
        message:
          featureKey === 'analytics'
            ? 'Advanced Analytics is available on the Pro plan.'
            : 'Managed Outreach is available on Outreach Plus and Pro plans.',
        code: 'PLAN_REQUIRED',
        requiredTiers: allowedTiers,
        tier,
      },
    }
  }

  if (tier === 'FREE' && CREATOR_DATA_FEATURES.has(featureKey)) {
    const verified = await isUserVerified(userId)
    if (!verified) {
      return {
        ok: false,
        status: 403,
        body: {
          message: 'Verify your account to use creator data features on the Free plan.',
          code: 'VERIFICATION_REQUIRED',
        },
      }
    }
  }

  return { ok: true, tier }
}

/**
 * Gate + atomically charge `featureKey` for this action. On success the
 * caller runs the upstream call and invokes `refund()` if it fails.
 */
export async function chargeCredits(
  userId: string,
  featureKey: string,
  referenceId: string,
  opts: { quantity?: number; costOverride?: number } = {},
): Promise<ChargeResult> {
  const gate = await gateFeature(userId, featureKey)
  if (!gate.ok) return gate

  const result = await walletDeduct(userId, featureKey, referenceId, opts)
  if (!result.ok) {
    return {
      ok: false,
      status: 402,
      body: {
        message:
          'Not enough credits. Buy a credit pack or wait for your monthly credits to reset.',
        code: 'INSUFFICIENT_CREDITS',
        required: result.cost,
        available: result.available,
      },
    }
  }

  return {
    ok: true,
    tier: gate.tier,
    cost: result.cost,
    balance: result.balance,
    refund: () => walletRefund(userId, referenceId),
  }
}

/** Repeat-action dedup (e.g. re-viewing an already-paid creator profile). */
export const hasPriorCharge = walletHasDeduction
