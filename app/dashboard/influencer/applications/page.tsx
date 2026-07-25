'use client'

import { useState, useEffect } from 'react'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import ApplicationCard from '@/components/applications/ApplicationCard'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type Tab = 'applications' | 'active' | 'completed'
const ACTIVE_STATUSES = ['AWAITING_CONFIRMATION', 'ACTIVE', 'SUBMITTED']

export default function InfluencerApplicationsPage() {
  const { t } = useLanguage()
  const c = t.collab
  const [tab, setTab] = useState<Tab>('applications')
  const [applications, setApplications] = useState<any[]>([])
  const [collaborations, setCollaborations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    fetchApplications()
  }, [filter])

  useEffect(() => {
    fetch('/api/collaborations?role=creator')
      .then((r) => (r.ok ? r.json() : { collaborations: [] }))
      .then((d) => setCollaborations(d.collaborations || []))
      .catch(() => {})
  }, [])

  const fetchApplications = async () => {
    setIsLoading(true)
    try {
      const url = filter ? `/api/applications?status=${filter}` : '/api/applications'
      const response = await fetch(url)
      if (response.ok) setApplications(await response.json())
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWithdraw = async (applicationId: string) => {
    if (!confirm(t.confirmDialogs.withdrawApplication)) return
    try {
      const response = await fetch(`/api/applications/${applicationId}`, { method: 'DELETE' })
      if (response.ok) {
        setApplications((prev) => prev.map((app) => (app.id === applicationId ? { ...app, status: 'WITHDRAWN' } : app)))
      }
    } catch (error) {
      console.error('Error withdrawing application:', error)
    }
  }

  const statusFilters = [
    { value: '', label: t.influencer.applications.all },
    { value: 'PENDING', label: t.influencer.applications.pending },
    { value: 'UNDER_REVIEW', label: t.influencer.applications.underReview },
    { value: 'APPROVED', label: t.influencer.applications.approved },
    { value: 'REJECTED', label: t.influencer.applications.rejected },
    { value: 'COMPLETED', label: t.influencer.applications.completed },
  ]

  const activeCollabs = collaborations.filter((col) => ACTIVE_STATUSES.includes(col.status))
  const completedCollabs = collaborations.filter((col) => !ACTIVE_STATUSES.includes(col.status))

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'applications', label: c.tabApplications },
    { key: 'active', label: c.tabActive, count: activeCollabs.length },
    { key: 'completed', label: c.tabCompleted, count: completedCollabs.length },
  ]

  const renderCollabRow = (col: any) => (
    <div key={col.id} className="flex items-center gap-3 p-4">
      <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
        {col.campaign?.images?.[0] ? (
          <img src={col.campaign.images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            {(col.brand?.companyName || 'B').charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{col.campaign?.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge machine="collaboration" status={col.status} size="sm" dot />
          {col.payment?.status && <StatusBadge machine="payment" status={col.payment.status} size="sm" />}
          <span className="text-xs text-gray-500 truncate">{col.brand?.companyName}</span>
        </div>
      </div>
      <Link href={`/dashboard/influencer/collaborations/${col.id}`} className="text-primary-600 hover:underline text-sm whitespace-nowrap">
        {c.manage} →
      </Link>
    </div>
  )

  return (
    <CreatorWorkspaceLayout>
      <div className="max-w-5xl mx-auto pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{t.influencer.applications.title}</h1>
            <p className="text-gray-600 mt-1">{t.influencer.applications.subtitle}</p>
          </div>
          <Link href="/browse" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition">
            {t.influencer.applications.browseCampaigns}
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                tab === tb.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tb.label}
              {tb.count ? <span className="ml-1.5 text-xs text-gray-400">{tb.count}</span> : null}
            </button>
          ))}
        </div>

        {tab === 'applications' && (
          <>
            <div className="mb-6 flex flex-wrap gap-2">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    filter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto" />
                <p className="mt-4 text-gray-500">{t.influencer.applications.loading}</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-12 text-center">
                <p className="text-gray-500 text-lg mb-4">{t.influencer.applications.noApplications}</p>
                <Link href="/browse" className="inline-block px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition">
                  {t.influencer.applications.findCampaigns}
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((application) => (
                  <ApplicationCard key={application.id} application={application} showActions={true} onWithdraw={() => handleWithdraw(application.id)} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'active' && (
          activeCollabs.length === 0 ? (
            <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-12 text-center text-gray-500">{c.noItemsActive}</div>
          ) : (
            <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm divide-y">{activeCollabs.map(renderCollabRow)}</div>
          )
        )}

        {tab === 'completed' && (
          completedCollabs.length === 0 ? (
            <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm p-12 text-center text-gray-500">{c.noItemsCompleted}</div>
          ) : (
            <div className="bg-white/85 backdrop-blur rounded-2xl shadow-sm divide-y">{completedCollabs.map(renderCollabRow)}</div>
          )
        )}
      </div>
    </CreatorWorkspaceLayout>
  )
}
