import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clubSearch, type ClubPlatform } from '@/lib/influencers-club'
import { safeLocalCreatorDiscovery } from '@/lib/discovery'
import { consumeQuota } from '@/lib/plan'
import { getEffectiveTier } from '@/lib/subscription'
import { deductCredits } from '@/lib/credits'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits } from '@/lib/metering'
import { walletRefund, getCreditPrice } from '@/lib/wallet'

// Pricing v4: discovery is charged per page of 10 results (fixed page size).
// Zero results → full refund; fewer than 10 → proportional (ceil, min 1).
const DISCOVERY_PAGE_SIZE = 10

// TEMP: GET /api/discovery/club-search — influencers.club-backed creator
// search, brand-only like /api/discovery/search. The API key never leaves
// the server. Remove together with lib/influencers-club.ts and the
// "Data source" picker in DiscoverPanel.tsx.

const CLUB_PLATFORMS: ClubPlatform[] = ['instagram', 'youtube', 'tiktok']

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!brand) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams

  // Validate everything cheap BEFORE any charge.
  const platform = (params.get('platform') || 'instagram') as ClubPlatform
  if (!CLUB_PLATFORMS.includes(platform)) {
    return NextResponse.json({ message: 'Unsupported platform', code: 'UNSUPPORTED_PLATFORM' }, { status: 400 })
  }

  // Enum-valued advanced filters (all optional). Invalid values are a
  // client bug/tampering — reject before any charge.
  const gender = params.get('gender')?.trim().toUpperCase() || undefined
  if (gender && gender !== 'MALE' && gender !== 'FEMALE') {
    return NextResponse.json({ message: 'Invalid gender filter', code: 'INVALID_FILTER' }, { status: 400 })
  }
  const lastPostRaw = params.get('last_post')?.trim() || undefined
  if (lastPostRaw && lastPostRaw !== '90' && lastPostRaw !== '365') {
    return NextResponse.json({ message: 'Invalid last_post filter', code: 'INVALID_FILTER' }, { status: 400 })
  }
  const AUDIENCE_AGES = ['13-17', '18-24', '25-34', '35-44', '45-64', '65-'] as const
  const audienceAge = params.get('audience_age')?.trim() || undefined
  if (audienceAge && !(AUDIENCE_AGES as readonly string[]).includes(audienceAge)) {
    return NextResponse.json({ message: 'Invalid audience_age filter', code: 'INVALID_FILTER' }, { status: 400 })
  }
  const language = params.get('language')?.trim().toLowerCase() || undefined
  if (language && !/^[a-z]{2,3}$/.test(language)) {
    return NextResponse.json({ message: 'Invalid language filter', code: 'INVALID_FILTER' }, { status: 400 })
  }
  const bioKeywords = (params.get('bio_keywords') || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10)

  // Pricing v4: every search page costs credits (config: discovery_search per
  // page of 10). Charged up front; adjusted after results come back.
  let searchCharge: { referenceId: string; refund: () => Promise<void> } | null = null
  if (CREDIT_SYSTEM_ENABLED) {
    const referenceId = `discovery:${userId}:${Date.now()}`
    const charge = await chargeCredits(userId, 'discovery_search', referenceId)
    if (!charge.ok) {
      return NextResponse.json(charge.body, { status: charge.status })
    }
    if (charge.cost > 0) searchCharge = { referenceId, refund: charge.refund }
  } else if (params.get('q')?.trim()) {
    // Pricing v3 (legacy): keyword searches consume the monthly discovery
    // quota; beyond it, extra searches bill 6 credits each.
    const tier = await getEffectiveTier(userId)
    const quota = await consumeQuota(userId, tier, 'discovery_search')
    if (!quota.ok) {
      const deduction = await deductCredits(
        userId,
        tier,
        'discovery_search_extra',
        `discovery:${userId}:${Date.now()}`,
      )
      if (!deduction.ok) {
        return NextResponse.json(
          {
            message:
              'Monthly discovery search limit reached and not enough AI credits for extra searches. Buy a credit pack or upgrade your plan.',
            code: 'DISCOVERY_QUOTA_EXCEEDED',
            used: quota.used,
            limit: quota.limit,
            creditsRequired: deduction.cost,
            creditsAvailable: deduction.available,
          },
          { status: 402 }
        )
      }
    }
  }

  // v4: zero results → full refund; short page → refund the unfilled share
  // (charge kept = max(1, ceil(price·n/10))). Single atomic, idempotent op.
  const settleCharge = async (resultCount: number) => {
    if (!searchCharge || resultCount >= DISCOVERY_PAGE_SIZE) return
    const price = await getCreditPrice('discovery_search')
    const keep =
      resultCount > 0 ? Math.max(1, Math.ceil((price * resultCount) / DISCOVERY_PAGE_SIZE)) : 0
    if (keep >= price) return
    await walletRefund(userId, searchCharge.referenceId, { amount: price - keep })
  }

  const num = (key: string) => {
    const v = params.get(key)
    if (!v) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  try {
    const result = await clubSearch({
      platform,
      query: params.get('q')?.trim() || undefined,
      country: params.get('country')?.trim() || undefined,
      minFollowers: num('min_followers'),
      maxFollowers: num('max_followers'),
      minEngagement: num('min_engagement'),
      maxEngagement: num('max_engagement'),
      gender: gender as 'MALE' | 'FEMALE' | undefined,
      language,
      bioKeywords,
      lastPost: lastPostRaw ? (Number(lastPostRaw) as 90 | 365) : undefined,
      // Audience demographics are Instagram-only; ignore for other platforms
      audienceAgeRange:
        platform === 'instagram' ? (audienceAge as '13-17' | '18-24' | '25-34' | '35-44' | '45-64' | '65-' | undefined) : undefined,
      audienceAgeMinPct: num('audience_age_min_pct'),
      // v4: fixed page size of 10 (one billed page); legacy allows up to 25.
      limit: CREDIT_SYSTEM_ENABLED ? DISCOVERY_PAGE_SIZE : Math.min(num('limit') ?? 10, 25),
      page: num('page') ?? 0,
    })
    await settleCharge(result?.results?.length ?? 0)
    return NextResponse.json(result)
  } catch (err: any) {
    console.warn('Influencers Club search unavailable; using Overseed creator index:', err?.message)
    const local = await safeLocalCreatorDiscovery(params, true)
    await settleCharge(local?.results?.length ?? 0)
    return NextResponse.json(local)
  }
}
