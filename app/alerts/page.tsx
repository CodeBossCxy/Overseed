import RoleShell from '@/components/workspace/RoleShell'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AlertsPageClient from '@/components/alerts/AlertsPageClient'

export default async function AlertsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin?callbackUrl=/alerts')
  }

  const savedSearches = await prisma.savedSearch.findMany({
    where: {
      userId: (session.user as any).id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <RoleShell>
      <AlertsPageClient savedSearches={JSON.parse(JSON.stringify(savedSearches))} />
    </RoleShell>
  )
}
