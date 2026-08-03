import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KOL_API_URL, safeLocalCreatorDiscovery, sanitizeResults } from '@/lib/discovery'

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

  try {
    const target = new URL('/search', KOL_API_URL)
    for (const key of FORWARDED_PARAMS) {
      const value = incoming.get(key)
      if (value) target.searchParams.set(key, value)
    }
    const res = await fetch(target, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return NextResponse.json(await safeLocalCreatorDiscovery(incoming, true))
    return NextResponse.json(sanitizeResults(data))
  } catch {
    return NextResponse.json(await safeLocalCreatorDiscovery(incoming, true))
  }
}
