import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: Get current user's profile
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userType = (session.user as any).userType

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        influencerProfile: {
          include: {
            socialAccounts: {
              include: {
                platform: true,
              },
            },
          },
        },
        brandProfile: {
          include: {
            campaigns: {
              select: {
                id: true,
                title: true,
                status: true,
              },
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        agencyProfile: true,
      },
    })

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Update current user's profile
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userType = (session.user as any).userType
    const data = await req.json()

    // Update user basic info
    if (data.name !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: data.name },
      })
    }

    // Update influencer profile
    if (data.influencerProfile) {
      const profileData = data.influencerProfile
      await prisma.influencerProfile.upsert({
        where: { userId },
        update: {
          displayName: profileData.displayName,
          avatarUrl: profileData.avatarUrl,
          coverImageUrl: profileData.coverImageUrl,
          bio: profileData.bio,
          locationCity: profileData.locationCity,
          locationState: profileData.locationState,
          locationCountry: profileData.locationCountry,
          primaryNiche: profileData.primaryNiche,
          secondaryNiches: profileData.secondaryNiches,
          languages: profileData.languages,
          preferredCollabTypes: Array.isArray(profileData.preferredCollabTypes)
            ? profileData.preferredCollabTypes
            : undefined,
        },
        create: {
          userId,
          displayName: profileData.displayName,
          avatarUrl: profileData.avatarUrl,
          coverImageUrl: profileData.coverImageUrl,
          bio: profileData.bio,
          locationCity: profileData.locationCity,
          locationState: profileData.locationState,
          locationCountry: profileData.locationCountry,
          primaryNiche: profileData.primaryNiche,
          secondaryNiches: profileData.secondaryNiches || [],
          languages: profileData.languages || [],
          preferredCollabTypes: profileData.preferredCollabTypes || [],
        },
      })
    }

    // Update brand profile. Public-profile + contact fields only — the
    // business/verification fields (legal name, registration number, account
    // type, country of registration) are locked and changed via support.
    if (data.brandProfile) {
      const profileData = data.brandProfile
      const editable = {
        companyName: profileData.companyName,
        description: profileData.description,
        websiteUrl: profileData.websiteUrl,
        storeUrl: profileData.storeUrl,
        logoUrl: profileData.logoUrl,
        industry: profileData.industry,
        countries: Array.isArray(profileData.countries) ? profileData.countries : undefined,
        industries: Array.isArray(profileData.industries) ? profileData.industries : undefined,
        socialLinks: Array.isArray(profileData.socialLinks)
          ? profileData.socialLinks.filter((l: any) => typeof l === 'string' && l.trim()).slice(0, 5)
          : undefined,
        companySize: profileData.companySize,
        contactName: profileData.contactName,
        contactJobTitle: profileData.contactJobTitle,
        contactEmail: profileData.contactEmail,
        contactPhone: profileData.contactPhone,
      }
      await prisma.brandProfile.upsert({
        where: { userId },
        update: editable,
        create: { userId, ...editable },
      })
      // Account type can be chosen until verification locks it
      if (profileData.accountType) {
        const existing = await prisma.brandProfile.findUnique({
          where: { userId },
          select: { brandVerificationStatus: true },
        })
        if (existing?.brandVerificationStatus !== 'APPROVED') {
          await prisma.brandProfile.update({
            where: { userId },
            data: { accountType: profileData.accountType },
          })
        }
      }
    }

    // Fetch updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        influencerProfile: {
          include: {
            socialAccounts: {
              include: {
                platform: true,
              },
            },
          },
        },
        brandProfile: true,
        agencyProfile: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
