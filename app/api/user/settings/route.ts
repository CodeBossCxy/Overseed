import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hash, compare } from 'bcryptjs'

// GET: settings state the client needs before render (first-login setup flag)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: {
      languageSetupAt: true,
      preferredLanguage: true,
      preferredContentLanguage: true,
      timeZone: true,
      dateFormat: true,
      displayCurrency: true,
      defaultCampaignCurrency: true,
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...user, needsLanguageSetup: !user.languageSetupAt })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found' }, { status: 400 })
  }

  const body = await request.json()
  const { action } = body

  // Update display name
  if (action === 'updateName') {
    const { name } = body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
    })

    return NextResponse.json({ success: true })
  }

  // Change password
  if (action === 'changePassword') {
    const { currentPassword, newPassword } = body

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    })

    // User signed up via OAuth — no existing password
    if (!user?.password) {
      const hashedPassword = await hash(newPassword, 12)
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      })
      return NextResponse.json({ success: true })
    }

    // User has an existing password — verify current password
    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Current password is required' },
        { status: 400 }
      )
    }

    const isValid = await compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    const hashedPassword = await hash(newPassword, 12)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ success: true })
  }

  // Update account/region/notification/privacy preferences
  if (action === 'updatePreferences') {
    const updateData: Record<string, any> = {}

    const stringFields = [
      'preferredContentLanguage',
      'timeZone',
      'dateFormat',
      'displayCurrency',
      'defaultCampaignCurrency',
    ] as const
    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] === null ? null : String(body[field])
      }
    }

    const boolFields = [
      'emailNotifications',
      'emailCampaignUpdates',
      'emailCollaborationUpdates',
      'emailPaymentUpdates',
      'emailProductUpdates',
      'profileDiscoverable',
      'allowContactSharing',
      'allowBusinessContactSharing',
    ] as const
    for (const field of boolFields) {
      if (body[field] !== undefined) {
        updateData[field] = Boolean(body[field])
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    return NextResponse.json({ success: true, ...updateData })
  }

  // Delete account (deactivate)
  // First-login Language & Region setup complete
  if (action === 'completeLanguageSetup') {
    await prisma.user.update({
      where: { id: userId },
      data: { languageSetupAt: new Date() },
    })
    return NextResponse.json({ success: true })
  }

  if (action === 'deactivateAccount') {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
