import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/auth/record-invite — records which invite code an OAuth user used.
// Called once from the client after OAuth signup completes. Idempotent: if the
// user already has an invite usage row, this is a no-op.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id

  const body = await req.json().catch(() => null)
  const code = (body?.inviteCode as string)?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'inviteCode required' }, { status: 400 })
  }

  // Already recorded?
  const existing = await prisma.betaInviteUsage.findFirst({ where: { userId } })
  if (existing) {
    return NextResponse.json({ ok: true, already: true })
  }

  const betaCode = await prisma.betaInviteCode.findUnique({ where: { code } })
  if (!betaCode) {
    return NextResponse.json({ error: 'Unknown code' }, { status: 404 })
  }

  await prisma.$transaction([
    prisma.betaInviteCode.update({
      where: { id: betaCode.id },
      data: { usedCount: { increment: 1 } },
    }),
    prisma.betaInviteUsage.create({
      data: { inviteCodeId: betaCode.id, userId },
    }),
  ])

  return NextResponse.json({ ok: true })
}
