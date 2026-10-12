import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/discovery/viewed-profiles — the current user's profile view
// history from discovery_view_cache, most recently viewed first. Free.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const views = await prisma.discoveryViewCache.findMany({
      where: { userId, kind: 'profile' },
      orderBy: { fetchedAt: 'desc' },
      take: 50,
      select: { platform: true, handle: true, data: true, fetchedAt: true },
    })

    // Also check the shared enrichment cache via raw query (avoids Prisma
    // client issues when the model hasn't been regenerated in this process).
    let enriched: { platform: string; handle: string; data: any; fetchedAt: Date }[] = []
    try {
      enriched = await prisma.$queryRaw<{ platform: string; handle: string; data: any; fetchedAt: Date }[]>`
        SELECT platform, handle, data, "fetchedAt" FROM creator_enrichment_cache ORDER BY "fetchedAt" DESC LIMIT 50
      ` ?? []
    } catch {
      // Table may not exist or query fails — skip
    }

    // Merge and deduplicate by platform+handle
    const seen = new Set<string>()
    const all: typeof views = []
    for (const v of views) {
      const key = `${v.platform}:${v.handle}`
      if (seen.has(key)) continue
      seen.add(key)
      all.push(v)
    }
    for (const v of enriched) {
      const key = `${v.platform}:${v.handle}`
      if (seen.has(key)) continue
      seen.add(key)
      all.push(v as any)
    }
    all.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime())

    return NextResponse.json({
      profiles: all.slice(0, 50).map((v) => {
        const raw = v.data as any
        const d = raw?.detail ?? raw
        return {
          platform: v.platform,
          handle: v.handle,
          name: d?.name || d?.display_name || v.handle,
          avatar_url: d?.avatar_url || null,
          followers: d?.followers ?? d?.total_followers ?? null,
          country: d?.location || null,
          viewed_at: v.fetchedAt,
        }
      }),
    })
  } catch (err: any) {
    console.error('[viewed-profiles] Error:', err)
    return NextResponse.json(
      { message: err?.message || 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
