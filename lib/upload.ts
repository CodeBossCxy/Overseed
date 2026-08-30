import { randomUUID } from 'crypto'
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

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// Vercel rejects request bodies over 4.5 MB, so cap uploads safely below that.
export const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB
