import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST: Clear all auto-translated entries so they can be re-translated with the improved service
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['BRAND', 'ADMIN'].includes((session.user as any).userType)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const result = await prisma.translation.deleteMany({
      where: { isAutoTranslated: true },
    })

    return NextResponse.json({
      message: `Cleared ${result.count} auto-translated entries. They will be re-translated on next view.`,
      count: result.count,
    })
  } catch (error) {
    console.error('Error clearing translations:', error)
    return NextResponse.json({ message: 'Failed to clear translations' }, { status: 500 })
  }
}
