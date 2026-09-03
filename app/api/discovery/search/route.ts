import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KOL_API_URL, kolAuthHeaders, safeLocalCreatorDiscovery, sanitizeResults } from '@/lib/discovery'
import { consumeQuota } from '@/lib/plan'
import { getEffectiveTier } from '@/lib/subscription'
import { deductCredits } from '@/lib/credits'

// GET /api/discovery/search
// Brand-only proxy to the KOL discovery service (cache-first creator search).
// The KOL service itself is unauthenticated and must never be exposed
// publicly — it is only reachable through this route.
const FORWARDED_PARAMS = [
  'topics',
  'q',
  'platforms',
  'country',
  'language',
  'min_followers',
  'max_followers',
  'limit',
  'offset',
] as const

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!brand) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const incoming = req.nextUrl.searchParams

  // Pricing v3: keyword/topic searches consume the monthly discovery quota;
  // once the quota is exhausted, extra searches bill 6 credits each.
  // Plain browsing (no q/topics) stays unmetered.
  const isKeywordSearch = Boolean(incoming.get('q') || incoming.get('topics'))
  if (isKeywordSearch) {
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

  try {
    const target = new URL('/search', KOL_API_URL)
    for (const key of FORWARDED_PARAMS) {
      const value = incoming.get(key)
      if (value) target.searchParams.set(key, value)
    }
    const res = await fetch(target, {
      cache: 'no-store',
      headers: kolAuthHeaders(),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return NextResponse.json(await safeLocalCreatorDiscovery(incoming, true))
    return NextResponse.json(sanitizeResults(data))
  } catch {
    return NextResponse.json(await safeLocalCreatorDiscovery(incoming, true))
  }
}
