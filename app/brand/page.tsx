import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import RoleRedirector from '@/components/RoleRedirector'

export default async function BrandCenterPage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id

  // Not logged in → send to signup with brand type pre-selected
  if (!userId) {
    redirect('/auth/signup?type=brand')
  }

  // Persist BRAND role choice to DB — but never demote an ADMIN account
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { userType: true },
  })
  if (current?.userType !== 'ADMIN') {
    await prisma.user.update({
      where: { id: userId },
      data: { userType: 'BRAND' },
    })
  }

  // Auto-create BrandProfile if it doesn't exist
  const existing = await prisma.brandProfile.findUnique({
    where: { userId },
  })
  if (!existing) {
    await prisma.brandProfile.create({
      data: { userId },
    })
  }

  // Render client component that syncs the JWT cookie, then redirects
  return <RoleRedirector destination="/dashboard/brand" />
}
