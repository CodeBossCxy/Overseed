import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import NotAdminNotice from './NotAdminNotice'

// Server-side admin guard: checks the DB directly so a stale JWT
// (userType is only synced into the token at sign-in) can never
// lock an admin out or let a non-admin in.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/admin')
  }

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { userType: true },
  })
  if (user?.userType !== 'ADMIN') {
    return <NotAdminNotice />
  }

  return <>{children}</>
}
