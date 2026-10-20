import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/discovery/creator-lookup — fuzzy search by handle or display name.
// Lightweight wrapper around CreatorDB's /{platform}/search endpoint with
// fuzzy matching. Returns up to 10 results so the user can pick the right one.
// Uses plain fetch (no creatorDbFetch wrapper) to avoid the credit-log DB
// dependency — this is a low-cost search, not a metered enrichment call.

const BASE = 'https://apiv3.creatordb.app'
const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const
type Platform = (typeof PLATFORMS)[number]

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}))
  const platform = body.platform as Platform
  const query = (body.query as string)?.trim()

  if (!PLATFORMS.includes(platform) || !query) {
    return NextResponse.json({ message: 'platform and query required' }, { status: 400 })
  }

  const apiKey = process.env.CREATORDB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ message: 'CreatorDB not configured' }, { status: 503 })
  }

  const cleanQuery = query.replace(/^@/, '')
  // Normalize spaces → underscores for the handle variant (Instagram/TikTok
  // handles use underscores where users might type spaces).
  const handleVariant = cleanQuery.replace(/\s+/g, '_').toLowerCase()

  const headers = { 'Content-Type': 'application/json', 'api-key': apiKey }

  const doSearch = async (filterName: string, value: string): Promise<any[]> => {
    try {
      const res = await fetch(`${BASE}/${platform}/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filters: [{ filterName, op: '=', value, isFuzzySearch: true }],
          pageSize: 10,
          offset: 0,
        }),
      })
      if (!res.ok) return []
      const data = await res.json().catch(() => null)
      // CreatorDB search nests results under data.data.creatorList
      const list = data?.data?.creatorList
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }

  try {
    // Search both uniqueId and displayName in parallel, then merge & dedupe.
    const [byHandle, byName] = await Promise.all([
      doSearch('uniqueId', handleVariant),
      doSearch('displayName', cleanQuery),
    ])

    const seen = new Set<string>()
    const merged: any[] = []
    for (const c of [...byHandle, ...byName]) {
      const key = c.uniqueId || c.channelId
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(c)
    }

    const items = merged.slice(0, 10).map((c: any) => ({
      handle: c.uniqueId || c.channelId || null,
      display_name: c.displayName || c.uniqueId || null,
      avatar_url: c.profile?.profileImage || c.profileImage || null,
      follower_count: c.totalFollowers ?? c.totalSubscribers ?? null,
      platform,
    }))

    return NextResponse.json({ results: items })
  } catch (err: any) {
    console.error('Creator lookup fuzzy search failed:', err.message)
    return NextResponse.json({ results: [] }, { status: 200 })
  }
}
