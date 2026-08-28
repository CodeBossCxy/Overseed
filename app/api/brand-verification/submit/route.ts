import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendVerificationSubmittedEmail } from '@/lib/email'

const ACCOUNT_TYPES = ['brand', 'agency', 'individual_pr']
const BRAND_COUNTRIES = ['CN', 'HK', 'MO', 'TW', 'UK', 'CA', 'US']

const isDocUrl = (u: unknown) =>
  typeof u === 'string' &&
  (u.startsWith('/api/s3-image/verification_docs/') || u.startsWith('/uploads/verification_docs/'))

const validDocArray = (arr: unknown, required = true): arr is string[] =>
  Array.isArray(arr) && arr.length <= 5 && arr.every(isDocUrl) && (!required || arr.length > 0)

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['BRAND', 'ADMIN'].includes((session.user as any).userType)) {
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
    const type = data.type as string
    if (!ACCOUNT_TYPES.includes(type)) {
      return NextResponse.json({ message: 'Invalid account type' }, { status: 400 })
    }

    const contact = {
      name: str(data.contact?.name),
      email: str(data.contact?.email),
      phone: str(data.contact?.phone),
    }

    const invalid = (message: string) => NextResponse.json({ message }, { status: 400 })

    // Per-type validation + normalized verificationData
    let verificationData: any
    // Legacy column mapping
    let legalName: string | null = null
    let registrationNo: string | null = null
    let businessCountry: string | null = null
    let allDocs: string[] = []

    if (type === 'brand') {
      const country = str(data.country)
      if (!BRAND_COUNTRIES.includes(country)) return invalid('Invalid country')
      const isCn = country === 'CN'

      // 1. Brand or store proof
      const bp = data.brandProof || {}
      let brandProof: any
      if (bp.method === 'trademark') {
        const brandName = str(bp.brandName)
        const registryLink = str(bp.registryLink)
        const docUrls = Array.isArray(bp.docUrls) ? bp.docUrls : []
        if (!brandName) return invalid('Missing brand name')
        if (!validDocArray(docUrls, false)) return invalid('Invalid document URLs')
        if (docUrls.length === 0 && !registryLink) return invalid('Trademark proof required')
        brandProof = { method: 'trademark', brandName, registryLink: registryLink || undefined, docUrls }
      } else if (bp.method === 'store') {
        const storeName = str(bp.storeName)
        if (!storeName) return invalid('Missing store name')
        if (!validDocArray(bp.docUrls)) return invalid('Store screenshot required')
        brandProof = { method: 'store', storeName, docUrls: bp.docUrls }
      } else {
        return invalid('Invalid brand proof')
      }
      allDocs.push(...(brandProof.docUrls || []))

      // 2. Business info
      const biz = data.business || {}
      if (isCn) {
        if (!str(biz.legalName) || !str(biz.creditCode)) return invalid('Missing business information')
        legalName = str(biz.legalName)
        registrationNo = str(biz.creditCode)
      } else {
        if (!str(biz.legalName) || !str(biz.registrationNo) || !str(biz.stateProvince))
          return invalid('Missing business information')
        legalName = str(biz.legalName)
        registrationNo = str(biz.registrationNo)
      }
      businessCountry = country

      // 3. Company proof
      const cp = data.companyProof || {}
      let companyProof: any
      if (isCn) {
        if (!validDocArray(cp.docUrls)) return invalid('Business license required')
        companyProof = { method: 'document', docUrls: cp.docUrls }
      } else if (cp.method === 'registryLink') {
        if (!str(cp.registryLink)) return invalid('Registry link required')
        companyProof = { method: 'registryLink', registryLink: str(cp.registryLink) }
      } else if (cp.method === 'document') {
        if (!validDocArray(cp.docUrls)) return invalid('Registration document required')
        companyProof = { method: 'document', docUrls: cp.docUrls }
      } else {
        return invalid('Invalid company proof')
      }
      allDocs.push(...(companyProof.docUrls || []))

      // 4. Applicant authority
      const aa = data.applicantAuth || {}
      let applicantAuth: any
      const allowedMethods = isCn ? ['face', 'letter'] : ['director', 'letter', 'tin']
      if (!allowedMethods.includes(aa.method)) return invalid('Invalid authority method')
      if (aa.method === 'face') {
        if (!str(aa.legalRepName) || !str(aa.legalRepIdNo)) return invalid('Missing legal representative info')
        applicantAuth = { method: 'face', legalRepName: str(aa.legalRepName), legalRepIdNo: str(aa.legalRepIdNo) }
      } else if (aa.method === 'letter') {
        if (!validDocArray(aa.docUrls)) return invalid('Authorisation letter required')
        applicantAuth = { method: 'letter', docUrls: aa.docUrls }
        allDocs.push(...aa.docUrls)
      } else if (aa.method === 'director') {
        if (!str(aa.applicantName) || !str(aa.applicantPosition) || aa.declaration !== true)
          return invalid('Missing director verification info')
        applicantAuth = {
          method: 'director',
          applicantName: str(aa.applicantName),
          applicantPosition: str(aa.applicantPosition),
          declaration: true,
        }
      } else {
        if (!str(aa.tin)) return invalid('Tax number required')
        applicantAuth = { method: 'tin', tin: str(aa.tin) }
      }

      // 5. Contact
      if (!contact.name || !contact.phone || (!isCn && !contact.email))
        return invalid('Missing contact information')

      verificationData = { type, country, brandProof, business: biz, companyProof, applicantAuth, contact }
    } else if (type === 'agency') {
      const agency = data.agency || {}
      if (!str(agency.legalName)) return invalid('Missing agency information')
      const representedBrand = str(data.representedBrand)
      const brandWebsite = str(data.brandWebsite)
      if (!representedBrand || !brandWebsite) return invalid('Missing represented brand')
      const ap = data.authProof || {}
      if (!['brandEmail', 'letter'].includes(ap.method) || !validDocArray(ap.docUrls))
        return invalid('One proof of authorisation is required')
      if (!contact.name || !contact.email) return invalid('Missing contact information')

      legalName = str(agency.legalName)
      registrationNo = str(agency.registrationNo) || null
      businessCountry = str(agency.country) || null
      allDocs.push(...ap.docUrls)
      verificationData = {
        type,
        agency: {
          legalName: str(agency.legalName),
          registrationNo: str(agency.registrationNo) || undefined,
          country: str(agency.country) || undefined,
          website: str(agency.website) || undefined,
        },
        representedBrand,
        brandWebsite,
        authProof: { method: ap.method, docUrls: ap.docUrls },
        contact,
      }
    } else {
      // individual_pr
      const fullName = str(data.fullName)
      const representedBrand = str(data.representedBrand)
      const brandWebsite = str(data.brandWebsite)
      if (!fullName || !representedBrand || !brandWebsite) return invalid('Missing required fields')
      if (!contact.email || !contact.phone) return invalid('Missing contact information')
      const ap = data.authProof || {}
      if (!['brandEmail', 'letter', 'chat'].includes(ap.method) || !validDocArray(ap.docUrls))
        return invalid('One proof of authorisation is required')

      legalName = fullName
      allDocs.push(...ap.docUrls)
      verificationData = {
        type,
        fullName,
        representedBrand,
        brandWebsite,
        authProof: { method: ap.method, docUrls: ap.docUrls },
        contact,
      }
    }

    const updated = await prisma.brandProfile.update({
      where: { id: brandProfile.id },
      data: {
        accountType: type,
        businessLegalName: legalName,
        businessRegistrationNo: registrationNo,
        businessCountry,
        businessDocuments: allDocs,
        verificationData,
        contactName: contact.name || null,
        contactEmail: contact.email || null,
        contactPhone: contact.phone || null,
        brandVerificationStatus: 'PENDING',
        verificationSubmittedAt: new Date(),
        rejectionReason: null,
      },
    })

    try {
      await sendVerificationSubmittedEmail({
        companyName: updated.companyName || '—',
        submission: verificationData,
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
