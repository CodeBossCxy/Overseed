import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { creatorDbFetch } from '@/lib/creatordb-usage'

// POST /api/discovery/creator-niches
// Accepts: { creators: [{ platform, handle }] }
// Returns: { niches: { "instagram:handle": ["id_fashion_All", ...], ... } }
//
// Each uncached creator costs 0.3 CreatorDB credits (3 fields × 0.1 each:
// niches, avatarUrl, bio). Requires Fractional Calls enabled on the API key.
// Results are cached per platform+handle to avoid repeat charges.
// hasEmail and hasSponsors are NOT fetched here — hasEmail is fetched on
// demand at outreach time to save credits during discovery browsing.

const BASE = 'https://apiv3.creatordb.app'
const MAX_CREATORS = 25
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 500

const PLATFORM_PATH: Record<string, string> = {
  instagram: 'instagram',
  youtube: 'youtube',
  tiktok: 'tiktok',
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'api-key': process.env.CREATORDB_API_KEY!,
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/
function stripContactLines(bio: string | null): string | null {
  if (!bio) return bio
  return bio.split('\n').filter(l => !EMAIL_RE.test(l) && !PHONE_RE.test(l)).join('\n') || null
}

interface ProfileResult {
  niches: string[]
  avatarUrl: string | null
  bio: string | null
}

async function fetchProfileForCreator(
  platform: string,
  handle: string,
  userId: string | undefined,
): Promise<ProfileResult> {
  const empty: ProfileResult = { niches: [], avatarUrl: null, bio: null }
  const platformPath = PLATFORM_PATH[platform]
  if (!platformPath) return empty

  // Fractional profile call: 0.1 credit per field × 3 fields = 0.3 credits per creator
  const body = { uniqueId: handle, fields: ['niches', 'avatarUrl', 'bio'] }

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await creatorDbFetch(
        `${BASE}/${platformPath}/profile`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body),
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        },
        { userId },
      )

      const data = await res.clone().json().catch(() => null)

      // Handle FractionalCallsNotEnabled — log clearly and don't retry
      if (data?.errorCode === 'FractionalCallsNotEnabled' || data?.error === 'FractionalCallsNotEnabled') {
        console.error(
          `[creator-niches] FractionalCallsNotEnabled — each /profile call costs 2 credits instead of 0.1. ` +
          `Enable Fractional Calls on the CreatorDB API key to reduce costs.`,
        )
        return empty
      }

      // Handle rate limit — retry with exponential backoff
      if (res.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        console.warn(`[creator-niches] 429 RATE_LIMIT_EXCEEDED for ${platform}:${handle} after ${MAX_RETRIES} retries`)
        return empty
      }

      if (!res.ok || !data?.success) {
        console.warn(`[creator-niches] /profile failed for ${platform}:${handle}: ${res.status} ${data?.errorDescription || data?.error || ''}`)
        return empty
      }

      const niches: string[] = Array.isArray(data.data?.niches) ? data.data.niches : []
      const avatarUrl: string | null = typeof data.data?.avatarUrl === 'string' ? data.data.avatarUrl : null
      const bio: string | null = stripContactLines(typeof data.data?.bio === 'string' ? data.data.bio : null)
      return { niches, avatarUrl, bio }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
    }
  }

  console.warn(`[creator-niches] All retries failed for ${platform}:${handle}:`, lastError?.message)
  return empty
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id

  if (!process.env.CREATORDB_API_KEY) {
    return NextResponse.json({ message: 'CreatorDB not configured', code: 'NOT_CONFIGURED' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const creators: { platform: string; handle: string }[] = body?.creators
  if (!Array.isArray(creators) || creators.length === 0) {
    return NextResponse.json({ message: 'creators[] required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Dedupe and limit
  const seen = new Set<string>()
  const unique: { platform: string; handle: string }[] = []
  for (const c of creators) {
    if (!c.platform || !c.handle || !PLATFORM_PATH[c.platform]) continue
    const key = `${c.platform}:${c.handle.replace(/^@/, '').toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ platform: c.platform, handle: c.handle.replace(/^@/, '').toLowerCase() })
    if (unique.length >= MAX_CREATORS) break
  }

  // Check cache for all creators
  const cached = await prisma.creatorNicheCache.findMany({
    where: {
      OR: unique.map((c) => ({ platform: c.platform, handle: c.handle })),
    },
  })
  const cachedMap = new Map(cached.map((c) => [`${c.platform}:${c.handle}`, c.niches]))

  // Determine which need fetching
  const toFetch = unique.filter((c) => !cachedMap.has(`${c.platform}:${c.handle}`))

  // Fetch all uncached in parallel
  const avatars: Record<string, string> = {}
  const bios: Record<string, string> = {}

  // Populate bios from cache first
  for (const c of cached) {
    if (c.bio) bios[`${c.platform}:${c.handle}`] = c.bio
  }

  const fetchResults = await Promise.allSettled(
    toFetch.map(async (c) => {
      const profile = await fetchProfileForCreator(c.platform, c.handle, userId)
      // Cache niches + bio to avoid re-fetching
      await prisma.creatorNicheCache.upsert({
        where: { platform_handle: { platform: c.platform, handle: c.handle } },
        create: { platform: c.platform, handle: c.handle, niches: profile.niches, bio: profile.bio },
        update: { niches: profile.niches, bio: profile.bio, fetchedAt: new Date() },
      }).catch((e) => console.error(`[creator-niches] cache write failed for ${c.platform}:${c.handle}:`, e))
      const key = `${c.platform}:${c.handle}`
      if (profile.avatarUrl) avatars[key] = profile.avatarUrl
      if (profile.bio) bios[key] = profile.bio
      return { key, niches: profile.niches }
    }),
  )

  // Build response maps
  const nicheResult: Record<string, string[]> = {}
  for (const [key, niches] of cachedMap) {
    nicheResult[key] = niches
  }
  for (const r of fetchResults) {
    if (r.status === 'fulfilled') {
      nicheResult[r.value.key] = r.value.niches
    }
  }

  return NextResponse.json({
    niches: nicheResult,
    avatars,
    bios,
    cached: cached.length,
    fetched: toFetch.length,
  })
}
