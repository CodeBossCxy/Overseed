import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseSocialUrl } from '@/lib/social-url-parser'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ message: 'URL is required', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const result = parseSocialUrl(url)
    if (!result) {
      return NextResponse.json(
        { message: 'Unsupported or unrecognized social media URL', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Look up the platform by slug
    const platform = await prisma.platform.findUnique({
      where: { slug: result.platform },
    })

    return NextResponse.json({
      platform: result.platform,
      platformId: platform?.id || null,
      username: result.username,
    })
  } catch (error) {
    console.error('Error parsing social URL:', error)
    return NextResponse.json(
      { message: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
