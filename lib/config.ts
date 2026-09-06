// Platform-level knobs, centralized so they are easy to change.
// Each can also be overridden via env without a code change.

// Early-stage launch promo: verified users get a free PRO trial.
// Flip to false (or set EARLY_STAGE_PROMO=false) to end the promo.
export const EARLY_STAGE_PROMO: boolean = process.env.EARLY_STAGE_PROMO !== 'false'

// Length of the free PRO trial granted on verification, in days.
export const VERIFIED_TRIAL_DAYS: number = parseInt(process.env.VERIFIED_TRIAL_DAYS || '30', 10)

// Pricing v4 unified credit wallet. While false, the legacy v3 behavior
// (quota counters + virtual monthly allowance) stays active. Enable per
// environment via CREDIT_SYSTEM_ENABLED=true.
export const CREDIT_SYSTEM_ENABLED: boolean = process.env.CREDIT_SYSTEM_ENABLED === 'true'
