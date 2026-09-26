import { NextRequest, NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clubSearch, clubSearchCacheProbe, mergeEnrichedProfileFields, type ClubPlatform } from '@/lib/influencers-club'
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
import { youtubeSearchCreators, youtubeConfigured } from '@/lib/youtube'
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

const CLUB_PLATFORMS: ClubPlatform[] = ['instagram', 'youtube', 'tiktok', 'twitter', 'onlyfans', 'twitch']

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
  // Multi-select: comma-separated list of age ranges
  const audienceAges = (params.get('audience_age') || '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
  for (const a of audienceAges) {
    if (!(AUDIENCE_AGES as readonly string[]).includes(a)) {
      return NextResponse.json({ message: 'Invalid audience_age filter', code: 'INVALID_FILTER' }, { status: 400 })
    }
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

  // ---- Search tasks -------------------------------------------------------
  // Every search submission is a task; pages fetched within it are
  // snapshotted. Re-viewing a snapshotted page is free (no charge, no vendor
  // call). A task_id with an unseen page falls through to normal billing,
  // searching with the task's stored parameters.
  const taskIdParam = params.get('task_id')?.trim() || null
  const requestedPage = num('page') ?? 0
  let task: { id: string; platform: string; request: unknown } | null = null
  if (taskIdParam) {
    task = await prisma.discoverySearchTask.findFirst({
      where: { id: taskIdParam, userId },
      select: { id: true, platform: true, request: true },
    })
    if (!task) {
      return NextResponse.json({ message: 'Search task not found', code: 'TASK_NOT_FOUND' }, { status: 404 })
    }
    const snapshot = await prisma.discoveryTaskPage.findUnique({
      where: { taskId_page: { taskId: task.id, page: requestedPage } },
    })
    if (snapshot) {
      const taskId = task.id
      after(async () => {
        await prisma.discoverySearchTask
          .update({ where: { id: taskId }, data: { updatedAt: new Date() } })
          .catch(() => {})
      })
      return NextResponse.json({
        ...(snapshot.data as any),
        task_id: taskId,
        page: requestedPage,
        from_task: true,
      })
    }
  }

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
      platform === 'instagram' && audienceAges.length
        ? (audienceAges as ('13-17' | '18-24' | '25-34' | '35-44' | '45-64' | '65-')[])
        : undefined,
    audienceAgeMinPct: num('audience_age_min_pct'),
    advanced: Object.keys(advanced).length ? advanced : undefined,
    creatorHas: creatorHas.length ? creatorHas : undefined,
    audience,
    sortBy: sortBy as ClubSortBy | undefined,
    sortOrder: sortOrderRaw as 'asc' | 'desc' | undefined,
    // v4: fixed page size of 10 (one billed page); legacy allows up to 25.
    limit: CREDIT_SYSTEM_ENABLED ? DISCOVERY_PAGE_SIZE : Math.min(num('limit') ?? 10, 25),
    page: requestedPage,
    logUserId: userId,
  }

  if (task) {
    // Unseen page of an existing task: search with the task's stored
    // parameters so results stay consistent even if the client's filter
    // state has drifted since the task was created.
    Object.assign(searchOpts, task.request as any, {
      page: requestedPage,
      logUserId: userId,
    })
  }

  // Persist the fetched page into its task (creating the task on a fresh
  // search) and return the task id for the client to keep. Best-effort: a
  // persistence failure must not hide results.
  const persistTaskPage = async (result: any): Promise<string | null> => {
    try {
      if (task) {
        await prisma.discoveryTaskPage.upsert({
          where: { taskId_page: { taskId: task.id, page: requestedPage } },
          create: { taskId: task.id, page: requestedPage, data: result },
          update: { data: result },
        })
        await prisma.discoverySearchTask.update({
          where: { id: task.id },
          data: { updatedAt: new Date() },
        })
        return task.id
      }
      const { logUserId: _u, page: _p, ...requestRest } = searchOpts as any
      const label =
        [searchOpts.platform, searchOpts.query, searchOpts.country]
          .filter(Boolean)
          .join(' · ') || searchOpts.platform
      const created = await prisma.discoverySearchTask.create({
        data: {
          userId,
          platform: searchOpts.platform,
          // Strip undefined values (not representable in Json columns)
          request: JSON.parse(JSON.stringify(requestRest)),
          label,
          pages: { create: { page: requestedPage, data: result } },
        },
        select: { id: true },
      })
      return created.id
    } catch (err) {
      console.error('discovery task persistence failed:', err)
      return task?.id ?? null
    }
  }

  // Pricing v4: every search page costs credits (config: discovery_search per
  // page of 10). Charged up front; adjusted after results come back. The
  // cache probe is free, so it runs in parallel with the wallet charge —
  // repeat searches skip the vendor round-trip entirely.
  // YouTube keyword searches run on the YouTube Data API instead of the
  // club API (richer fields: country/bio/language/niche, stable avatars).
  // Results are shaped identically, and billing is unchanged.
  const useYoutube =
    searchOpts.platform === 'youtube' && youtubeConfigured() && Boolean(searchOpts.query)
  const ytWarnings: string[] = []
  if (useYoutube) {
    // Club-only filters that the YouTube path can't honor — same "skipped"
    // warnings the club path emits for unsupported platform filters.
    if (gender) ytWarnings.push('Gender filter is not available on youtube — skipped.')
    for (const def of CLUB_FILTER_DEFS) {
      if (advanced[def.id] != null) {
        ytWarnings.push(`Filter "${def.label.en}" is not available on youtube — skipped.`)
      }
    }
    if (creatorHas.length) {
      ytWarnings.push('Creator-has filters are not available on youtube — skipped.')
    }
  }

  let searchCharge: { referenceId: string; refund: () => Promise<void> } | null = null
  let cachedResult: Awaited<ReturnType<typeof clubSearchCacheProbe>> = null
  if (CREDIT_SYSTEM_ENABLED) {
    const referenceId = `discovery:${userId}:${Date.now()}`
    const [probe, charge] = await Promise.all([
      // The YouTube path has its own pool cache inside youtubeSearchCreators
      useYoutube ? Promise.resolve(null) : clubSearchCacheProbe(searchOpts),
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
    const result = await mergeEnrichedProfileFields(
      useYoutube
        ? await youtubeSearchCreators({
            query: searchOpts.query!,
            country: searchOpts.country,
            language: searchOpts.language,
            minFollowers: searchOpts.minFollowers,
            maxFollowers: searchOpts.maxFollowers,
            minEngagement: searchOpts.minEngagement,
            maxEngagement: searchOpts.maxEngagement,
            bioKeywords: searchOpts.bioKeywords ?? [],
            lastPost: searchOpts.lastPost,
            sortBy: searchOpts.sortBy,
            sortOrder: searchOpts.sortOrder,
            limit: searchOpts.limit,
            page: searchOpts.page,
            warnings: ytWarnings,
            // Engagement backfill runs after the response is sent
            defer: (task) => after(task),
          })
        : cachedResult ?? (await clubSearch(searchOpts))
    )
    settleAfterResponse(result?.results?.length ?? 0)
    const taskId = await persistTaskPage(result)
    return NextResponse.json({ ...result, task_id: taskId, page: requestedPage })
  } catch (err: any) {
    console.warn('Influencers Club search unavailable; using Overseed creator index:', err?.message)
    const local = await safeLocalCreatorDiscovery(params, true)
    settleAfterResponse(local?.results?.length ?? 0)
    // Fallback results were billed the same way — snapshot them so a
    // revisit of this page stays free.
    const taskId = await persistTaskPage(local)
    return NextResponse.json({ ...local, task_id: taskId, page: requestedPage })
  }
}
