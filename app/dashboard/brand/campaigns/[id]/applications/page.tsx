'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import ApplicationStatus from '@/components/applications/ApplicationStatus'
import ApplicationActions from '@/components/applications/ApplicationActions'
import PaymentModal from '@/components/payments/PaymentModal'
import PaymentStatusBadge from '@/components/payments/PaymentStatus'
import StatusBadge from '@/components/StatusBadge'
import ConfirmCollaborationModal from '@/components/collaborations/ConfirmCollaborationModal'
import PipelineTabs from '@/components/PipelineTabs'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

interface Application {
  id: string
  status: string
  pitchMessage?: string | null
  proposedRate?: number | string | null
  brandNotes?: string | null
  rejectionReason?: string | null
  appliedAt: string
  reviewedAt?: string | null
  influencer: {
    id: string
    displayName?: string | null
    avatarUrl?: string | null
    bio?: string | null
    primaryNiche?: string | null
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
    }
    socialAccounts: Array<{
      platform: { name: string }
      username: string
      followerCount: number
    }>
  }
  socialAccount?: {
    platform: { name: string }
    username: string
    followerCount: number
  } | null
  payment?: {
    id: string
    status: string
    amount: number | string
    platformFee: number | string
    creatorPayout: number | string
    paidAt?: string | null
    releasedAt?: string | null
  } | null
}

export default function CampaignApplicationsPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  const { t, locale } = useLanguage()

  const [campaign, setCampaign] = useState<any>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [paymentModal, setPaymentModal] = useState<{
    clientSecret: string
    amount: number
    platformFee: number
    creatorPayout: number
  } | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [collaborations, setCollaborations] = useState<any[]>([])
  const [confirmFor, setConfirmFor] = useState<Application | null>(null)

  useEffect(() => {
    fetchData()
  }, [campaignId, filter, locale])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch campaign details
      const campaignRes = await fetch(`/api/campaigns/${campaignId}?lang=${locale}`)
      if (campaignRes.ok) {
        const campaignData = await campaignRes.json()
        setCampaign(campaignData)
      }

      // Fetch applications
      const params = new URLSearchParams({ lang: locale })
      if (filter) params.set('status', filter)
      const response = await fetch(`/api/campaigns/${campaignId}/applications?${params}`)
      if (response.ok) {
        const data = await response.json()
        setApplications(data)
      }

      // Collaborations already created for this campaign
      const colRes = await fetch(`/api/collaborations?role=brand&campaignId=${campaignId}`)
      if (colRes.ok) {
        const colData = await colRes.json()
        setCollaborations(colData.collaborations || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = (applicationId: string, newStatus: string) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      )
    )
    if (selectedApplication?.id === applicationId) {
      setSelectedApplication((prev) => prev ? { ...prev, status: newStatus } : null)
    }
  }

  const statusFilters = [
    { value: '', label: t.brand.applications.all },
    { value: 'PENDING', label: t.brand.applications.pending },
    { value: 'UNDER_REVIEW', label: t.brand.applications.underReview },
    { value: 'APPROVED', label: t.brand.applications.approved },
    { value: 'REJECTED', label: t.brand.applications.rejected },
    { value: 'COMPLETED', label: t.brand.applications.completed },
  ]

  if (isLoading) {
    return (
      <BrandWorkspaceLayout>
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">{t.brand.applications.loading}</p>
        </div>
      </BrandWorkspaceLayout>
    )
  }

  const collabByApp: Record<string, any> = {}
  collaborations.forEach((col) => { collabByApp[col.applicationId] = col })

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-6xl mx-auto pt-6 pb-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/brand/campaigns" className="text-primary-600 hover:underline text-sm mb-2 inline-block">
            {t.brand.applications.backToCampaigns}
          </Link>
          <h1 className="text-3xl font-bold">{t.brand.applications.title}</h1>
          {campaign && (
            <p className="text-gray-600 mt-1">
              {t.brand.applications.forCampaign} {campaign.title} ({applications.length} {t.brand.applications.applicationsCount})
            </p>
          )}
        </div>

        <PipelineTabs campaignId={campaignId} active="pipeline" />

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === f.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Applications List */}
          <div className="lg:col-span-1">
            {applications.length === 0 ? (
              <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-8 text-center">
                <p className="text-gray-500">
                  {filter ? `No ${filter.toLowerCase().replace('_', ' ')} applications` : t.brand.applications.noApplications}
                </p>
              </div>
            ) : (
              <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm divide-y max-h-[70vh] overflow-y-auto">
                {applications.map((application) => (
                  <div
                    key={application.id}
                    onClick={() => setSelectedApplication(application)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                      selectedApplication?.id === application.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {application.influencer.avatarUrl || application.influencer.user.image ? (
                          <img
                            src={application.influencer.avatarUrl || application.influencer.user.image!}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            {(application.influencer.displayName || application.influencer.user.name || 'U').charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {application.influencer.displayName || application.influencer.user.name || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2">
                          <ApplicationStatus status={application.status} size="sm" />
                          {application.socialAccount && (
                            <span className="text-xs text-gray-500 truncate">
                              {application.socialAccount.platform.name} @{application.socialAccount.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Application Details */}
          <div className="lg:col-span-2">
            {selectedApplication ? (
              <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-6 sticky top-20">
                {/* Influencer Info */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {selectedApplication.influencer.avatarUrl || selectedApplication.influencer.user.image ? (
                      <img
                        src={selectedApplication.influencer.avatarUrl || selectedApplication.influencer.user.image!}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                        {(selectedApplication.influencer.displayName || selectedApplication.influencer.user.name || 'U').charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedApplication.influencer.displayName || selectedApplication.influencer.user.name || 'Unknown'}
                    </h2>
                    {selectedApplication.influencer.primaryNiche && (
                      <span className="inline-block mt-1 text-sm text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                        {selectedApplication.influencer.primaryNiche}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <ApplicationStatus status={selectedApplication.status} />
                    </div>
                  </div>
                </div>

                {/* Social Accounts */}
                {selectedApplication.influencer.socialAccounts.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">{t.brand.applications.socialPlatforms}</h3>
                    <div className="space-y-2">
                      {selectedApplication.influencer.socialAccounts.map((account, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>
                            {account.platform.name} (@{account.username})
                          </span>
                          <span className="font-medium">{account.followerCount.toLocaleString()} {t.brand.applications.followers}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Account for Campaign */}
                {selectedApplication.socialAccount && (
                  <div className="mb-6 p-3 bg-blue-50 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800 mb-1">{t.brand.applications.accountForCampaign}</h3>
                    <p className="text-sm text-blue-700">
                      {selectedApplication.socialAccount.platform.name} - @{selectedApplication.socialAccount.username}
                      ({selectedApplication.socialAccount.followerCount.toLocaleString()} followers)
                    </p>
                  </div>
                )}

                {/* Pitch Message */}
                {selectedApplication.pitchMessage && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">{t.brand.applications.pitchMessage}</h3>
                    <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                      {selectedApplication.pitchMessage}
                    </p>
                  </div>
                )}

                {/* Proposed Rate */}
                {selectedApplication.proposedRate && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">{t.brand.applications.proposedRate}</h3>
                    <p className="text-lg font-semibold text-primary-600">
                      ${Number(selectedApplication.proposedRate).toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Applied Date */}
                <div className="mb-6 text-sm text-gray-500">
                  {t.brand.applications.appliedOn} {formatDate(selectedApplication.appliedAt, locale)}
                  {selectedApplication.reviewedAt && (
                    <span> &bull; {t.brand.applications.reviewedOn} {formatDate(selectedApplication.reviewedAt, locale)}</span>
                  )}
                </div>

                {/* View Profile Link */}
                <div className="flex items-center gap-4 mb-6">
                  <Link
                    href={`/influencer/${selectedApplication.influencer.id}`}
                    className="text-primary-600 hover:underline text-sm"
                    target="_blank"
                  >
                    {t.brand.applications.viewFullProfile} →
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/messages/start', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ applicationId: selectedApplication.id }),
                        })
                        if (res.ok) {
                          const data = await res.json()
                          router.push(`/dashboard/messages?conv=${data.conversationId}`)
                        }
                      } catch (error) {
                        console.error('Error starting conversation:', error)
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {t.messages?.messageButton || 'Message'}
                  </button>
                </div>

                {/* Payment Section */}
                {selectedApplication.status === 'APPROVED' && campaign?.compensationType && ['PAID', 'PAID_PLUS_GIFT', 'NEGOTIABLE'].includes(campaign.compensationType) && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Payment</h3>
                    {selectedApplication.payment ? (
                      <div className="space-y-3">
                        <PaymentStatusBadge
                          status={selectedApplication.payment.status}
                          amount={Number(selectedApplication.payment.amount)}
                          creatorPayout={Number(selectedApplication.payment.creatorPayout)}
                          paidAt={selectedApplication.payment.paidAt}
                          releasedAt={selectedApplication.payment.releasedAt}
                        />
                        {selectedApplication.payment.status === 'HELD' && (
                          <button
                            onClick={async () => {
                              if (!confirm('Release payment to the creator? This cannot be undone.')) return
                              setPaymentLoading(true)
                              try {
                                const res = await fetch('/api/stripe/release', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ applicationId: selectedApplication.id }),
                                })
                                if (res.ok) {
                                  fetchData()
                                } else {
                                  const data = await res.json()
                                  alert(data.error || 'Failed to release payment')
                                }
                              } catch {
                                alert('Failed to release payment')
                              } finally {
                                setPaymentLoading(false)
                              }
                            }}
                            disabled={paymentLoading}
                            className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            {paymentLoading ? 'Releasing...' : 'Release Payment to Creator'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          setPaymentLoading(true)
                          try {
                            const res = await fetch('/api/stripe/checkout', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ applicationId: selectedApplication.id }),
                            })
                            if (res.ok) {
                              const data = await res.json()
                              // Calculate fee breakdown from the response
                              const amount = Number(selectedApplication.proposedRate || campaign?.paymentMin || 0)
                              const feePct = 10
                              const platformFee = Math.round(amount * feePct) / 100
                              const creatorPayout = amount - platformFee
                              setPaymentModal({
                                clientSecret: data.clientSecret,
                                amount,
                                platformFee,
                                creatorPayout,
                              })
                            } else {
                              const data = await res.json()
                              alert(data.error || 'Failed to create payment')
                            }
                          } catch {
                            alert('Failed to create payment')
                          } finally {
                            setPaymentLoading(false)
                          }
                        }}
                        disabled={paymentLoading}
                        className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        {paymentLoading ? 'Setting up...' : 'Fund Payment'}
                      </button>
                    )}
                  </div>
                )}

                {/* Payment Modal */}
                {paymentModal && (
                  <PaymentModal
                    clientSecret={paymentModal.clientSecret}
                    amount={paymentModal.amount}
                    platformFee={paymentModal.platformFee}
                    creatorPayout={paymentModal.creatorPayout}
                    onSuccess={() => {
                      setPaymentModal(null)
                      fetchData()
                    }}
                    onCancel={() => setPaymentModal(null)}
                  />
                )}

                {/* Actions */}
                <div className="pt-6 border-t">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">{t.brand.applications.actions}</h3>
                  {collabByApp[selectedApplication.id] ? (
                    <Link
                      href={`/dashboard/brand/collaborations/${collabByApp[selectedApplication.id].id}`}
                      className="flex items-center justify-between w-full mb-3 px-4 py-2.5 border border-primary-200 bg-primary-50 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-100 transition"
                    >
                      <span className="inline-flex items-center gap-2">
                        <StatusBadge machine="collaboration" status={collabByApp[selectedApplication.id].status} size="sm" />
                        {t.collab.manage}
                      </span>
                      <span>→</span>
                    </Link>
                  ) : ['PENDING', 'UNDER_REVIEW'].includes(selectedApplication.status) ? (
                    <button
                      onClick={() => setConfirmFor(selectedApplication)}
                      className="w-full mb-3 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
                    >
                      {t.collab.select}
                    </button>
                  ) : null}
                  <ApplicationActions
                    applicationId={selectedApplication.id}
                    currentStatus={selectedApplication.status}
                    onStatusChange={(newStatus) => handleStatusChange(selectedApplication.id, newStatus)}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-12 text-center">
                <p className="text-gray-500">{t.brand.applications.selectApplication}</p>
              </div>
            )}
          </div>
        </div>

        {/* Collaborations */}
        {collaborations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">{t.collab.collaborationsTitle}</h2>
            <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm divide-y">
              {collaborations.map((col) => (
                <div key={col.id} className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {col.influencer?.avatarUrl ? (
                      <img src={col.influencer.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        {(col.influencer?.displayName || 'C').charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{col.influencer?.displayName || col.influencer?.user?.name || 'Creator'}</p>
                    <div className="mt-0.5"><StatusBadge machine="collaboration" status={col.status} size="sm" dot /></div>
                  </div>
                  {col.payment?.status && <StatusBadge machine="payment" status={col.payment.status} size="sm" />}
                  <Link href={`/dashboard/brand/collaborations/${col.id}`} className="text-primary-600 hover:underline text-sm whitespace-nowrap">
                    {t.collab.manage} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {confirmFor && (
          <ConfirmCollaborationModal
            applicationId={confirmFor.id}
            creatorName={confirmFor.influencer.displayName || confirmFor.influencer.user.name || 'Creator'}
            campaignTitle={campaign?.title || ''}
            onCreated={() => { setConfirmFor(null); fetchData() }}
            onClose={() => setConfirmFor(null)}
          />
        )}
      </div>
    </BrandWorkspaceLayout>
  )
}
