import RoleShell from '@/components/workspace/RoleShell'
import BrandProfileWrapper from '@/components/profiles/BrandProfileWrapper'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

// Public brand profile — creators only ever see the public profile and the
// Verified Business badge; business-registration data stays private.
export default async function BrandPublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const brand = await prisma.brandProfile.findUnique({
    where: { id },
    select: {
      id: true,
      companyName: true,
      logoUrl: true,
      description: true,
      websiteUrl: true,
      storeUrl: true,
      socialLinks: true,
      countries: true,
      industries: true,
      industry: true,
      brandVerificationStatus: true,
      campaigns: {
        where: { status: 'ACTIVE' },
        include: {
          brand: { select: { id: true, companyName: true, logoUrl: true, isVerified: true } },
          categories: { include: { category: true } },
          platforms: { include: { platform: true } },
          followerRequirements: { include: { platform: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!brand) notFound()

  return (
    <RoleShell>
      <BrandProfileWrapper initialBrand={JSON.parse(JSON.stringify(brand))} />
    </RoleShell>
  )
}
