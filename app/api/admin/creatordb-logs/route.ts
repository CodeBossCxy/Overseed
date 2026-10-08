import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/creatordb-logs
// Query params:
//   limit     — max rows (default 50, max 200)
//   offset    — pagination offset (default 0)
//   userId    — filter by user
//   platform  — filter by platform (instagram, tiktok, youtube)
//   success   — filter by success (true/false)
//   from      — start date (ISO string)
//   to        — end date (ISO string)
//   summary   — if "true", return aggregated stats instead of rows

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).userType !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const summary = params.get('summary') === 'true'

  const where: Record<string, unknown> = {}
  if (params.get('userId')) where.userId = params.get('userId')
  if (params.get('platform')) where.platform = params.get('platform')
  if (params.get('success') === 'true') where.success = true
  if (params.get('success') === 'false') where.success = false

  const from = params.get('from')
  const to = params.get('to')
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  if (summary) {
    const [rows, totalCreditsUsed, byPlatform, byUser] = await Promise.all([
      prisma.creatorDbCreditLog.count({ where }),
      prisma.creatorDbCreditLog.aggregate({
        where,
        _sum: { creditsUsedThis: true },
        _min: { creditsAfter: true, createdAt: true },
        _max: { creditsBefore: true, createdAt: true },
      }),
      prisma.creatorDbCreditLog.groupBy({
        by: ['platform'],
        where,
        _count: true,
        _sum: { creditsUsedThis: true },
      }),
      prisma.creatorDbCreditLog.groupBy({
        by: ['userId'],
        where,
        _count: true,
        _sum: { creditsUsedThis: true },
        orderBy: { _sum: { creditsUsedThis: 'desc' } },
        take: 20,
      }),
    ])

    return NextResponse.json({
      totalRows: rows,
      totalCreditsUsed: totalCreditsUsed._sum.creditsUsedThis ?? 0,
      creditsBefore: totalCreditsUsed._max.creditsBefore ?? null,
      creditsAfter: totalCreditsUsed._min.creditsAfter ?? null,
      firstEntry: totalCreditsUsed._min.createdAt ?? null,
      lastEntry: totalCreditsUsed._max.createdAt ?? null,
      byPlatform: byPlatform.map((r) => ({
        platform: r.platform,
        count: r._count,
        creditsUsed: r._sum.creditsUsedThis ?? 0,
      })),
      topUsers: byUser.map((r) => ({
        userId: r.userId,
        count: r._count,
        creditsUsed: r._sum.creditsUsedThis ?? 0,
      })),
    })
  }

  const limit = Math.min(Number(params.get('limit')) || 50, 200)
  const offset = Number(params.get('offset')) || 0

  const [logs, total] = await Promise.all([
    prisma.creatorDbCreditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.creatorDbCreditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, limit, offset })
}
