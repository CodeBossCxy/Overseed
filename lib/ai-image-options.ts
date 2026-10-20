import { z } from 'zod'

export const MAX_PRODUCT_IMAGES = 6
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(1500),
  imageType: z.enum(['main', 'detail']).default('main'),
  language: z.enum(['none', 'en', 'zh', 'es', 'fr', 'de', 'ja']).default('none'),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', '1024x1280', '1280x720']).default('1024x1024'),
  quality: z.enum(['low', 'medium', 'high']).default('medium'),
  count: z.coerce.number().int().refine(count => [1, 2, 4, 6].includes(count)).default(1),
})

export type ImageRequest = z.infer<typeof imageRequestSchema>
