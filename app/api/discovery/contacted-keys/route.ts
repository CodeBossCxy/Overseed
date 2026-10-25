import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/discovery/contacted-keys — returns platform:handle keys for creators
// this brand has previously contacted, for showing "Manage Collaboration" state.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ keys: [] })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!brand) return NextResponse.json({ keys: [] })

  // Get creators contacted via mass outreach (OutreachRecipient)
  const massOutreach = await prisma.outreachRecipient.findMany({
    where: {
      outreachCampaign: { brandId: brand.id },
      status: { in: ['SENT', 'DELIVERED'] },
    },
    select: { platform: true, handle: true, status: true, sentAt: true },
    distinct: ['platform', 'handle'],
  })

  // Get creators contacted via single outreach (club-contact updates CreatorProfile)
  // We check CreatorProfile.lastContactedAt for creators this brand has contacted.
  // Since CreatorProfile is shared across brands, we also check OutreachRecipient.
  // For single contacts, we look at the ops email log — but that's not in DB.
  // Use a simpler approach: check CreatorProfile entries that were contacted.

  const keys: Record<string, { status: string; sentAt: string | null }> = {}

  for (const r of massOutreach) {
    const key = `${r.platform}:${r.handle}`
    keys[key] = { status: r.status, sentAt: r.sentAt?.toISOString() ?? null }
  }

  return NextResponse.json({ keys })
}
