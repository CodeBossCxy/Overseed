'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import ConfirmCollaborationModal from '@/components/collaborations/ConfirmCollaborationModal'
import PipelineTabs from '@/components/PipelineTabs'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/i18n/formatDate'

// Applications & Collaborations per spec: two sections — every applicant with
// Select / Decline actions, and the selected creators' collaborations with
// payment state and a single Manage Collaboration action.

function Avatar({ src, name }: { src?: string | null; name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  )
}

export default function CampaignApplicationsPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  const { t, locale } = useLanguage()
  const a = t.brand.applications

  const [campaign, setCampaign] = useState<any>(null)
  const [applications, setApplications] = useState<any[]>([])
  const [collaborations, setCollaborations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmFor, setConfirmFor] = useState<any | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedCreators, setSavedCreators] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/saved-creators?idsOnly=1')
      .then((res) => (res.ok ? res.json() : { ids: [] }))
      .then((data) => setSavedCreators(new Set(data.ids || [])))
      .catch(() => {})
  }, [])

  const toggleSaveCreator = async (influencerId: string, next: boolean) => {
    setSavedCreators((prev) => {
      const set = new Set(prev)
      next ? set.add(influencerId) : set.delete(influencerId)
      return set
    })
    try {
      const res = next
        ? await fetch('/api/saved-creators', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ influencerId }),
          })
        : await fetch(`/api/saved-creators?influencerId=${influencerId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setSavedCreators((prev) => {
        const set = new Set(prev)
        next ? set.delete(influencerId) : set.add(influencerId)
        return set
      })
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const [campaignRes, appsRes, colRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}?lang=${locale}`),
        fetch(`/api/campaigns/${campaignId}/applications?lang=${locale}`),
        fetch(`/api/collaborations?role=brand&campaignId=${campaignId}`),
      ])
      if (campaignRes.ok) setCampaign(await campaignRes.json())
      if (appsRes.ok) setApplications(await appsRes.json())
      if (colRes.ok) {
        const colData = await colRes.json()
        setCollaborations(colData.collaborations || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [campaignId, locale])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const collabByApp: Record<string, any> = {}
  collaborations.forEach((col) => {
    collabByApp[col.applicationId] = col
  })

  const decline = async (applicationId: string) => {
    setBusyId(applicationId)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      })
      if (res.ok) {
        setApplications((prev) =>
          prev.map((app) => (app.id === applicationId ? { ...app, status: 'REJECTED' } : app))
        )
      }
    } finally {
      setBusyId(null)
    }
  }

  const message = async (applicationId: string) => {
    setBusyId(applicationId)
    try {
      const res = await fetch('/api/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      if (res.ok) router.push('/dashboard/messages')
    } finally {
      setBusyId(null)
    }
  }

  const creatorName = (app: any) =>
    app.influencer?.displayName || app.influencer?.user?.name || 'Creator'

  const platformOf = (app: any) =>
    app.socialAccount?.platform?.name || app.influencer?.socialAccounts?.[0]?.platform?.name || '—'

  const followersOf = (app: any) => {
    const n =
      app.socialAccount?.followerCount ??
      Math.max(0, ...(app.influencer?.socialAccounts || []).map((s: any) => s.followerCount || 0))
    return n
      ? new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
      : '—'
  }

  if (isLoading) {
    return (
      <BrandWorkspaceLayout>
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">{a.loading}</p>
        </div>
      </BrandWorkspaceLayout>
    )
  }

  return (
    <BrandWorkspaceLayout>
      <div className="max-w-6xl mx-auto workspace-page-tight pb-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">
            <Link href="/dashboard/brand/campaigns" className="hover:text-primary-700">{a.breadcrumbPipeline}</Link>
            {campaign && (
              <>
                {' › '}
                <Link href={`/dashboard/brand/campaigns/${campaignId}`} className="hover:text-primary-700">{campaign.title}</Link>
                {' › '}
                <span className="font-semibold text-gray-700">{a.breadcrumbManage}</span>
              </>
            )}
          </p>
          <h1 className="text-3xl font-bold text-gray-900">{a.pageTitle}</h1>
          <p className="text-gray-500 mt-1">{t.brand.discover.tabPipelineDesc}</p>
        </div>

        <PipelineTabs campaignId={campaignId} active="pipeline" />

        {/* Campaign summary */}
        {campaign && (
          <div className="mb-6 workspace-glass-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-20 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {campaign.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={campaign.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold">
                    {campaign.title?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{campaign.title}</p>
                {campaign.categories?.[0] && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                    {t.categoryNames[campaign.categories[0].category?.name] || campaign.categories[0].category?.name}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{a.thStatus}</p>
              <StatusBadge machine="campaign" status={campaign.status} size="sm" dot />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{a.applicationsSection}</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{applications.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{a.selectedCreators}</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{collaborations.length}</p>
            </div>
            {campaign.deadline && (
              <div>
                <p className="text-xs text-gray-400 mb-1">{a.thDeadline}</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(campaign.deadline, locale)}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Applications ── */}
        <div className="workspace-glass-card rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {a.applicationsSection}
            </h2>
            <span className="text-xs text-gray-400">{applications.length} {a.applicationsCount}</span>
          </div>

          {applications.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{a.noApplications}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="py-2 pr-4 font-medium">{a.thCreator}</th>
                    <th className="py-2 px-3 font-medium">{a.thPlatform}</th>
                    <th className="py-2 px-3 font-medium">{a.thFollowers}</th>
                    <th className="py-2 px-3 font-medium">{a.thCountry}</th>
                    <th className="py-2 px-3 font-medium">{a.thStatus}</th>
                    <th className="py-2 px-3 font-medium">{a.thViewProfile}</th>
                    <th className="py-2 px-3 font-medium">{a.thMessage}</th>
                    <th className="py-2 pl-3 font-medium">{a.thSelectCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {applications.map((app) => {
                    const name = creatorName(app)
                    const hasCollab = !!collabByApp[app.id]
                    const selectable = ['PENDING', 'UNDER_REVIEW'].includes(app.status) && !hasCollab
                    return (
                      <tr key={app.id} className="hover:bg-white/70 transition">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3 min-w-[160px]">
                            <Avatar src={app.influencer?.avatarUrl || app.influencer?.user?.image} name={name} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                              {app.influencer?.socialAccounts?.[0]?.username && (
                                <p className="text-xs text-gray-400 truncate">@{app.influencer.socialAccounts[0].username}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">{platformOf(app)}</td>
                        <td className="py-3 px-3 text-sm text-gray-700 tabular-nums">{followersOf(app)}</td>
                        <td className="py-3 px-3 text-sm text-gray-700">{app.influencer?.locationCountry || '—'}</td>
                        <td className="py-3 px-3">
                          <StatusBadge machine="application" status={hasCollab && app.status !== 'COMPLETED' ? 'APPROVED' : app.status} size="sm" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/influencer/${app.influencer?.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white shadow-sm rounded-full text-xs font-semibold text-gray-700 hover:text-primary-700 transition whitespace-nowrap"
                            >
                              {a.thViewProfile}
                            </Link>
                            <button
                              onClick={() => toggleSaveCreator(app.influencer?.id, !savedCreators.has(app.influencer?.id))}
                              className={`p-1.5 rounded-lg transition ${
                                savedCreators.has(app.influencer?.id)
                                  ? 'text-primary-600 hover:text-red-500'
                                  : 'text-gray-300 hover:text-primary-600'
                              }`}
                              title={savedCreators.has(app.influencer?.id) ? t.brand.savedCreators.savedState : t.brand.savedCreators.save}
                            >
                              <svg className="w-[18px] h-[18px]" fill={savedCreators.has(app.influencer?.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => message(app.id)}
                            disabled={busyId === app.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white shadow-sm rounded-full text-xs font-semibold text-gray-700 hover:text-primary-700 transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {a.thMessage}
                          </button>
                        </td>
                        <td className="py-3 pl-3">
                          {hasCollab || app.status === 'APPROVED' || app.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-semibold whitespace-nowrap">
                              ✓ {a.selectedBtn}
                            </span>
                          ) : selectable ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setConfirmFor(app)}
                              className="px-4 py-1.5 border border-primary-200 text-primary-700 rounded-full text-xs font-semibold hover:bg-primary-50 transition whitespace-nowrap"
                              >
                                {a.selectBtn}
                              </button>
                              <button
                                onClick={() => decline(app.id)}
                                disabled={busyId === app.id}
                                className="px-4 py-1.5 border border-gray-200 text-gray-600 rounded-full text-xs font-semibold hover:bg-gray-50 transition disabled:opacity-50 whitespace-nowrap"
                              >
                                {a.declineBtn}
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-300 pl-2">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Collaborations ── */}
        <div className="workspace-glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {a.collaborationsSection}
            </h2>
            <span className="text-xs text-gray-400">{collaborations.length} {a.selectedCreatorsCount}</span>
          </div>

          {collaborations.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">—</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="py-2 pr-4 font-medium">{a.thCreator}</th>
                    <th className="py-2 px-3 font-medium">{a.thCollabStatus}</th>
                    <th className="py-2 px-3 font-medium">{a.thPayment}</th>
                    <th className="py-2 px-3 font-medium">{a.thDeadline}</th>
                    <th className="py-2 pl-3 font-medium">{a.thAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {collaborations.map((col) => (
                    <tr key={col.id} className="hover:bg-white/70 transition">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3 min-w-[160px]">
                          <Avatar
                            src={col.influencer?.avatarUrl || col.influencer?.user?.image}
                            name={col.influencer?.displayName || col.influencer?.user?.name || 'C'}
                          />
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {col.influencer?.displayName || col.influencer?.user?.name}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge machine="collaboration" status={col.status} size="sm" />
                      </td>
                      <td className="py-3 px-3">
                        {col.payment ? (
                          <StatusBadge machine="payment" status={col.payment.status} size="sm" />
                        ) : (
                          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                            {a.paymentNA}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">
                        {col.deadline ? formatDate(col.deadline, locale) : '—'}
                      </td>
                      <td className="py-3 pl-3">
                        <Link
                          href={`/dashboard/brand/collaborations/${col.id}`}
                          className="inline-flex items-center px-4 py-1.5 bg-white shadow-sm rounded-full text-xs font-semibold text-gray-700 hover:text-primary-700 transition whitespace-nowrap"
                        >
                          {a.manageCollab}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Select → Confirm Collaboration */}
      {confirmFor && (
        <ConfirmCollaborationModal
          applicationId={confirmFor.id}
          creatorName={creatorName(confirmFor)}
          campaignTitle={campaign?.title || ''}
          onCreated={() => {
            setConfirmFor(null)
            fetchData()
          }}
          onClose={() => setConfirmFor(null)}
        />
      )}
    </BrandWorkspaceLayout>
  )
}
