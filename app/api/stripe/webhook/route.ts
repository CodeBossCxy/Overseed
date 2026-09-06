import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { grantPackCredits } from '@/lib/credits'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import {
  walletGrant,
  grantSubscriptionCycleCredits,
  addMonths,
  PACK_VALIDITY_MONTHS,
} from '@/lib/wallet'

const V4_TIERS = ['CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO'] as const
type V4Tier = (typeof V4_TIERS)[number]

/**
 * Subscription lots never outlive the paid period, and monthly-granted
 * credits on annual plans still reset monthly (no rollover).
 */
function subscriptionLotExpiry(periodEnd: Date): Date {
  const monthly = addMonths(new Date(), 1)
  return monthly < periodEnd ? monthly : periodEnd
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let event: Stripe.Event

  try {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    if (!sig) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      )
    }

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (error: any) {
    console.error('[Stripe Webhook] Signature verification failed:', error.message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const stripePaymentIntentId = paymentIntent.id

        // Only update if this is a campaign payment (not a subscription)
        const payment = await prisma.payment.findUnique({
          where: { stripePaymentIntentId },
        })

        if (payment) {
          await prisma.payment.update({
            where: { stripePaymentIntentId },
            data: {
              status: 'HELD',
              paidAt: new Date(),
            },
          })
          console.log(`[Stripe Webhook] Payment ${stripePaymentIntentId} marked as HELD`)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const stripePaymentIntentId = paymentIntent.id

        const failedPayment = await prisma.payment.findUnique({
          where: { stripePaymentIntentId },
        })

        if (failedPayment) {
          await prisma.payment.update({
            where: { stripePaymentIntentId },
            data: { status: 'FAILED' },
          })
          console.log(`[Stripe Webhook] Payment ${stripePaymentIntentId} marked as FAILED`)
        }
        break
      }

      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session

        // Subscription purchase — set the tier from checkout metadata
        // (pricing v3: CAMPAIGN_PLUS | OUTREACH_PLUS | PRO). Sessions created
        // before v3 carry no tier and map to CAMPAIGN_PLUS (old ¥69.99 Pro).
        if (checkoutSession.mode === 'subscription' && checkoutSession.metadata?.userId) {
          const tier = (['CAMPAIGN_PLUS', 'OUTREACH_PLUS', 'PRO'] as const).includes(
            checkoutSession.metadata?.tier as any,
          )
            ? (checkoutSession.metadata!.tier as 'CAMPAIGN_PLUS' | 'OUTREACH_PLUS' | 'PRO')
            : 'CAMPAIGN_PLUS'
          const subscriptionId =
            typeof checkoutSession.subscription === 'string'
              ? checkoutSession.subscription
              : checkoutSession.subscription?.id || null
          await prisma.user.update({
            where: { id: checkoutSession.metadata.userId },
            // Paid subscription — clear any trial marker
            data: {
              subscriptionTier: tier,
              proTrialEndsAt: null,
              ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
            },
          })

          // Pricing v4: the first cycle's credits are granted by the
          // invoice.paid event that accompanies this checkout (idempotent
          // per invoice id), so nothing else to do here.
          console.log(`[Stripe Webhook] User ${checkoutSession.metadata.userId} upgraded to ${tier}`)
        }

        // Credit pack purchase — grant credits (idempotent per session id)
        if (
          checkoutSession.mode === 'payment' &&
          checkoutSession.metadata?.userId &&
          checkoutSession.metadata?.packCredits
        ) {
          const credits = parseInt(checkoutSession.metadata.packCredits, 10)
          if (Number.isFinite(credits) && credits > 0) {
            const buyerId = checkoutSession.metadata.userId
            let granted: boolean
            if (CREDIT_SYSTEM_ENABLED) {
              // v4: purchased lot, valid 12 months, FIFO after subscription credits
              granted = await walletGrant(buyerId, {
                bucket: 'PURCHASED',
                source: 'PACK',
                credits,
                expiresAt: addMonths(new Date(), PACK_VALIDITY_MONTHS),
                reference: `checkout:${checkoutSession.id}`,
                note: checkoutSession.metadata.packConfigId,
              })
              // Free users may buy the small pack exactly once. Atomic stamp
              // (only when unset) closes the multi-open-checkout race; if the
              // stamp already exists we still grant — the money was taken —
              // but log it for support visibility.
              if (granted && checkoutSession.metadata.freePack === 'true') {
                const stamped = await prisma.user.updateMany({
                  where: { id: buyerId, freePackPurchasedAt: null },
                  data: { freePackPurchasedAt: new Date() },
                })
                if (stamped.count === 0) {
                  console.warn(
                    `[Stripe Webhook] Free user ${buyerId} fulfilled a second free-pack checkout (${checkoutSession.id})`,
                  )
                }
              }
            } else {
              granted = await grantPackCredits(buyerId, credits, checkoutSession.id)
            }
            console.log(
              `[Stripe Webhook] ${granted ? 'Granted' : 'Skipped duplicate'} ${credits} credits to user ${buyerId}`,
            )
          }
        }
        break
      }

      case 'invoice.paid': {
        // Pricing v4: each paid subscription invoice opens a billing cycle —
        // mirror period end and grant the cycle's subscription credits.
        if (!CREDIT_SYSTEM_ENABLED) break
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId =
          typeof (invoice as any).subscription === 'string'
            ? ((invoice as any).subscription as string)
            : ((invoice as any).subscription?.id as string | undefined)
        if (!subscriptionId) break

        // Only new cycles grant credits — prorations / plan-change invoices
        // (billing_reason subscription_update etc.) must not re-grant.
        const billingReason = (invoice as any).billing_reason as string | undefined
        if (
          billingReason &&
          billingReason !== 'subscription_create' &&
          billingReason !== 'subscription_cycle'
        ) {
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const subMeta = (subscription.metadata || {}) as { userId?: string; tier?: string }

        // Resolve the user: subscription metadata first (works even when this
        // event beats checkout.session.completed), then mirrored id, then
        // customer metadata.
        let user =
          (subMeta.userId
            ? await prisma.user.findUnique({
                where: { id: subMeta.userId },
                select: { id: true, subscriptionTier: true },
              })
            : null) ||
          (await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
            select: { id: true, subscriptionTier: true },
          }))
        if (!user && invoice.customer) {
          const customer = await stripe.customers.retrieve(invoice.customer as string)
          const metaUserId = (customer as Stripe.Customer).metadata?.userId
          if (metaUserId) {
            user = await prisma.user.findUnique({
              where: { id: metaUserId },
              select: { id: true, subscriptionTier: true },
            })
          }
        }
        if (!user) {
          console.warn(`[Stripe Webhook] invoice.paid: no user for subscription ${subscriptionId}`)
          break
        }

        const periodEndSec =
          (subscription as any).current_period_end ??
          (subscription as any).items?.data?.[0]?.current_period_end
        const periodEnd = periodEndSec ? new Date(periodEndSec * 1000) : addMonths(new Date(), 1)

        await prisma.user.update({
          where: { id: user.id },
          data: { stripeSubscriptionId: subscriptionId, currentPeriodEnd: periodEnd },
        })

        // Plan resolution: subscription metadata (authoritative, set at
        // checkout) → DB tier → CAMPAIGN_PLUS.
        const tier = V4_TIERS.includes(subMeta.tier as V4Tier)
          ? (subMeta.tier as V4Tier)
          : V4_TIERS.includes(user.subscriptionTier as V4Tier)
            ? (user.subscriptionTier as V4Tier)
            : 'CAMPAIGN_PLUS'
        const granted = await grantSubscriptionCycleCredits(
          user.id,
          tier,
          subscriptionLotExpiry(periodEnd),
          `invoice:${invoice.id}`,
        )
        console.log(
          `[Stripe Webhook] ${granted ? 'Granted' : 'Skipped duplicate'} cycle credits (${tier}) for user ${user.id}`,
        )
        break
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled — downgrade to FREE
        const subscription = event.data.object as Stripe.Subscription
        const customer = await stripe.customers.retrieve(subscription.customer as string)
        const userId = (customer as Stripe.Customer).metadata?.userId

        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionTier: 'FREE',
              stripeSubscriptionId: null,
              currentPeriodEnd: null,
            },
          })

          console.log(`[Stripe Webhook] User ${userId} downgraded to FREE`)
        }
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account

        if (account.charges_enabled) {
          await prisma.influencerProfile.updateMany({
            where: { stripeConnectId: account.id },
            data: { stripeOnboardingComplete: true },
          })

          console.log(`[Stripe Webhook] Account ${account.id} onboarding complete`)
        }
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }
  } catch (error: any) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({ received: true })
}
