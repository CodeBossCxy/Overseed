import { randomUUID, createHash } from 'crypto'
import path from 'path'

const useS3 = Boolean(
  process.env.S3_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_ACCESS_KEY_ID !== 'your_aws_access_key_id'
)

async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

  const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )

  return `/api/s3-image/${key}`
}

async function uploadToLocal(buffer: Buffer, filename: string, subdir: string): Promise<string> {
  const { writeFile, mkdir } = await import('fs/promises')

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', subdir)
  await mkdir(uploadDir, { recursive: true })

  const filepath = path.join(uploadDir, filename)
  await writeFile(filepath, buffer)

  return `/uploads/${subdir}/${filename}`
}

export async function uploadFile(
  buffer: Buffer,
  originalFilename: string,
  contentType: string,
  prefix: string
): Promise<string> {
  const ext = path.extname(originalFilename) || '.jpg'
  const filename = `${randomUUID()}${ext}`

  if (useS3) {
    return uploadToS3(buffer, `${prefix}${filename}`, contentType)
  }

  // For local, use the prefix as subdirectory (remove trailing slash)
  const subdir = prefix.replace(/\/$/, '').replace(/\//g, '_') || 'general'
  return uploadToLocal(buffer, filename, subdir)
}

// ── Image rehosting ──────────────────────────────────────────────────────
// Fetches an image from a (possibly expiring) URL, uploads it to S3 with
// a content-hash key for deduplication, and returns the stable path.
// Used to persist search result avatars and post thumbnails.

/** Domains whose URLs are already stable and don't need rehosting. */
const STABLE_IMAGE_DOMAINS = [
  'firebasestorage.googleapis.com',
  'img.youtube.com',
  'i.ytimg.com',
  'yt3.ggpht.com',
]

const REHOST_MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const REHOST_TIMEOUT = 10_000 // 10s

/**
 * Fetch an image, upload to S3 under `prefix/<sha1>.<ext>`, and return the
 * stable `/api/s3-image/...` path. Same image → same key (deduped).
 * Returns null on any failure (non-critical; caller keeps the original URL).
 */
export async function rehostImage(
  url: string | null | undefined,
  prefix = 'discovery-cache/',
): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('/')) return url // already local
  try {
    const host = new URL(url).hostname
    if (STABLE_IMAGE_DOMAINS.some((d) => host.endsWith(d))) return url
  } catch {
    return null
  }
  if (!useS3) return null // no S3 configured — can't rehost
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REHOST_TIMEOUT),
      headers: { 'User-Agent': 'Overseed/1.0' },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0 || buffer.length > REHOST_MAX_SIZE) return null
    const hash = createHash('sha1').update(buffer).digest('hex')
    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg'
    const key = `${prefix}${hash}${ext}`
    return await uploadToS3(buffer, key, contentType)
  } catch {
    return null
  }
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// Legacy route-based upload limit (Vercel rejects bodies over 4.5 MB).
export const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB
// Presigned direct-to-S3 upload limit (bypasses Vercel body limit).
export const MAX_FILE_SIZE_PRESIGNED = 20 * 1024 * 1024 // 20 MB
