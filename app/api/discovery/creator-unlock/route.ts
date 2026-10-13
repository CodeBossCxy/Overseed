import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits, hasPriorCharge } from '@/lib/metering'
import { deductCredits, hasPriorDeduction } from '@/lib/credits'
import { getEffectiveTier } from '@/lib/subscription'
import {
  creatordbAudienceFeature,
  creatordbSponsorship,
  CreatorDbApiError,
} from '@/lib/creatordb'

// GET  /api/discovery/creator-unlock?platform=&handle= — list unlocked features + cached data
// POST /api/discovery/creator-unlock — unlock a feature (deducts credits after valid data)

const VALID_FEATURES = [
  'audience_gender',
  'audience_age',
  'audience_country',
  'brand_collaborations',
] as const
type Feature = (typeof VALID_FEATURES)[number]

const FEATURE_CREDITS: Record<Feature, number> = {
  audience_gender: 12,
  audience_age: 12,
  audience_country: 12,
  brand_collaborations: 10,
}

const VALID_PLATFORMS = ['instagram', 'youtube', 'tiktok']
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const platform = req.nextUrl.searchParams.get('platform')
  const handle = req.nextUrl.searchParams.get('handle')?.trim()?.replace(/^@/, '').toLowerCase()
  if (!platform || !handle) {
    return NextResponse.json({ message: 'platform and handle required' }, { status: 400 })
  }

  // Fetch all unlocks for this user + creator
  const unlocks = await prisma.creatorFeatureUnlock.findMany({
    where: { userId, platform, handle },
    select: { feature: true },
  })
  const unlockedSet = new Set(unlocks.map((u) => u.feature))

  // Fetch cached data for unlocked features
  const result: Record<string, any> = {}
  if (unlockedSet.size > 0) {
    const cached = await prisma.creatorFeatureCache.findMany({
      where: {
        platform,
        handle,
        feature: { in: [...unlockedSet] },
      },
    })
    for (const c of cached) {
      result[c.feature] = c.data
    }
  }

  return NextResponse.json({
    unlocked: [...unlockedSet],
    data: result,
  })
}

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null)
  const platform = body?.platform as string
  const handle = (body?.handle as string)?.trim()?.replace(/^@/, '').toLowerCase()
  const feature = body?.feature as Feature

  if (!platform || !handle || !feature) {
    return NextResponse.json(
      { message: 'platform, handle, and feature are required', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { message: `Unsupported platform: ${platform}`, code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  if (!VALID_FEATURES.includes(feature)) {
    return NextResponse.json(
      { message: `Unknown feature: ${feature}`, code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  // brand_collaborations only on YouTube and Instagram
  if (feature === 'brand_collaborations' && platform === 'tiktok') {
    return NextResponse.json(
      { message: 'Brand collaborations are not available for TikTok', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  // Bundle pricing: when costOverride is passed (e.g. from the "Unlock All"
  // bundle), use it instead of the per-feature price.
  const costOverride = typeof body?.costOverride === 'number' && body.costOverride >= 0 ? body.costOverride : null
  const cost = costOverride ?? FEATURE_CREDITS[feature]

  // ── 1. Check if user already unlocked this feature (free replay) ──
  const unlockKey = { userId, platform, handle, feature }
  try {
    const existing = await prisma.creatorFeatureUnlock.findUnique({
      where: { userId_platform_handle_feature: unlockKey },
    })
    if (existing) {
      // Already unlocked — serve data from shared cache (should exist)
      const cached = await prisma.creatorFeatureCache.findUnique({
        where: { platform_handle_feature: { platform, handle, feature } },
      })
      if (cached) {
        return NextResponse.json({ feature, data: cached.data, unlocked: true, cost: 0 })
      }
      // Cache expired or missing — re-fetch without charging
      const result = await fetchFeature(platform, handle, feature, userId)
      if (result) {
        await upsertCache(platform, handle, feature, result.data)
        return NextResponse.json({ feature, data: result.data, unlocked: true, cost: 0 })
      }
      return NextResponse.json(
        { message: 'Data not available for this creator', code: 'NO_DATA' },
        { status: 404 },
      )
    }
  } catch (e) {
    console.error('[creator-unlock] unlock check failed:', e)
  }

  // ── 2. Check shared cache (serves data but still charges Overseed credits) ──
  try {
    const cached = await prisma.creatorFeatureCache.findUnique({
      where: { platform_handle_feature: { platform, handle, feature } },
    })
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_MAX_AGE_MS) {
      // Cache hit — charge credits, persist unlock, return data
      const chargeResult = await charge(userId, platform, handle, feature, cost)
      if (!chargeResult.ok) {
        return NextResponse.json(chargeResult.body, { status: chargeResult.status })
      }
      await persistUnlock(userId, platform, handle, feature, cost)
      return NextResponse.json({ feature, data: cached.data, unlocked: true, cost })
    }
  } catch (e) {
    console.error('[creator-unlock] cache check failed:', e)
  }

  // ── 3. Call CreatorDB ──
  let result: { feature: string; data: any } | null
  try {
    result = await fetchFeature(platform, handle, feature, userId)
  } catch (err: any) {
    if (err instanceof CreatorDbApiError && err.errorCode === 'FractionalCallsNotEnabled') {
      return NextResponse.json(
        { message: 'This feature requires fractional calls enabled on the API key', code: 'FRACTIONAL_NOT_ENABLED' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { message: err?.message || 'Upstream error', code: 'UPSTREAM_ERROR' },
      { status: 502 },
    )
  }

  // Empty / no data — don't charge
  if (!result) {
    return NextResponse.json(
      { message: 'Data not available for this creator', code: 'NO_DATA' },
      { status: 404 },
    )
  }

  // ── 4. Charge credits (only after valid data) ──
  const chargeResult = await charge(userId, platform, handle, feature, cost)
  if (!chargeResult.ok) {
    return NextResponse.json(chargeResult.body, { status: chargeResult.status })
  }

  // ── 5. Persist unlock + update shared cache ──
  await persistUnlock(userId, platform, handle, feature, cost)
  await upsertCache(platform, handle, feature, result.data)

  return NextResponse.json({ feature, data: result.data, unlocked: true, cost })
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function fetchFeature(
  platform: string,
  handle: string,
  feature: Feature,
  userId: string,
) {
  if (feature === 'brand_collaborations') {
    return creatordbSponsorship(platform, handle, { logUserId: userId })
  }
  return creatordbAudienceFeature(platform, handle, feature, { logUserId: userId })
}

async function charge(
  userId: string,
  platform: string,
  handle: string,
  feature: Feature,
  cost: number,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const ref = `feature_unlock:${feature}:${platform}:${handle}`

  if (CREDIT_SYSTEM_ENABLED) {
    const already = await hasPriorCharge(userId, ref)
    if (already) return { ok: true }
    const c = await chargeCredits(userId, 'feature_unlock', ref, { costOverride: cost })
    if (!c.ok) return { ok: false, status: c.status, body: c.body }
    return { ok: true }
  }

  // Legacy v3
  const already = await hasPriorDeduction(userId, ref)
  if (already) return { ok: true }
  const tier = await getEffectiveTier(userId)
  const d = await deductCredits(userId, tier, 'feature_unlock', ref, cost)
  if (!d.ok) {
    return {
      ok: false,
      status: 402,
      body: {
        message: 'Not enough credits to unlock this feature.',
        code: 'INSUFFICIENT_CREDITS',
        required: cost,
        available: d.available,
      },
    }
  }
  return { ok: true }
}

async function persistUnlock(
  userId: string,
  platform: string,
  handle: string,
  feature: string,
  credits: number,
) {
  try {
    await prisma.creatorFeatureUnlock.upsert({
      where: { userId_platform_handle_feature: { userId, platform, handle, feature } },
      create: { userId, platform, handle, feature, credits },
      update: { credits },
    })
  } catch (e) {
    console.error('[creator-unlock] persistUnlock failed:', e)
  }
}

async function upsertCache(
  platform: string,
  handle: string,
  feature: string,
  data: any,
) {
  try {
    await prisma.creatorFeatureCache.upsert({
      where: { platform_handle_feature: { platform, handle, feature } },
      create: { platform, handle, feature, data },
      update: { data, fetchedAt: new Date() },
    })
  } catch (e) {
    console.error('[creator-unlock] upsertCache failed:', e)
  }
}
