import RoleShell from '@/components/workspace/RoleShell'
import ApplicationForm from '@/components/applications/ApplicationForm'
import CompensationBadge from '@/components/campaigns/CompensationBadge'
import CategoryName from '@/components/campaigns/CategoryName'
import { LocaleDate } from '@/components/LocaleDate'
import UpgradePrompt from '@/components/UpgradePrompt'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  // Must be logged in
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = (session.user as any).id
  const userType = (session.user as any).userType
  const subscriptionTier = (session.user as any).subscriptionTier || 'FREE'

  // Only influencers/creators can apply
  if (userType === 'BRAND') {
    redirect(`/campaign/${id}`)
  }

  // Free users cannot apply to campaigns
  if (subscriptionTier === 'FREE') {
    return (
      <RoleShell>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href={`/campaign/${id}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Campaign
          </Link>
          <div className="bg-white rounded-lg shadow-md">
            <UpgradePrompt feature="apply" />
          </div>
        </div>
      </RoleShell>
    )
  }

  // Get campaign
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      brand: {
        select: {
          companyName: true,
          logoUrl: true,
          isVerified: true,
        },
      },
      categories: {
        include: { category: true },
      },
      platforms: {
        include: { platform: true },
      },
      followerRequirements: {
        include: { platform: true },
      },
    },
  })

  if (!campaign) {
    notFound()
  }

  // Check campaign is still open
  const isDeadlinePassed = campaign.deadline && new Date(campaign.deadline) < new Date()
  const spotsLeft = campaign.totalSlots - campaign.filledSlots

  if (campaign.status !== 'ACTIVE' || isDeadlinePassed || spotsLeft <= 0) {
    redirect(`/campaign/${id}`)
  }

  // Get influencer profile and social accounts
  const influencerProfile = await prisma.influencerProfile.findUnique({
    where: { userId },
    include: {
      socialAccounts: {
        include: { platform: true },
        orderBy: { followerCount: 'desc' },
      },
    },
  })

  // Check if already applied
  if (influencerProfile) {
    const existingApplication = await prisma.application.findUnique({
      where: {
        campaignId_influencerId: {
          campaignId: id,
          influencerId: influencerProfile.id,
        },
      },
    })

    if (existingApplication) {
      redirect(`/campaign/${id}`)
    }
  }

  const socialAccounts = influencerProfile?.socialAccounts.map((account) => ({
    id: account.id,
    platform: { name: account.platform.name },
    username: account.username,
    followerCount: account.followerCount,
  })) || []

  const isNegotiable = campaign.compensationType === 'NEGOTIABLE' || campaign.compensationType === 'PAID'

  return (
    <RoleShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href={`/campaign/${id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Campaign
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Application Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h1 className="text-2xl font-bold mb-2">Apply to Campaign</h1>
              <p className="text-gray-600 mb-6">
                Submit your application for &ldquo;{campaign.title}&rdquo;
              </p>

              {!influencerProfile ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Complete Your Profile First</h2>
                  <p className="text-gray-600 mb-4">
                    You need to set up your creator profile before applying to campaigns.
                  </p>
                  <Link
                    href="/dashboard/influencer/profile"
                    className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                  >
                    Set Up Profile
                  </Link>
                </div>
              ) : (
                <ApplicationForm
                  campaignId={id}
                  campaignTitle={campaign.title}
                  socialAccounts={socialAccounts}
                  isNegotiable={isNegotiable}
                />
              )}
            </div>
          </div>

          {/* Campaign Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-20 space-y-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Campaign Summary</h3>

              {/* Brand */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  {campaign.brand.logoUrl ? (
                    <img src={campaign.brand.logoUrl} alt={campaign.brand.companyName || 'Brand'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm font-medium">
                      {campaign.brand.companyName?.charAt(0) || 'B'}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-sm">{campaign.brand.companyName || 'Brand'}</p>
                    {campaign.brand.isVerified && (
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <p className="font-semibold">{campaign.title}</p>
              </div>

              {/* Categories */}
              {campaign.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {campaign.categories.map(({ category }) => (
                    <span key={category.id} className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                      <CategoryName name={category.name} />
                    </span>
                  ))}
                </div>
              )}

              {/* Compensation */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Compensation</p>
                <CompensationBadge
                  type={campaign.compensationType}
                  paymentMin={campaign.paymentMin as any}
                  paymentMax={campaign.paymentMax as any}
                  giftDescription={campaign.giftDescription}
                  size="sm"
                />
              </div>

              {/* Platforms */}
              {campaign.platforms.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Platforms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {campaign.platforms.map(({ platform }) => (
                      <span key={platform.id} className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                        {platform.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Follower Requirements */}
              {campaign.followerRequirements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Follower Requirements</p>
                  <div className="space-y-1">
                    {campaign.followerRequirements.map((req, i) => (
                      <p key={i} className="text-xs text-gray-700">
                        {req.platform.name}: {req.minFollowers.toLocaleString()}
                        {req.maxFollowers ? ` - ${req.maxFollowers.toLocaleString()}` : '+'} followers
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Deadline */}
              {campaign.deadline && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Deadline</p>
                  <p className="text-sm text-orange-600 font-medium">
                    <LocaleDate date={campaign.deadline} />
                  </p>
                </div>
              )}

              {/* Spots */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Available Spots</p>
                <p className="text-sm">
                  {spotsLeft} of {campaign.totalSlots} remaining
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleShell>
  )
}
