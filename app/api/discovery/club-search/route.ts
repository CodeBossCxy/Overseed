import { NextRequest, NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clubSearch, clubSearchCacheProbe, type ClubPlatform } from '@/lib/influencers-club'
import {
  CLUB_FILTER_DEFS,
  CREATOR_HAS_KEYS,
  SORT_BY_OPTIONS,
  AUDIENCE_CREDIBILITY_OPTIONS,
  type ClubAdvancedFilters,
  type ClubAudienceFilters,
  type ClubSortBy,
} from '@/lib/club-filter-defs'
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

  const num = (key: string) => {
    const v = params.get(key)
    if (!v) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const list = (key: string) =>
    (params.get(key) || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 10)

  // Generic advanced filters, driven by the shared def catalog. Invalid
  // values are a client bug/tampering — reject before any charge.
  const advanced: ClubAdvancedFilters = {}
  for (const def of CLUB_FILTER_DEFS) {
    switch (def.kind) {
      case 'range': {
        const min = num(`${def.id}_min`)
        const max = num(`${def.id}_max`)
        if (min != null || max != null) {
          advanced[def.id] = {
            ...(min != null ? { min } : {}),
            ...(max != null ? { max } : {}),
          }
        }
        break
      }
      case 'growth': {
        const pct = num(`${def.id}_pct`)
        const months = num(`${def.id}_months`)
        if (pct != null) {
          advanced[def.id] = {
            growth_percentage: pct,
            ...(months != null ? { time_range_months: Math.round(months) } : {}),
          }
        }
        break
      }
      case 'keywords': {
        const values = list(def.id)
        if (values.length) advanced[def.id] = values
        break
      }
      case 'boolean': {
        const v = params.get(def.id)
        if (v === '1' || v === 'true') advanced[def.id] = true
        break
      }
      case 'number': {
        const v = num(def.id)
        if (v != null) advanced[def.id] = v
        break
      }
      case 'enum': {
        const v = params.get(def.id)?.trim()
        if (v) {
          if (!def.options?.includes(v)) {
            return NextResponse.json(
              { message: `Invalid ${def.id} filter`, code: 'INVALID_FILTER' },
              { status: 400 }
            )
          }
          advanced[def.id] = v
        }
        break
      }
      case 'text': {
        const v = params.get(def.id)?.trim()
        if (v) advanced[def.id] = v.slice(0, 100)
        break
      }
    }
  }

  // creator_has multi-select: comma list of has_* keys (or bare platform
  // tokens like "patreon"), validated against the documented key list.
  const creatorHas = (params.get('creator_has') || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => (k.startsWith('has_') ? k : `has_${k}`))
    .slice(0, 20)
  for (const k of creatorHas) {
    if (!(CREATOR_HAS_KEYS as readonly string[]).includes(k)) {
      return NextResponse.json(
        { message: `Invalid creator_has value: ${k}`, code: 'INVALID_FILTER' },
        { status: 400 }
      )
    }
  }

  // Sort
  const sortBy = params.get('sort_by')?.trim() || undefined
  if (sortBy && !(SORT_BY_OPTIONS as readonly string[]).includes(sortBy)) {
    return NextResponse.json({ message: 'Invalid sort_by', code: 'INVALID_FILTER' }, { status: 400 })
  }
  const sortOrderRaw = params.get('sort_order')?.trim() || undefined
  if (sortOrderRaw && sortOrderRaw !== 'asc' && sortOrderRaw !== 'desc') {
    return NextResponse.json({ message: 'Invalid sort_order', code: 'INVALID_FILTER' }, { status: 400 })
  }

  // Extended audience filters (Instagram only; ignored otherwise)
  const audienceGender = params.get('audience_gender')?.trim().toLowerCase() || undefined
  if (audienceGender && audienceGender !== 'male' && audienceGender !== 'female') {
    return NextResponse.json(
      { message: 'Invalid audience_gender filter', code: 'INVALID_FILTER' },
      { status: 400 }
    )
  }
  const audienceLocationType = params.get('audience_location_type')?.trim() || undefined
  if (
    audienceLocationType &&
    !['country', 'state', 'city'].includes(audienceLocationType)
  ) {
    return NextResponse.json(
      { message: 'Invalid audience_location_type filter', code: 'INVALID_FILTER' },
      { status: 400 }
    )
  }
  const audienceLanguage = params.get('audience_language')?.trim().toLowerCase() || undefined
  if (audienceLanguage && !/^[a-z]{2,3}$/.test(audienceLanguage)) {
    return NextResponse.json(
      { message: 'Invalid audience_language filter', code: 'INVALID_FILTER' },
      { status: 400 }
    )
  }
  const audienceCredibility = params.get('audience_credibility')?.trim().toLowerCase() || undefined
  if (
    audienceCredibility &&
    !(AUDIENCE_CREDIBILITY_OPTIONS as readonly string[]).includes(audienceCredibility)
  ) {
    return NextResponse.json(
      { message: 'Invalid audience_credibility filter', code: 'INVALID_FILTER' },
      { status: 400 }
    )
  }
  const audience: ClubAudienceFilters | undefined =
    platform === 'instagram'
      ? {
          gender: audienceGender,
          genderMinPct: num('audience_gender_min_pct'),
          locationName: params.get('audience_location')?.trim().slice(0, 100) || undefined,
          locationType: audienceLocationType as ClubAudienceFilters['locationType'],
          locationMinPct: num('audience_location_min_pct'),
          languageAbbr: audienceLanguage,
          languageMinPct: num('audience_language_min_pct'),
          interestName: params.get('audience_interest')?.trim().slice(0, 100) || undefined,
          interestMinPct: num('audience_interest_min_pct'),
          credibility: audienceCredibility,
        }
      : undefined

  const searchOpts = {
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
    advanced: Object.keys(advanced).length ? advanced : undefined,
    creatorHas: creatorHas.length ? creatorHas : undefined,
    audience,
    sortBy: sortBy as ClubSortBy | undefined,
    sortOrder: sortOrderRaw as 'asc' | 'desc' | undefined,
    // v4: fixed page size of 10 (one billed page); legacy allows up to 25.
    limit: CREDIT_SYSTEM_ENABLED ? DISCOVERY_PAGE_SIZE : Math.min(num('limit') ?? 10, 25),
    page: num('page') ?? 0,
  }

  // Pricing v4: every search page costs credits (config: discovery_search per
  // page of 10). Charged up front; adjusted after results come back. The
  // cache probe is free, so it runs in parallel with the wallet charge —
  // repeat searches skip the vendor round-trip entirely.
  let searchCharge: { referenceId: string; refund: () => Promise<void> } | null = null
  let cachedResult: Awaited<ReturnType<typeof clubSearchCacheProbe>> = null
  if (CREDIT_SYSTEM_ENABLED) {
    const referenceId = `discovery:${userId}:${Date.now()}`
    const [probe, charge] = await Promise.all([
      clubSearchCacheProbe(searchOpts),
      chargeCredits(userId, 'discovery_search', referenceId),
    ])
    if (!charge.ok) {
      return NextResponse.json(charge.body, { status: charge.status })
    }
    if (charge.cost > 0) searchCharge = { referenceId, refund: charge.refund }
    cachedResult = probe
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

  // Refund settlement is pure bookkeeping — run it after the response is
  // sent instead of blocking the search result on extra DB round-trips.
  const settleAfterResponse = (resultCount: number) => {
    after(async () => {
      try {
        await settleCharge(resultCount)
      } catch (err: any) {
        console.error('Discovery charge settlement failed:', err?.message)
      }
    })
  }

  try {
    const result = cachedResult ?? (await clubSearch(searchOpts))
    settleAfterResponse(result?.results?.length ?? 0)
    return NextResponse.json(result)
  } catch (err: any) {
    console.warn('Influencers Club search unavailable; using Overseed creator index:', err?.message)
    const local = await safeLocalCreatorDiscovery(params, true)
    settleAfterResponse(local?.results?.length ?? 0)
    return NextResponse.json(local)
  }
}
