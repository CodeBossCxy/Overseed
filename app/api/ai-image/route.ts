import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import OpenAI from 'openai'
import { authOptions } from '@/lib/auth'
import { getEffectiveTier, isUserVerified } from '@/lib/subscription'
import { uploadFile } from '@/lib/upload'

export const maxDuration = 60

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  if (!(await isUserVerified(userId)) || await getEffectiveTier(userId) !== 'PRO') {
    return NextResponse.json({ message: 'Verified Pro access required' }, { status: 403 })
  }
  const { prompt } = await req.json().catch(() => ({ prompt: '' }))
  if (typeof prompt !== 'string' || prompt.trim().length < 3 || prompt.length > 1500) {
    return NextResponse.json({ message: 'Describe the image in 3-1500 characters' }, { status: 400 })
  }
  const apiKey = process.env.CHAT_API
  if (!apiKey) return NextResponse.json({ message: 'Image generation is not configured' }, { status: 503 })

  try {
    const client = new OpenAI({ apiKey })
    const result = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      prompt: prompt.trim(),
      size: '1024x1024',
      quality: 'medium',
    })
    const encoded = result.data?.[0]?.b64_json
    if (!encoded) throw new Error('No image returned')
    const url = await uploadFile(Buffer.from(encoded, 'base64'), 'generated.png', 'image/png', 'ai_generated/')
    return NextResponse.json({ url })
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Image generation failed' }, { status: 502 })
  }
}
