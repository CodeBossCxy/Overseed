import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadFile, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from '@/lib/upload'

const MAX_FILES = 5
const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf']

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['BRAND', 'ADMIN'].includes((session.user as any).userType)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files per upload` },
        { status: 400 }
      )
    }

    // Validate all files before uploading any
    for (const file of files) {
      if (!ALLOWED_DOC_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed: PDF, JPEG, PNG, WebP, GIF` },
          { status: 400 }
        )
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 5 MB limit` },
          { status: 400 }
        )
      }
    }

    const urls: string[] = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const url = await uploadFile(buffer, file.name, file.type, 'verification_docs/')
      urls.push(url)
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error('Verification document upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
