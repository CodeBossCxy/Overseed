import { z } from 'zod'

export const MAX_PRODUCT_IMAGES = 6
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(1500),
  imageType: z.enum(['main', 'detail']).default('main'),
  language: z.enum(['none', 'en', 'zh', 'es', 'fr', 'de', 'ja']).default('none'),
  size: z.enum([
    '1024x1024',  // 1:1
    '683x1024',   // 2:3
    '1024x683',   // 3:2
    '768x1024',   // 3:4
    '1024x768',   // 4:3
    '820x1024',   // 4:5
    '1024x820',   // 5:4
    '576x1024',   // 9:16
    '1024x576',   // 16:9
    '1024x439',   // 21:9
    '1024x256',   // 4:1
    '1024x1536',  // 2:3 (high-res)
    '1536x1024',  // 3:2 (high-res)
  ]).default('1024x1024'),
  quality: z.enum(['low', 'medium', 'high']).default('medium'),
  count: z.coerce.number().int().refine(count => [1, 2, 4, 6].includes(count)).default(1),
})

export type ImageRequest = z.infer<typeof imageRequestSchema>
