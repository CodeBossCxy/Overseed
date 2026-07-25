import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import DiscoverPageClient from './DiscoverPageClient'

// Standalone creator-database page ("Find your influencer") for brands —
// browses the KOL discovery index without requiring a campaign.
export default async function BrandDiscoverPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/auth/signin')
  }
  const userId = (session!.user as any).id

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { userType: true },
  })
  if ((dbUser?.userType || 'INFLUENCER') === 'INFLUENCER') {
    redirect('/dashboard/influencer')
  }

  return (
    <BrandWorkspaceLayout>
      <DiscoverPageClient />
    </BrandWorkspaceLayout>
  )
}
