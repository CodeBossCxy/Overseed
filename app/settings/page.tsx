import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = (session.user as any).id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      preferredLanguage: true,
      subscriptionTier: true,
      userType: true,
      createdAt: true,
      password: true,
      preferredContentLanguage: true,
      timeZone: true,
      dateFormat: true,
      displayCurrency: true,
      defaultCampaignCurrency: true,
      emailNotifications: true,
      emailCampaignUpdates: true,
      emailCollaborationUpdates: true,
      emailPaymentUpdates: true,
      emailProductUpdates: true,
      profileDiscoverable: true,
      allowContactSharing: true,
      allowBusinessContactSharing: true,
      accounts: { select: { provider: true } },
    },
  })

  if (!user) {
    redirect('/auth/signin')
  }

  const { password, accounts, emailVerified, ...rest } = user
  const Shell = user.userType === 'INFLUENCER' ? CreatorWorkspaceLayout : BrandWorkspaceLayout

  return (
    <Shell>
      <SettingsClient
        user={{
          ...rest,
          createdAt: user.createdAt.toISOString(),
          emailVerified: !!emailVerified,
          hasPassword: !!password,
          connectedProviders: accounts.map((a) => a.provider),
        }}
      />
    </Shell>
  )
}
