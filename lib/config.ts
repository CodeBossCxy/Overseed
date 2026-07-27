// Platform-level knobs, centralized so they are easy to change.
// Each can also be overridden via env without a code change.

// Early-stage launch promo: verified users get a free PRO trial.
// Flip to false (or set EARLY_STAGE_PROMO=false) to end the promo.
export const EARLY_STAGE_PROMO: boolean = process.env.EARLY_STAGE_PROMO !== 'false'

// Length of the free PRO trial granted on verification, in days.
export const VERIFIED_TRIAL_DAYS: number = parseInt(process.env.VERIFIED_TRIAL_DAYS || '30', 10)
