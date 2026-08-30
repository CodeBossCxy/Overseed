import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from '@/lib/upload'
import { analyzeScreenshot } from '@/lib/screenshot-analyzer'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Check influencer profile
    const influencerProfile = await prisma.influencerProfile.findUnique({
      where: { userId },
    })

    if (!influencerProfile) {
      return NextResponse.json(
        { message: 'Influencer profile required' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const platformSlug = formData.get('platformSlug') as string | null

    if (!file) {
      return NextResponse.json({ message: 'File is required' }, { status: 400 })
    }

    if (!platformSlug) {
      return NextResponse.json({ message: 'Platform is required' }, { status: 400 })
    }

    // Validate file
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF` },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: 'File exceeds 4 MB limit' },
        { status: 400 }
      )
    }

    // Upload screenshot
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const screenshotUrl = await uploadFile(buffer, file.name, file.type, 'social_screenshot/')

    // Analyze screenshot with OpenAI Vision
    const analysis = await analyzeScreenshot(screenshotUrl, platformSlug)

    return NextResponse.json({
      screenshotUrl,
      analysis,
    })
  } catch (error) {
    console.error('Error analyzing screenshot:', error)
    return NextResponse.json(
      { message: 'Failed to analyze screenshot' },
      { status: 500 }
    )
  }
}
