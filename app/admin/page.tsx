'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import MainLayout from '@/components/MainLayout'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate, formatDateTime } from '@/lib/i18n/formatDate'

interface Overview {
  totalUsers: number
  proUsers: number
  freeUsers: number
  totalCampaigns: number
  totalApplications: number
  aiMonthlyTokens: number
  aiMonthlyRequests: number
}

interface UserData {
  id: string
  name: string | null
  email: string
  userType: string
  subscriptionTier: string
  isActive: boolean
  createdAt: string
  _count: { aiTokenUsage: number }
  aiUsage: {
    monthlyTokens: number
    monthlyPromptTokens: number
    monthlyCompletionTokens: number
    monthlyRequests: number
  }
}

interface AiLog {
  id: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
  createdAt: string
  user: { email: string; name: string | null }
}

interface BetaCode {
  id: string
  code: string
  note: string | null
  maxUses: number
  usedCount: number
  isActive: boolean
  createdAt: string
  expiresAt: string | null
  usedBy: { userId: string; usedAt: string }[]
}

interface BetaFeedbackItem {
  id: string
  type: string
  content: string
  page: string | null
  status: string
  createdAt: string
  user: { name: string | null; email: string }
}

export default function AdminDashboard() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [triedRefresh, setTriedRefresh] = useState(false)
  const { t, locale } = useLanguage()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<UserData[]>([])
  const [recentAiLogs, setRecentAiLogs] = useState<AiLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ai-usage' | 'beta-codes' | 'beta-feedback' | 'brand-verification' | 'campaign-review'>('overview')

  // Brand verification state
  const [pendingBrands, setPendingBrands] = useState<any[]>([])
  const [brandVerifFilter, setBrandVerifFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // Campaign review state
  const [reviewCampaigns, setReviewCampaigns] = useState<any[]>([])
  const [changesNote, setChangesNote] = useState('')
  const [changesId, setChangesId] = useState<string | null>(null)

  // Beta state
  const [betaCodes, setBetaCodes] = useState<BetaCode[]>([])
  const [betaFeedback, setBetaFeedback] = useState<BetaFeedbackItem[]>([])
  const [generateCount, setGenerateCount] = useState(5)
  const [generateMaxUses, setGenerateMaxUses] = useState(1)
  const [generateNote, setGenerateNote] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    // Access control is enforced server-side in app/admin/layout.tsx (DB check).
    // Here we only make sure the JWT is fresh so /api/admin/* calls (which read
    // userType from the token) succeed for a recently-promoted admin.
    if (status === 'loading' || !session?.user) return
    if ((session.user as any).userType !== 'ADMIN') {
      if (!triedRefresh) {
        setTriedRefresh(true)
        update()
      }
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.ok) {
          const data = await res.json()
          setOverview(data.overview)
          setUsers(data.users)
          setRecentAiLogs(data.recentAiLogs)
        }
      } catch (error) {
        console.error('Failed to fetch admin stats:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
    fetchBetaCodes()
    fetchBetaFeedback()
    fetchBrandVerifications('PENDING')
    fetchCampaignReviews()
  }, [session, status, router, triedRefresh, update])

  const fetchBrandVerifications = async (filterStatus?: string) => {
    try {
      const res = await fetch(`/api/admin/brand-verification?status=${filterStatus || brandVerifFilter}`)
      if (res.ok) {
        const data = await res.json()
        setPendingBrands(data.brands)
      }
    } catch {}
  }

  const handleBrandAction = async (brandProfileId: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
    try {
      const res = await fetch('/api/admin/brand-verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandProfileId, action, rejectionReason: reason }),
      })
      if (res.ok) {
        setRejectingId(null)
        setRejectReason('')
        fetchBrandVerifications()
      }
    } catch {}
  }

  const fetchCampaignReviews = async () => {
    try {
      const res = await fetch('/api/admin/campaign-review')
      if (res.ok) {
        const data = await res.json()
        setReviewCampaigns(data.campaigns)
      }
    } catch {}
  }

  const handleCampaignReview = async (campaignId: string, action: 'approve' | 'request_changes', reviewNote?: string) => {
    try {
      const res = await fetch('/api/admin/campaign-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, action, reviewNote }),
      })
      if (res.ok) {
        setChangesId(null)
        setChangesNote('')
        fetchCampaignReviews()
      }
    } catch {}
  }

  const fetchBetaCodes = async () => {
    try {
      const res = await fetch('/api/admin/beta/codes')
      if (res.ok) setBetaCodes(await res.json())
    } catch {}
  }

  const fetchBetaFeedback = async () => {
    try {
      const res = await fetch('/api/admin/beta/feedback')
      if (res.ok) setBetaFeedback(await res.json())
    } catch {}
  }

  const handleGenerateCodes = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/admin/beta/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: generateCount,
          maxUses: generateMaxUses,
          note: generateNote || undefined,
        }),
      })
      if (res.ok) {
        setGenerateNote('')
        fetchBetaCodes()
      }
    } catch {}
    setIsGenerating(false)
  }

  const handleToggleCode = async (id: string, isActive: boolean) => {
    try {
      await fetch('/api/admin/beta/codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !isActive }),
      })
      fetchBetaCodes()
    } catch {}
  }

  const handleUpdateFeedbackStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/admin/beta/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      fetchBetaFeedback()
    } catch {}
  }

  if (status === 'loading' || isLoading) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading admin dashboard...</p>
        </div>
      </MainLayout>
    )
  }

  if (!overview) return null

  const estimateCost = (tokens: number) => {
    // GPT-4o-mini rough average: ~$0.30 per 1M tokens
    return (tokens / 1_000_000 * 0.3).toFixed(4)
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mb-8">Platform overview and monitoring</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
          {(['overview', 'users', 'ai-usage', 'brand-verification', 'campaign-review', 'beta-codes', 'beta-feedback'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (tab === 'brand-verification') fetchBrandVerifications()
                if (tab === 'campaign-review') fetchCampaignReviews()
              }}
              className={`px-4 py-2 rounded-md text-sm transition ${
                activeTab === tab
                  ? 'bg-white text-gray-900 font-bold shadow-sm'
                  : 'text-gray-600 font-medium hover:text-gray-900'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'users' ? 'Users' : tab === 'ai-usage' ? 'AI Usage' : tab === 'brand-verification' ? 'Brand Verification' : tab === 'campaign-review' ? `Campaign Review${reviewCampaigns.length ? ` (${reviewCampaigns.length})` : ''}` : tab === 'beta-codes' ? 'Beta Codes' : 'Beta Feedback'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Users" value={overview.totalUsers} />
              <StatCard label="Pro Users" value={overview.proUsers} accent="text-green-600" />
              <StatCard label="Free Users" value={overview.freeUsers} />
              <StatCard label="Campaigns" value={overview.totalCampaigns} />
              <StatCard label="Applications" value={overview.totalApplications} />
              <StatCard
                label="AI Tokens (This Month)"
                value={overview.aiMonthlyTokens.toLocaleString()}
              />
              <StatCard label="AI Requests (This Month)" value={overview.aiMonthlyRequests} />
              <StatCard
                label="Est. AI Cost (This Month)"
                value={`$${estimateCost(overview.aiMonthlyTokens)}`}
                accent="text-orange-600"
              />
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Tier</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Active</th>
                    <th className="px-4 py-3 font-medium text-gray-600">AI Requests (Month)</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Tokens (Month)</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                      <td className="px-4 py-3">{u.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          u.userType === 'ADMIN'
                            ? 'bg-red-100 text-red-700'
                            : u.userType === 'BRAND'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {u.userType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          u.subscriptionTier === 'PRO'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.subscriptionTier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.isActive ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-red-600">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{u.aiUsage.monthlyRequests}</td>
                      <td className="px-4 py-3 text-right">
                        {u.aiUsage.monthlyTokens > 0 ? (
                          <span>
                            {u.aiUsage.monthlyTokens.toLocaleString()}
                            <span className="text-gray-400 ml-1 text-xs">
                              / 150k
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(u.createdAt, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Usage Tab */}
        {activeTab === 'ai-usage' && (
          <div>
            {/* Monthly summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total Tokens"
                value={overview.aiMonthlyTokens.toLocaleString()}
              />
              <StatCard label="Total Requests" value={overview.aiMonthlyRequests} />
              <StatCard
                label="Est. Cost"
                value={`$${estimateCost(overview.aiMonthlyTokens)}`}
                accent="text-orange-600"
              />
              <StatCard
                label="Avg Tokens/Request"
                value={
                  overview.aiMonthlyRequests > 0
                    ? Math.round(overview.aiMonthlyTokens / overview.aiMonthlyRequests).toLocaleString()
                    : '0'
                }
              />
            </div>

            {/* Per-user usage this month */}
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Per-User Usage (This Month)</h3>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">User</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Prompt</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Completion</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Requests</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users
                    .filter((u) => u.aiUsage.monthlyTokens > 0)
                    .sort((a, b) => b.aiUsage.monthlyTokens - a.aiUsage.monthlyTokens)
                    .map((u) => {
                      const pct = Math.min((u.aiUsage.monthlyTokens / 150_000) * 100, 100)
                      return (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{u.name || u.email}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {u.aiUsage.monthlyPromptTokens.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {u.aiUsage.monthlyCompletionTokens.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-medium">
                            {u.aiUsage.monthlyTokens.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">{u.aiUsage.monthlyRequests}</td>
                          <td className="px-4 py-3 w-40">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-10 text-right">
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  {users.filter((u) => u.aiUsage.monthlyTokens > 0).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No AI usage this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent logs */}
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Requests (Last 50)</h3>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">User</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Model</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Prompt</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Completion</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentAiLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs">{log.user.name || log.user.email}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                          {log.model}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {log.promptTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {log.completionTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium">
                        {log.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDateTime(log.createdAt, locale)}
                      </td>
                    </tr>
                  ))}
                  {recentAiLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No AI requests yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Beta Codes Tab */}
        {/* Brand Verification Tab */}
        {/* Campaign Review Tab */}
        {activeTab === 'campaign-review' && (
          <div>
            {reviewCampaigns.length === 0 ? (
              <p className="text-gray-500 text-sm">No campaigns awaiting review.</p>
            ) : (
              <div className="space-y-4">
                {reviewCampaigns.map((c) => (
                  <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {c.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold">
                              {c.title.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <a href={`/campaign/${c.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-900 hover:text-primary-600 truncate block">
                            {c.title}
                          </a>
                          <p className="text-sm text-gray-500 truncate">
                            {c.brand?.companyName}
                            {c.categories?.[0] && <> · {c.categories[0].category?.name}</>}
                            {c.platforms?.length > 0 && <> · {c.platforms.map((p: any) => p.platform.name).join(', ')}</>}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">
                        In Review
                      </span>
                    </div>

                    {c.description && (
                      <p className="mt-3 text-sm text-gray-600 line-clamp-3">{c.description}</p>
                    )}

                    <div className="mt-4 flex gap-2 items-center">
                      <button
                        onClick={() => handleCampaignReview(c.id, 'approve')}
                        className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition"
                      >
                        Approve → Live
                      </button>
                      {changesId === c.id ? (
                        <div className="flex gap-2 items-center flex-1">
                          <input
                            type="text"
                            value={changesNote}
                            onChange={(e) => setChangesNote(e.target.value)}
                            placeholder="What needs to change..."
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <button
                            onClick={() => handleCampaignReview(c.id, 'request_changes', changesNote)}
                            disabled={!changesNote.trim()}
                            className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 transition disabled:opacity-50"
                          >
                            Send back to Draft
                          </button>
                          <button
                            onClick={() => { setChangesId(null); setChangesNote('') }}
                            className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-md hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setChangesId(c.id)}
                          className="px-4 py-1.5 border border-amber-300 text-amber-700 text-sm rounded-md hover:bg-amber-50 transition"
                        >
                          Request Changes
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'brand-verification' && (
          <div>
            <div className="flex gap-2 mb-6">
              {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setBrandVerifFilter(s); fetchBrandVerifications(s) }}
                  className={`px-3 py-1.5 rounded-md text-sm transition ${
                    brandVerifFilter === s ? 'bg-white text-gray-900 font-bold shadow-sm ring-1 ring-gray-200' : 'bg-gray-100 text-gray-700 font-medium hover:bg-gray-200'
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {pendingBrands.length === 0 ? (
              <p className="text-gray-500 text-sm">No {brandVerifFilter.toLowerCase()} brand applications.</p>
            ) : (
              <div className="space-y-4">
                {pendingBrands.map((brand) => (
                  <div key={brand.id} className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{brand.businessLegalName || brand.companyName || 'Unnamed'}</h3>
                        <p className="text-sm text-gray-500">{brand.user.email} &middot; {brand.user.name}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        brand.brandVerificationStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        brand.brandVerificationStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {brand.brandVerificationStatus}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">Registration No.</span>
                        <p className="text-gray-700">{brand.businessRegistrationNo || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Country</span>
                        <p className="text-gray-700">{brand.businessCountry || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Website</span>
                        <p className="text-gray-700">{brand.businessWebsite ? <a href={brand.businessWebsite} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">{brand.businessWebsite}</a> : '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Submitted</span>
                        <p className="text-gray-700">{brand.verificationSubmittedAt ? formatDate(brand.verificationSubmittedAt, locale) : '—'}</p>
                      </div>
                    </div>

                    {brand.businessDocuments && brand.businessDocuments.length > 0 && (
                      <div className="mt-3">
                        <span className="text-gray-400 text-xs">Documents</span>
                        <div className="flex gap-2 mt-1">
                          {brand.businessDocuments.map((doc: string, i: number) => (
                            <a key={i} href={doc} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 underline">
                              Document {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {brand.rejectionReason && (
                      <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                        <strong>Rejection reason:</strong> {brand.rejectionReason}
                      </div>
                    )}

                    {brand.brandVerificationStatus === 'PENDING' && (
                      <div className="mt-4 flex gap-2 items-center">
                        <button
                          onClick={() => handleBrandAction(brand.id, 'APPROVE')}
                          className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition"
                        >
                          Approve
                        </button>

                        {rejectingId === brand.id ? (
                          <div className="flex gap-2 items-center flex-1">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for rejection..."
                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <button
                              onClick={() => handleBrandAction(brand.id, 'REJECT', rejectReason)}
                              disabled={!rejectReason.trim()}
                              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition disabled:opacity-50"
                            >
                              Confirm Reject
                            </button>
                            <button
                              onClick={() => { setRejectingId(null); setRejectReason('') }}
                              className="text-sm text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRejectingId(brand.id)}
                            className="px-4 py-1.5 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'beta-codes' && (
          <div>
            {/* Generate codes form */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Generate Invite Codes</h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Count</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={generateCount}
                    onChange={(e) => setGenerateCount(Number(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max uses each</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={generateMaxUses}
                    onChange={(e) => setGenerateMaxUses(Number(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={generateNote}
                    onChange={(e) => setGenerateNote(e.target.value)}
                    placeholder="e.g. For WeChat group testers"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <button
                  onClick={handleGenerateCodes}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-medium transition disabled:opacity-50"
                >
                  {isGenerating ? t.admin.betaCodes.generating : `Generate ${generateCount} Code${generateCount > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>

            {/* Codes table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  {t.admin.betaCodes.allCodesTitle.replace('{count}', String(betaCodes.length))}
                </h3>
                <div className="text-xs text-gray-500">
                  {t.admin.betaCodes.activeLabel} {betaCodes.filter(c => c.isActive).length} | {t.admin.betaCodes.usedLabel} {betaCodes.filter(c => c.usedCount > 0).length}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-600">{t.admin.betaCodes.code}</th>
                      <th className="px-4 py-3 font-medium text-gray-600">{t.admin.betaCodes.note}</th>
                      <th className="px-4 py-3 font-medium text-gray-600">{t.admin.betaCodes.usageCol}</th>
                      <th className="px-4 py-3 font-medium text-gray-600">{t.admin.betaCodes.status}</th>
                      <th className="px-4 py-3 font-medium text-gray-600">{t.admin.betaCodes.created}</th>
                      <th className="px-4 py-3 font-medium text-gray-600">{t.admin.betaCodes.expires}</th>
                      <th className="px-4 py-3 font-medium text-gray-600">{t.admin.betaCodes.action}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {betaCodes.map((code) => (
                      <tr key={code.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{code.code}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{code.note || '—'}</td>
                        <td className="px-4 py-3 text-xs">
                          {code.usedCount}/{code.maxUses}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            !code.isActive
                              ? 'bg-gray-100 text-gray-500'
                              : code.usedCount >= code.maxUses
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {!code.isActive ? 'Disabled' : code.usedCount >= code.maxUses ? 'Exhausted' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(code.createdAt, locale)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {code.expiresAt ? formatDate(code.expiresAt, locale) : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleCode(code.id, code.isActive)}
                            className={`text-xs font-medium ${
                              code.isActive
                                ? 'text-red-600 hover:text-red-700'
                                : 'text-green-600 hover:text-green-700'
                            }`}
                          >
                            {code.isActive ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {betaCodes.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                          No invite codes yet — generate some above
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Beta Feedback Tab */}
        {activeTab === 'beta-feedback' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard label="Total Feedback" value={betaFeedback.length} />
              <StatCard label="New / Unreviewed" value={betaFeedback.filter(f => f.status === 'new').length} accent="text-amber-600" />
              <StatCard label="Resolved" value={betaFeedback.filter(f => f.status === 'resolved').length} accent="text-green-600" />
            </div>

            <div className="space-y-4">
              {betaFeedback.map((fb) => (
                <div key={fb.id} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        fb.type === 'bug' ? 'bg-red-100 text-red-700' :
                        fb.type === 'feature' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {fb.type === 'bug' ? '🐛 Bug' : fb.type === 'feature' ? '💡 Feature' : '💬 General'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        fb.status === 'new' ? 'bg-amber-100 text-amber-700' :
                        fb.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {fb.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {fb.status !== 'reviewed' && (
                        <button
                          onClick={() => handleUpdateFeedbackStatus(fb.id, 'reviewed')}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Mark Reviewed
                        </button>
                      )}
                      {fb.status !== 'resolved' && (
                        <button
                          onClick={() => handleUpdateFeedbackStatus(fb.id, 'resolved')}
                          className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-900 mb-2 whitespace-pre-wrap">{fb.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{fb.user.name || fb.user.email}</span>
                    {fb.page && <span>Page: {fb.page}</span>}
                    <span>{formatDateTime(fb.createdAt, locale)}</span>
                  </div>
                </div>
              ))}
              {betaFeedback.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-400">
                  No feedback received yet
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
