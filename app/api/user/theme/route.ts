import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_COLOR_THEMES = ['default', 'dawn', 'sunset']

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { colorTheme: true },
  })

  return NextResponse.json({ colorTheme: user?.colorTheme || 'default' })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found' }, { status: 400 })
  }

  const body = await request.json()
  const { colorTheme } = body

  if (!VALID_COLOR_THEMES.includes(colorTheme)) {
    return NextResponse.json(
      { error: `Invalid theme. Must be one of: ${VALID_COLOR_THEMES.join(', ')}` },
      { status: 400 }
    )
  }

  await prisma.user.update({
    where: { id: userId },
    data: { colorTheme },
  })

  return NextResponse.json({ success: true, colorTheme })
}
