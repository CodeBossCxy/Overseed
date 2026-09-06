export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { walletGrant, invalidateWalletConfigCache, addMonths } from '@/lib/wallet'

// Admin credit management (pricing v4):
// GET   — all pricing config (plans, packs, feature prices)
// PATCH — edit one config row { kind: 'plan'|'pack'|'price', data }
// POST  — manual credit grant { email, credits, note, validityMonths? }

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).userType !== 'ADMIN') return null
  return session
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const [plans, packs, prices] = await Promise.all([
    prisma.planConfig.findMany({ orderBy: { priceMonthly: 'asc' } }),
    prisma.creditPackConfig.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.creditPriceConfig.findMany({ orderBy: { credits: 'asc' } }),
  ])
  return NextResponse.json({ plans, packs, prices })
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { kind, data } = await req.json().catch(() => ({}))
  try {
    if (kind === 'plan' && data?.tier) {
      const fields: Record<string, number> = {}
      for (const k of [
        'priceMonthly',
        'priceAnnual',
        'baseCredits',
        'bonusCredits',
        'migrationBonusPct',
        'migrationBonusCycles',
      ]) {
        const v = Number(data[k])
        if (Number.isInteger(v) && v >= 0) fields[k] = v
      }
      await prisma.planConfig.update({ where: { tier: data.tier }, data: fields })
    } else if (kind === 'pack' && data?.id) {
      const fields: Record<string, number | boolean> = {}
      for (const k of ['priceCents', 'baseCredits', 'bonusCredits', 'sortOrder']) {
        const v = Number(data[k])
        if (Number.isInteger(v) && v >= 0) fields[k] = v
      }
      for (const k of ['active', 'freeUserEligible']) {
        if (typeof data[k] === 'boolean') fields[k] = data[k]
      }
      await prisma.creditPackConfig.update({ where: { id: data.id }, data: fields })
    } else if (kind === 'price' && data?.featureKey) {
      const credits = Number(data.credits)
      if (!Number.isInteger(credits) || credits < 0) {
        return NextResponse.json({ error: 'credits must be a non-negative integer' }, { status: 400 })
      }
      await prisma.creditPriceConfig.update({
        where: { featureKey: data.featureKey },
        data: { credits },
      })
    } else {
      return NextResponse.json({ error: 'Invalid kind/data' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 400 })
  }
  invalidateWalletConfigCache()
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { email, credits, note, validityMonths } = await req.json().catch(() => ({}))
  const amount = Number(credits)
  if (!email || !Number.isInteger(amount) || amount <= 0 || !note?.trim()) {
    return NextResponse.json(
      { error: 'email, positive integer credits, and a note are required' },
      { status: 400 },
    )
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) {
    return NextResponse.json({ error: 'No user with that email' }, { status: 404 })
  }
  const months = Number.isInteger(Number(validityMonths)) && Number(validityMonths) > 0
    ? Number(validityMonths)
    : 12
  const adminEmail = (session.user as any).email
  await walletGrant(user.id, {
    bucket: 'PURCHASED',
    source: 'ADMIN',
    credits: amount,
    expiresAt: addMonths(new Date(), months),
    reference: `admin:${user.id}:${Date.now()}`,
    note: `${note.trim()} (by ${adminEmail})`,
  })
  return NextResponse.json({ ok: true })
}
