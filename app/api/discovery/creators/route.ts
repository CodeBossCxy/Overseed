import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KOL_API_URL, safeLocalCreatorDiscovery, sanitizeResults } from '@/lib/discovery'

// GET /api/discovery/creators
// Brand-only proxy to the KOL service's creator database browse endpoint.
const FORWARDED_PARAMS = [
  'platform',
  'country',
  'tags',
  'min_followers',
  'max_followers',
  'sort',
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
    const target = new URL('/creators', KOL_API_URL)
    for (const key of FORWARDED_PARAMS) {
      const value = incoming.get(key)
      if (value) target.searchParams.set(key, value)
    }
    const res = await fetch(target, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return NextResponse.json(await safeLocalCreatorDiscovery(incoming))
    return NextResponse.json(sanitizeResults(data))
  } catch {
    return NextResponse.json(await safeLocalCreatorDiscovery(incoming))
  }
}
