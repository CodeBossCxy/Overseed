import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendVerificationSubmittedEmail } from '@/lib/email'

const ACCOUNT_TYPES = ['brand', 'agency', 'individual_pr']

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).userType !== 'BRAND') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
    const userId = (session.user as any).id

    const brandProfile = await prisma.brandProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    })
    if (!brandProfile) {
      return NextResponse.json({ message: 'Brand profile not found' }, { status: 404 })
    }
    if (brandProfile.brandVerificationStatus === 'APPROVED') {
      return NextResponse.json({ message: 'Business is already verified' }, { status: 400 })
    }

    const data = await req.json()
    const {
      accountType,
      businessLegalName,
      businessRegistrationNo,
      businessCountry,
      businessWebsite,
      contactName,
      contactJobTitle,
      contactEmail,
      contactPhone,
      documentUrls,
    } = data

    if (
      !ACCOUNT_TYPES.includes(accountType) ||
      !businessLegalName?.trim() ||
      !businessRegistrationNo?.trim() ||
      !businessCountry?.trim() ||
      !contactName?.trim() ||
      !contactEmail?.trim()
    ) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
    }

    if (!Array.isArray(documentUrls) || documentUrls.length === 0) {
      return NextResponse.json(
        { message: 'At least one verification document is required' },
        { status: 400 }
      )
    }
    // Only accept URLs produced by our own upload endpoints
    const validDocs = documentUrls.every(
      (u: unknown) =>
        typeof u === 'string' &&
        (u.startsWith('/api/s3-image/verification_docs/') || u.startsWith('/uploads/verification_docs/'))
    )
    if (!validDocs || documentUrls.length > 5) {
      return NextResponse.json({ message: 'Invalid document URLs' }, { status: 400 })
    }

    const updated = await prisma.brandProfile.update({
      where: { id: brandProfile.id },
      data: {
        accountType,
        businessLegalName: businessLegalName.trim(),
        businessRegistrationNo: businessRegistrationNo.trim(),
        businessCountry: businessCountry.trim(),
        businessWebsite: businessWebsite?.trim() || null,
        contactName: contactName.trim(),
        contactJobTitle: contactJobTitle?.trim() || null,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone?.trim() || null,
        businessDocuments: documentUrls,
        brandVerificationStatus: 'PENDING',
        verificationSubmittedAt: new Date(),
        rejectionReason: null,
      },
    })

    try {
      await sendVerificationSubmittedEmail({
        companyName: updated.companyName || '—',
        accountType,
        businessLegalName: updated.businessLegalName!,
        businessRegistrationNo: updated.businessRegistrationNo!,
        businessCountry: updated.businessCountry!,
        businessWebsite: updated.businessWebsite || undefined,
        contactName: updated.contactName!,
        contactJobTitle: updated.contactJobTitle || undefined,
        contactEmail: updated.contactEmail!,
        contactPhone: updated.contactPhone || undefined,
        documentUrls: updated.businessDocuments,
        userEmail: brandProfile.user.email,
      })
    } catch (emailError) {
      // Submission is saved; notification failure should not fail the request
      console.error('Verification notification email failed:', emailError)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Verification submit error:', error)
    return NextResponse.json({ message: 'Failed to submit verification' }, { status: 500 })
  }
}
