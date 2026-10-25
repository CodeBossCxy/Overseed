import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/discovery/contacted-keys — returns platform:handle keys for creators
// this brand has previously contacted, for showing "Manage Collaboration" state.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ keys: {} })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!brand) return NextResponse.json({ keys: {} })

  // Get creators contacted via outreach (both single and mass).
  // Single contacts via club-contact create OutreachCampaign with userId,
  // mass outreach uses brandId — query by both to catch all.
  const outreach = await prisma.outreachRecipient.findMany({
    where: {
      outreachCampaign: {
        OR: [
          { brandId: brand.id },
          { userId },
        ],
      },
      status: { in: ['PENDING', 'SENT', 'DELIVERED'] },
    },
    select: { platform: true, handle: true, status: true, sentAt: true },
    orderBy: { sentAt: 'desc' },
  })

  const keys: Record<string, { status: string; sentAt: string | null }> = {}

  for (const r of outreach) {
    const key = `${r.platform}:${r.handle}`
    // Keep the most recent entry per creator
    if (!keys[key]) {
      keys[key] = { status: r.status, sentAt: r.sentAt?.toISOString() ?? null }
    }
  }

  return NextResponse.json({ keys })
}
