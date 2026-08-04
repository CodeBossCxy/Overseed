'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import StatusBadge from '@/components/StatusBadge'
import ConfirmCollaborationModal from '@/components/collaborations/ConfirmCollaborationModal'
import UGCTranslateToggle from '@/components/UGCTranslateToggle'
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

function RowIcon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center text-[#5571c7]">{children}</span>
}

function PlatformMark({ platform }: { platform: string }) {
  const key = platform.toLowerCase()
  if (key.includes('instagram')) return <span className="font-bold text-pink-500">◎</span>
  if (key.includes('tiktok')) return <span className="font-bold text-gray-900">♪</span>
  if (key.includes('youtube')) return <span className="font-bold text-red-500">▶</span>
  return <span className="h-2 w-2 rounded-full bg-[#7085c8]" />
}

export default function CampaignApplicationsPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  const { t, locale, isUGCTranslated } = useLanguage()
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
        fetch(`/api/campaigns/${campaignId}${isUGCTranslated ? `?lang=${locale}` : ''}`),
        fetch(`/api/campaigns/${campaignId}/applications${isUGCTranslated ? `?lang=${locale}` : ''}`),
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
  }, [campaignId, locale, isUGCTranslated])

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
      <div className="max-w-[1240px] mx-auto workspace-page-tight pb-8 text-[#182860]">
        {/* Header */}
        <div className="mb-7">
          <p className="mb-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-[#6680b8]">
            <Link href="/dashboard/brand/campaigns" className="hover:text-primary-700">{a.breadcrumbPipeline}</Link>
            {campaign && (
              <>
                <span className="text-lg font-normal text-[#8ba0c9]">›</span>
                <Link href={`/dashboard/brand/campaigns/${campaignId}`} className="hover:text-primary-700">{campaign.title}</Link>
                <span className="text-lg font-normal text-[#8ba0c9]">›</span>
                <span>{a.breadcrumbManage}</span>
              </>
            )}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#122a75]">{a.pageTitle}</h1>
              <p className="mt-1 text-sm font-medium text-[#7182aa]">{t.brand.discover.tabPipelineDesc}</p>
            </div>
            <UGCTranslateToggle isLoading={isLoading} />
          </div>
        </div>

        {/* Campaign summary */}
        {campaign && (
          <div className="mb-5 workspace-glass-card rounded-2xl px-4 py-4 flex flex-wrap items-stretch gap-y-4">
            <div className="flex min-w-[340px] flex-1 items-center gap-5 pr-6">
              <div className="w-32 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
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
                <p className="text-lg font-bold text-[#172760] truncate">{campaign.title}</p>
                {campaign.categories?.[0] && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                    {t.categoryNames[campaign.categories[0].category?.name] || campaign.categories[0].category?.name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex min-w-[155px] flex-col justify-center border-l border-[#dfe5f2] px-8">
              <p className="text-xs font-semibold text-[#7084b1] mb-2">{a.thStatus}</p>
              <StatusBadge machine="campaign" status={campaign.status} size="sm" dot />
            </div>
            <div className="flex min-w-[155px] flex-col justify-center border-l border-[#dfe5f2] px-8">
              <p className="text-xs font-semibold text-[#7084b1] mb-2">{a.applicationsSection}</p>
              <p className="text-xl font-bold text-[#172760] tabular-nums">{applications.length}</p>
            </div>
            <div className="flex min-w-[165px] flex-col justify-center border-l border-[#dfe5f2] px-8">
              <p className="text-xs font-semibold text-[#7084b1] mb-2">{a.selectedCreators}</p>
              <p className="text-xl font-bold text-[#172760] tabular-nums">{collaborations.length}</p>
            </div>
            {campaign.deadline && (
              <div className="flex min-w-[170px] flex-col justify-center border-l border-[#dfe5f2] px-8">
                <p className="text-xs font-semibold text-[#7084b1] mb-2">{a.thDeadline}</p>
                <p className="text-sm font-semibold text-[#172760]">{formatDate(campaign.deadline, locale)}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Applications ── */}
        <div className="workspace-glass-card rounded-2xl px-5 py-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#172760] flex items-center gap-2">
              <svg className="w-5 h-5 text-[#5571c7]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {a.applicationsSection}
            </h2>
            <span className="text-xs font-semibold text-[#7084b1]">{applications.length} {a.applicationsCount}</span>
          </div>

          {applications.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{a.noApplications}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#e5e9f3] text-left text-xs text-[#7084b1]">
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
                <tbody className="divide-y divide-[#e8ecf4]">
                  {applications.map((app) => {
                    const name = creatorName(app)
                    const hasCollab = !!collabByApp[app.id]
                    const selectable = ['PENDING', 'UNDER_REVIEW'].includes(app.status) && !hasCollab
                    return (
                      <tr key={app.id} className="hover:bg-white/45 transition">
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
                        <td className="py-3 px-3 text-sm text-[#32416d] whitespace-nowrap"><span className="flex items-center gap-2"><PlatformMark platform={platformOf(app)} />{platformOf(app)}</span></td>
                        <td className="py-3 px-3 text-sm text-gray-700 tabular-nums">{followersOf(app)}</td>
                        <td className="py-3 px-3 text-sm text-gray-700">{app.influencer?.locationCountry || '—'}</td>
                        <td className="py-3 px-3">
                          <StatusBadge machine="application" status={hasCollab && app.status !== 'COMPLETED' ? 'APPROVED' : app.status} size="sm" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/influencer/${app.influencer?.id}`}
                              className="inline-flex items-center gap-2 px-3 py-2 border border-[#d9e0ee] bg-white/60 rounded-lg text-xs font-semibold text-[#38528f] hover:text-primary-700 transition whitespace-nowrap"
                            >
                              <RowIcon><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 19a6 6 0 00-12 0m6-8a4 4 0 100-8 4 4 0 000 8zm8-1v6m3-3h-6" /></svg></RowIcon>
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
                            className="inline-flex items-center gap-2 px-3 py-2 border border-[#d9e0ee] bg-white/60 rounded-lg text-xs font-semibold text-[#38528f] hover:text-primary-700 transition disabled:opacity-50 whitespace-nowrap"
                          >
                            <RowIcon><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 10h8m-8 4h5m8-2a9 9 0 11-4-7.48L21 3v9z" /></svg></RowIcon>
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
                              className="min-w-[82px] px-4 py-2 border border-[#b7adff] text-[#6654d9] rounded-lg text-xs font-semibold hover:bg-primary-50 transition whitespace-nowrap"
                              >
                                {a.selectBtn}
                              </button>
                              <button
                                onClick={() => decline(app.id)}
                                disabled={busyId === app.id}
                                className="min-w-[82px] px-4 py-2 border border-[#d5dce9] text-[#536384] rounded-lg text-xs font-semibold hover:bg-gray-50 transition disabled:opacity-50 whitespace-nowrap"
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
        <div className="workspace-glass-card rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#172760] flex items-center gap-2">
              <svg className="w-5 h-5 text-[#5571c7]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {a.collaborationsSection}
            </h2>
            <span className="text-xs font-semibold text-[#7084b1]">{collaborations.length} {a.selectedCreatorsCount}</span>
          </div>

          {collaborations.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">—</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#e5e9f3] text-left text-xs text-[#7084b1]">
                    <th className="py-2 pr-4 font-medium">{a.thCreator}</th>
                    <th className="py-2 px-3 font-medium">{a.thCollabStatus}</th>
                    <th className="py-2 px-3 font-medium">{a.thPayment}</th>
                    <th className="py-2 px-3 font-medium">{a.thDeadline}</th>
                    <th className="py-2 pl-3 font-medium">{a.thAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8ecf4]">
                  {collaborations.map((col) => (
                    <tr key={col.id} className="hover:bg-white/70 transition">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3 min-w-[160px]">
                          <Avatar
                            src={col.influencer?.avatarUrl || col.influencer?.user?.image}
                            name={col.influencer?.displayName || col.influencer?.user?.name || 'C'}
                          />
                          <div className="min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{col.influencer?.displayName || col.influencer?.user?.name}</p>{col.influencer?.socialAccounts?.[0]?.username && <p className="text-xs text-gray-400 truncate">@{col.influencer.socialAccounts[0].username}</p>}</div>
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
                          className="inline-flex min-w-[164px] items-center justify-center px-4 py-2 border border-[#b7adff] bg-white/45 rounded-lg text-xs font-semibold text-[#6654d9] hover:bg-primary-50 transition whitespace-nowrap"
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
