import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params
  const s3Key = key.join('/')

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: s3Key,
      })
    )

    const body = response.Body
    if (!body) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // Stream the S3 object to the client
    const bytes = await body.transformToByteArray()

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': response.ContentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    console.error('S3 image proxy error:', error)
    return NextResponse.json({ error: 'Failed to load image', code: 'UPSTREAM_ERROR' }, { status: 500 })
  }
}
