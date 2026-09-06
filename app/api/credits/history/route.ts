export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'

// GET /api/credits/history?cursor=&limit= — the user's credit ledger,
// newest first (grants, deductions, refunds, expiries).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  if (!CREDIT_SYSTEM_ENABLED) {
    return NextResponse.json({ entries: [], nextCursor: null, legacy: true })
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10) || 50, 100)
  const cursor = req.nextUrl.searchParams.get('cursor')

  const entries = await prisma.creditLedgerEntry.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], // id tie-break for stable cursors
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      delta: true,
      type: true,
      bucket: true,
      featureKey: true,
      referenceId: true,
      balanceAfter: true,
      createdAt: true,
    },
  })

  const nextCursor = entries.length > limit ? entries[limit].id : null
  return NextResponse.json({ entries: entries.slice(0, limit), nextCursor })
}
