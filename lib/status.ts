/**
 * Canonical status state machines for Overseed.
 *
 * The database keeps its original enum values (e.g. CampaignStatus.ACTIVE); this
 * module is the single source of truth for (a) which transitions are allowed and
 * (b) how each DB value maps to a spec-facing label + badge tone. UI code reads
 * the spec label via `t.status.<machine>.<key>`; server code guards writes with
 * `assertTransition(...)`. No DB migration is required to change vocabulary here.
 */

export type Tone = 'gray' | 'green' | 'amber' | 'red' | 'violet' | 'blue'

export interface StatusMeta {
  /** i18n leaf key under `t.status.<machine>` */
  key: string
  tone: Tone
}

function makeMachine<S extends string>(
  transitions: Record<S, S[]>,
  meta: Record<S, StatusMeta>,
) {
  return {
    transitions,
    meta,
    values: Object.keys(transitions) as S[],
    canTransition(from: S, to: S): boolean {
      if (from === to) return true
      return transitions[from]?.includes(to) ?? false
    },
    metaFor(status: S): StatusMeta {
      return meta[status]
    },
  }
}

// ─────────────────────────────────────────────
// Campaign — DB enum: DRAFT | PENDING_REVIEW | ACTIVE | PAUSED | COMPLETED | CANCELLED
// Spec labels: Draft → In Review → Live → Closed / Cancelled (+ Paused, extra)
// ─────────────────────────────────────────────
export type CampaignStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'

export const Campaign = makeMachine<CampaignStatus>(
  {
    DRAFT: ['PENDING_REVIEW', 'CANCELLED'],
    PENDING_REVIEW: ['ACTIVE', 'DRAFT', 'CANCELLED'], // approve → Live; needs changes → Draft + review note
    ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED'],
    PAUSED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  },
  {
    DRAFT: { key: 'draft', tone: 'gray' },
    PENDING_REVIEW: { key: 'inReview', tone: 'violet' },
    ACTIVE: { key: 'live', tone: 'green' },
    PAUSED: { key: 'paused', tone: 'amber' },
    COMPLETED: { key: 'closed', tone: 'gray' },
    CANCELLED: { key: 'cancelled', tone: 'red' },
  },
)

// ─────────────────────────────────────────────
// Application — DB enum: PENDING | UNDER_REVIEW | APPROVED | REJECTED | WITHDRAWN | COMPLETED
// Spec labels: Applied / Selected / Not Selected / Withdrawn
// ─────────────────────────────────────────────
export type ApplicationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'COMPLETED'

export const Application = makeMachine<ApplicationStatus>(
  {
    PENDING: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
    APPROVED: ['COMPLETED'],
    REJECTED: [],
    WITHDRAWN: [],
    COMPLETED: [],
  },
  {
    PENDING: { key: 'applied', tone: 'blue' },
    UNDER_REVIEW: { key: 'underReview', tone: 'amber' },
    APPROVED: { key: 'selected', tone: 'green' },
    REJECTED: { key: 'notSelected', tone: 'red' },
    WITHDRAWN: { key: 'withdrawn', tone: 'gray' },
    COMPLETED: { key: 'completed', tone: 'gray' },
  },
)

// ─────────────────────────────────────────────
// Collaboration — DB enum: AWAITING_CONFIRMATION | ACTIVE | SUBMITTED | COMPLETED | CANCELLED
// ─────────────────────────────────────────────
export type CollaborationStatus = 'AWAITING_CONFIRMATION' | 'ACTIVE' | 'SUBMITTED' | 'COMPLETED' | 'CANCELLED'

export const Collaboration = makeMachine<CollaborationStatus>(
  {
    AWAITING_CONFIRMATION: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['COMPLETED', 'ACTIVE', 'CANCELLED'], // approve → Completed; request revision → Active
    COMPLETED: [],
    CANCELLED: [],
  },
  {
    AWAITING_CONFIRMATION: { key: 'awaitingConfirmation', tone: 'amber' },
    ACTIVE: { key: 'active', tone: 'green' },
    SUBMITTED: { key: 'submitted', tone: 'blue' },
    COMPLETED: { key: 'completed', tone: 'gray' },
    CANCELLED: { key: 'cancelled', tone: 'red' },
  },
)

// ─────────────────────────────────────────────
// Payment — DB enum: PENDING | PROCESSING | HELD | RELEASE_PENDING | RELEASED
//                    | PAYOUT_PROCESSING | PAID | REFUNDED | DISPUTED | FAILED
// Brand sees: Payment Required / Secured / Released / Refunded.
// Creator sees the fuller chain (Awaiting Brand Payment → … → Paid).
// Note: "Payment secured through Stripe" — never call this escrow.
// ─────────────────────────────────────────────
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'HELD'
  | 'RELEASE_PENDING'
  | 'RELEASED'
  | 'PAYOUT_PROCESSING'
  | 'PAID'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'FAILED'

export const Payment = makeMachine<PaymentStatus>(
  {
    PENDING: ['PROCESSING', 'HELD', 'REFUNDED', 'FAILED'],
    PROCESSING: ['HELD', 'FAILED'],
    HELD: ['RELEASE_PENDING', 'RELEASED', 'REFUNDED', 'DISPUTED'],
    RELEASE_PENDING: ['RELEASED', 'DISPUTED'],
    RELEASED: ['PAYOUT_PROCESSING', 'PAID'],
    PAYOUT_PROCESSING: ['PAID'],
    PAID: [],
    REFUNDED: [],
    DISPUTED: ['RELEASED', 'REFUNDED'],
    FAILED: ['PENDING'],
  },
  {
    PENDING: { key: 'required', tone: 'amber' },
    PROCESSING: { key: 'processing', tone: 'blue' },
    HELD: { key: 'secured', tone: 'green' },
    RELEASE_PENDING: { key: 'releasePending', tone: 'amber' },
    RELEASED: { key: 'released', tone: 'green' },
    PAYOUT_PROCESSING: { key: 'payoutProcessing', tone: 'blue' },
    PAID: { key: 'paid', tone: 'green' },
    REFUNDED: { key: 'refunded', tone: 'gray' },
    DISPUTED: { key: 'disputed', tone: 'red' },
    FAILED: { key: 'failed', tone: 'red' },
  },
)

// ─────────────────────────────────────────────
// Verification — canonical 4-state used across Brand + Creator.
// Derived from existing DB fields (BrandVerificationStatus, isVerified) rather
// than stored as its own column, so no migration is needed to adopt it.
// ─────────────────────────────────────────────
export type VerificationStatus =
  | 'NOT_VERIFIED'
  | 'UNDER_REVIEW'
  | 'ACTION_REQUIRED'
  | 'VERIFIED'
  | 'UNABLE_TO_VERIFY'

export const VERIFICATION_META: Record<VerificationStatus, StatusMeta> = {
  NOT_VERIFIED: { key: 'notVerified', tone: 'gray' },
  UNDER_REVIEW: { key: 'underReview', tone: 'amber' },
  ACTION_REQUIRED: { key: 'actionRequired', tone: 'red' },
  VERIFIED: { key: 'verified', tone: 'green' },
  // Per spec, REJECTED is a back-office state only; users see "Unable to
  // Verify" with a Contact Support pointer instead of a raw rejection.
  UNABLE_TO_VERIFY: { key: 'unableToVerify', tone: 'red' },
}

/** Map the existing BrandVerificationStatus (PENDING/APPROVED/REJECTED) + submission to the front-facing state. */
export function deriveVerificationStatus(
  dbStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null | undefined,
  hasSubmitted: boolean,
): VerificationStatus {
  if (dbStatus === 'APPROVED') return 'VERIFIED'
  if (dbStatus === 'REJECTED') return 'UNABLE_TO_VERIFY'
  if (dbStatus === 'PENDING' && hasSubmitted) return 'UNDER_REVIEW'
  return 'NOT_VERIFIED'
}

// ─────────────────────────────────────────────
// Account status — back-office risk control only (per spec: not shown to
// regular users). Derived from User.isActive until a dedicated column with a
// RESTRICTED tier is needed.
// ─────────────────────────────────────────────
export type AccountStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED'

export const ACCOUNT_STATUS_META: Record<AccountStatus, StatusMeta> = {
  ACTIVE: { key: 'active', tone: 'green' },
  RESTRICTED: { key: 'restricted', tone: 'amber' },
  SUSPENDED: { key: 'suspended', tone: 'red' },
}

export function deriveAccountStatus(isActive: boolean): AccountStatus {
  return isActive ? 'ACTIVE' : 'SUSPENDED'
}

/** Public verified badge label key by account type (per spec). */
export function verifiedBadgeKey(userType: string): string {
  switch (userType) {
    case 'BRAND':
      return 'verifiedBusiness'
    case 'AGENCY':
      return 'verifiedAgency'
    case 'INFLUENCER':
      return 'verifiedSocialAccount'
    default:
      return 'verifiedBusiness'
  }
}

// ─────────────────────────────────────────────
// Transition guard for server code
// ─────────────────────────────────────────────
export class InvalidTransitionError extends Error {
  constructor(machine: string, from: string, to: string) {
    super(`Invalid ${machine} transition: ${from} → ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

type Machine<S extends string> = { canTransition(from: S, to: S): boolean }

export function assertTransition<S extends string>(
  machine: Machine<S> & { name?: string },
  machineName: string,
  from: S,
  to: S,
): void {
  if (!machine.canTransition(from, to)) {
    throw new InvalidTransitionError(machineName, from, to)
  }
}
