import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// In-memory cache — niches change rarely. Shared across requests.
let cache: { data: NicheEntry[]; fetchedAt: number } | null = null
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface NicheEntry {
  id: string
  name: string
  channelCount: number
}

async function fetchNiches(platform: string): Promise<NicheEntry[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data

  const apiKey = process.env.CREATORDB_API_KEY
  if (!apiKey) return []

  const res = await fetch(`https://apiv3.creatordb.app/${platform}/niches`, {
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return []

  const json = await res.json().catch(() => null)
  const raw = Array.isArray(json?.data) ? json.data : []

  // Dedupe by lowercase name, keep the one with highest channelCount
  const byName = new Map<string, NicheEntry>()
  for (const item of raw) {
    const name = String(item.name || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    const existing = byName.get(key)
    if (!existing || (item.channelCount || 0) > existing.channelCount) {
      byName.set(key, { id: item.id, name, channelCount: item.channelCount || 0 })
    }
  }

  const entries = [...byName.values()].sort((a, b) => b.channelCount - a.channelCount)
  cache = { data: entries, fetchedAt: Date.now() }
  return entries
}

// GET /api/discovery/niches?platform=instagram&q=fash&limit=20
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const platform = params.get('platform') || 'instagram'
  if (!['instagram', 'tiktok', 'youtube'].includes(platform)) {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  }

  const q = (params.get('q') || '').trim().toLowerCase()
  const limit = Math.min(Number(params.get('limit')) || 20, 50)

  const all = await fetchNiches(platform)

  let results: NicheEntry[]
  if (q) {
    // Prefix match first, then substring match
    const prefix = all.filter((n) => n.name.toLowerCase().startsWith(q))
    const substring = all.filter((n) => !n.name.toLowerCase().startsWith(q) && n.name.toLowerCase().includes(q))
    results = [...prefix, ...substring].slice(0, limit)
  } else {
    // No query — return top niches by channel count
    results = all.slice(0, limit)
  }

  return NextResponse.json({ niches: results })
}
