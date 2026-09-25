import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MAX_FOLDERS = 50
const MAX_NAME_LEN = 40

async function requireBrandId() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const brand = await prisma.brandProfile.findUnique({
    where: { userId: (session.user as any).id },
    select: { id: true },
  })
  return brand?.id ?? null
}

// GET /api/saved-creators/folders — the brand's folders with creator counts
export async function GET() {
  const brandId = await requireBrandId()
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }
  const folders = await prisma.savedCreatorFolder.findMany({
    where: { brandId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { creators: true } } },
  })
  return NextResponse.json({
    folders: folders.map((f) => ({ id: f.id, name: f.name, count: f._count.creators })),
  })
}

// POST /api/saved-creators/folders { name } — create a folder
export async function POST(req: NextRequest) {
  const brandId = await requireBrandId()
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }
  const name = (await req.json().catch(() => ({})))?.name?.trim()
  if (!name || name.length > MAX_NAME_LEN) {
    return NextResponse.json(
      { message: `Folder name is required (max ${MAX_NAME_LEN} characters)`, code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }
  const count = await prisma.savedCreatorFolder.count({ where: { brandId } })
  if (count >= MAX_FOLDERS) {
    return NextResponse.json(
      { message: `You can have at most ${MAX_FOLDERS} folders`, code: 'LIMIT_REACHED' },
      { status: 422 }
    )
  }
  try {
    const folder = await prisma.savedCreatorFolder.create({ data: { brandId, name } })
    return NextResponse.json({ folder: { id: folder.id, name: folder.name, count: 0 } })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { message: 'A folder with this name already exists', code: 'CONFLICT' },
        { status: 409 }
      )
    }
    throw e
  }
}

// PATCH /api/saved-creators/folders { id, name } — rename a folder
export async function PATCH(req: NextRequest) {
  const brandId = await requireBrandId()
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const id = body?.id
  const name = body?.name?.trim()
  if (!id || !name || name.length > MAX_NAME_LEN) {
    return NextResponse.json(
      { message: 'Folder id and name are required', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }
  try {
    const { count } = await prisma.savedCreatorFolder.updateMany({
      where: { id, brandId },
      data: { name },
    })
    if (count === 0) {
      return NextResponse.json({ message: 'Folder not found', code: 'NOT_FOUND' }, { status: 404 })
    }
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { message: 'A folder with this name already exists', code: 'CONFLICT' },
        { status: 409 }
      )
    }
    throw e
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/saved-creators/folders?id=... — delete a folder; its creators
// stay saved (folderId is set to null by the FK).
export async function DELETE(req: NextRequest) {
  const brandId = await requireBrandId()
  if (!brandId) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ message: 'id is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  await prisma.savedCreatorFolder.deleteMany({ where: { id, brandId } })
  return NextResponse.json({ ok: true })
}
