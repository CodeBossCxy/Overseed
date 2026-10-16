import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bucket = process.env.S3_BUCKET
  const region = process.env.AWS_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { error: 'S3 not configured — presigned uploads unavailable' },
      { status: 501 }
    )
  }

  const { filename, contentType, size, prefix } = await request.json()

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: `Invalid type: ${contentType}` }, { status: 400 })
  }
  if (size && size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB limit` }, { status: 400 })
  }

  const ext = filename.replace(/.*\./, '.') || '.jpg'
  const key = `${prefix || 'campaign_image/'}${randomUUID()}${ext}`

  const s3 = new S3Client({
    region: region!,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  })

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ...(size ? { ContentLength: size } : {}),
  })

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 })

  return NextResponse.json({
    presignedUrl,
    key,
    url: `/api/s3-image/${key}`,
  })
}
