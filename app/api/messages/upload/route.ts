import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadFile, MAX_FILE_SIZE } from '@/lib/upload'

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const file = (await req.formData()).get('file')
  if (!(file instanceof File) || !file.size) return NextResponse.json({ message: 'File required' }, { status: 400 })
  if (!TYPES.includes(file.type)) return NextResponse.json({ message: 'Only images and PDF files are supported' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ message: 'Files must be 4 MB or smaller' }, { status: 400 })
  const url = await uploadFile(Buffer.from(await file.arrayBuffer()), file.name, file.type, 'message_attachment/')
  return NextResponse.json({ url, name: file.name, mime: file.type })
}
