import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import OpenAI, { toFile } from 'openai'
import { authOptions } from '@/lib/auth'
import { getEffectiveTier, isUserVerified } from '@/lib/subscription'
import { CREDIT_COSTS, deductCredits, refundDeduction } from '@/lib/credits'
import { uploadFile } from '@/lib/upload'
import { CREDIT_SYSTEM_ENABLED } from '@/lib/config'
import { chargeCredits } from '@/lib/metering'
import { walletRefund } from '@/lib/wallet'
import { imageRequestSchema, MAX_PRODUCT_IMAGES, MAX_PRODUCT_IMAGE_BYTES, PRODUCT_IMAGE_TYPES } from '@/lib/ai-image-options'

export const maxDuration = 180

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  const userId = (session.user as any).id
  if (!(await isUserVerified(userId))) {
    return NextResponse.json({ message: 'Verification required', code: 'VERIFICATION_REQUIRED' }, { status: 403 })
  }
  // All tiers may generate images (pricing v3) — credits are the gate.
  const tier = await getEffectiveTier(userId)
  let input: unknown
  let productImages: File[] = []
  try {
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await req.formData()
      input = Object.fromEntries(form.entries())
      const uploads = form.getAll('images')
      if (uploads.some(upload => typeof upload === 'string')) throw new Error('Invalid product image')
      productImages = uploads as File[]
    } else {
      input = await req.json()
    }
  } catch {
    return NextResponse.json({ message: 'Invalid image request', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const parsed = imageRequestSchema.safeParse(input)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Use a 3–1500 character description and valid image settings.', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (productImages.length > MAX_PRODUCT_IMAGES || productImages.some(image => !PRODUCT_IMAGE_TYPES.includes(image.type) || image.size === 0 || image.size > MAX_PRODUCT_IMAGE_BYTES)) {
    return NextResponse.json({ message: 'Upload up to 6 JPG, PNG or WebP images, at most 5 MB each.', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const { prompt, imageType, language, size, quality, count } = parsed.data
  const apiKey = process.env.CHAT_API
  if (!apiKey) return NextResponse.json({ message: 'Image generation is not configured', code: 'UPSTREAM_ERROR' }, { status: 503 })

  // Bill image credits up front; refunded if generation fails.
  const creditRef = `image:${userId}:${crypto.randomUUID()}`
  if (CREDIT_SYSTEM_ENABLED) {
    const charge = await chargeCredits(userId, 'image', creditRef, { quantity: count })
    if (!charge.ok) return NextResponse.json(charge.body, { status: charge.status })
  } else {
    const deduction = await deductCredits(userId, tier, 'image', creditRef, CREDIT_COSTS.image * count)
    if (!deduction.ok) {
      return NextResponse.json(
        {
          message: 'Not enough AI credits. Buy a credit pack or wait for your monthly allowance to reset.',
          code: 'INSUFFICIENT_CREDITS',
          required: deduction.cost,
          available: deduction.available,
        },
        { status: 402 }
      )
    }
  }

  try {
    const client = new OpenAI({ apiKey })
    const imageDirections = {
      main: 'Create a polished product hero image with a clear focal point and clean composition.',
      detail: 'Create a product detail image highlighting materials, construction, and important features.',
      ad: 'Create an engaging advertising visual with a strong product focus and space for campaign messaging.',
    }
    const languageNames = { en: 'English', zh: 'Chinese', es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese' }
    const generationPrompt = [
      imageDirections[imageType],
      prompt,
      language === 'none' ? 'Do not add any text, lettering, or captions.' : `Any text you add must be in ${languageNames[language]}.`,
      ...(productImages.length ? ['Use the supplied product photos as references. Preserve the product identity, shape, colors, and details.'] : []),
    ].join('\n\n')
    const options = {
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      prompt: generationPrompt,
      size,
      quality,
      n: count,
    }
    const result = productImages.length
      ? await client.images.edit({ ...options, image: await Promise.all(productImages.map(async image => toFile(Buffer.from(await image.arrayBuffer()), image.name, { type: image.type }))) })
      : await client.images.generate(options)
    if (result.data?.length !== count || result.data.some(image => !image.b64_json)) throw new Error('Incomplete image results returned')
    const urls = await Promise.all(result.data.map(image => uploadFile(Buffer.from(image.b64_json!, 'base64'), 'generated.png', 'image/png', 'ai_generated/')))
    return NextResponse.json({ url: urls[0], urls })
  } catch (error: any) {
    try {
      if (CREDIT_SYSTEM_ENABLED) await walletRefund(userId, creditRef)
      else await refundDeduction(userId, creditRef)
    } catch (refundErr) {
      console.error('Credit refund failed:', refundErr)
    }
    return NextResponse.json({ message: error?.message || 'Image generation failed', code: 'UPSTREAM_ERROR' }, { status: 502 })
  }
}
