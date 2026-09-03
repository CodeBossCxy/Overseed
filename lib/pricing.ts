// Pricing v3 catalog (docs/PRICING_PLAN_V3.md) — Stripe amounts in CNY cents.

export type PaidTier = 'CAMPAIGN_PLUS' | 'OUTREACH_PLUS' | 'PRO'
export type BillingInterval = 'month' | 'year'

export const SUBSCRIPTION_PLANS: Record<
  PaidTier,
  { productName: string; monthly: number; annual: number }
> = {
  CAMPAIGN_PLUS: { productName: 'Overseed Campaign Plus', monthly: 6900, annual: 69000 },
  OUTREACH_PLUS: { productName: 'Overseed Outreach Plus', monthly: 10900, annual: 109000 },
  PRO: { productName: 'Overseed Pro (v3)', monthly: 19900, annual: 199000 },
}

export const CREDIT_PACKS = {
  mini: { label: 'Mini Credit Pack', amount: 990, credits: 60 },
  starter: { label: 'Starter Credit Pack', amount: 2900, credits: 240 },
  standard: { label: 'Standard Credit Pack', amount: 9900, credits: 880 },
  pro: { label: 'Pro Credit Pack', amount: 19900, credits: 1800 },
} as const

export type CreditPackId = keyof typeof CREDIT_PACKS

export const CURRENCY = 'cny'
