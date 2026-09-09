import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const userId = (session.user as any).id
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found', code: 'UNAUTHORIZED' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLanguage: true, autoTranslateUGC: true },
  })

  return NextResponse.json({
    language: user?.preferredLanguage || 'en',
    autoTranslateUGC: user?.autoTranslateUGC ?? true,
  })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const userId = (session.user as any).id
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found', code: 'UNAUTHORIZED' }, { status: 400 })
  }

  const body = await request.json()
  const { language, autoTranslateUGC } = body

  const updateData: Record<string, any> = {}

  if (language !== undefined) {
    if (language !== 'en' && language !== 'zh') {
      return NextResponse.json(
        { error: 'Invalid language. Must be "en" or "zh"', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    updateData.preferredLanguage = language
  }

  if (autoTranslateUGC !== undefined) {
    updateData.autoTranslateUGC = Boolean(autoTranslateUGC)
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })

  return NextResponse.json({ success: true, ...updateData })
}
