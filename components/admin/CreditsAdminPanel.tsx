'use client'

// Admin "Credits" tab (pricing v4): edit plan credits/bonus, pack config and
// per-feature credit prices, and grant manual credits with a ledger note.
// English-only like the rest of the admin dashboard.

import { useEffect, useState } from 'react'

interface PlanRow {
  tier: string
  priceMonthly: number
  priceAnnual: number
  baseCredits: number
  bonusCredits: number
  migrationBonusPct: number
  migrationBonusCycles: number
}

interface PackRow {
  id: string
  priceCents: number
  baseCredits: number
  bonusCredits: number
  active: boolean
  freeUserEligible: boolean
  sortOrder: number
}

interface PriceRow {
  featureKey: string
  credits: number
}

export default function CreditsAdminPanel() {
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [packs, setPacks] = useState<PackRow[]>([])
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const [grantEmail, setGrantEmail] = useState('')
  const [grantCredits, setGrantCredits] = useState('')
  const [grantNote, setGrantNote] = useState('')
  const [granting, setGranting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/credits')
      const data = await res.json()
      setPlans(data.plans || [])
      setPacks(data.packs || [])
      setPrices(data.prices || [])
    } catch {
      setMsg('Failed to load config')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const flash = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }

  const patch = async (kind: 'plan' | 'pack' | 'price', data: Record<string, unknown>) => {
    const res = await fetch('/api/admin/credits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, data }),
    })
    if (res.ok) {
      flash('Saved')
      load()
    } else {
      const body = await res.json().catch(() => ({}))
      flash(body.error || 'Save failed')
    }
  }

  const grant = async () => {
    setGranting(true)
    try {
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: grantEmail.trim(),
          credits: parseInt(grantCredits, 10),
          note: grantNote.trim(),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        flash(`Granted ${grantCredits} credits to ${grantEmail}`)
        setGrantEmail('')
        setGrantCredits('')
        setGrantNote('')
      } else {
        flash(body.error || 'Grant failed')
      }
    } finally {
      setGranting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 py-8">Loading credit config…</p>
  }

  const inputCls =
    'w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500'

  return (
    <div className="space-y-8">
      {msg && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {msg}
        </div>
      )}

      {/* Manual grant */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-1">Manual credit grant</h2>
        <p className="text-xs text-gray-500 mb-4">
          Adds a purchased-bucket lot (12-month validity). The note is stored on the ledger.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="px-3 py-1.5 border border-gray-300 rounded text-sm w-64"
            placeholder="user email"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
          />
          <input
            className="px-3 py-1.5 border border-gray-300 rounded text-sm w-28"
            placeholder="credits"
            type="number"
            min={1}
            value={grantCredits}
            onChange={(e) => setGrantCredits(e.target.value)}
          />
          <input
            className="px-3 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-56"
            placeholder="ledger note (required, e.g. 'support goodwill #1234')"
            value={grantNote}
            onChange={(e) => setGrantNote(e.target.value)}
          />
          <button
            onClick={grant}
            disabled={granting || !grantEmail.trim() || !grantNote.trim() || !(parseInt(grantCredits, 10) > 0)}
            className="px-4 py-1.5 bg-gray-900 text-white rounded text-sm font-medium disabled:opacity-40"
          >
            {granting ? 'Granting…' : 'Grant'}
          </button>
        </div>
      </section>

      {/* Plan credits */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-4">Subscription plans</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">Tier</th>
              <th>¥/mo (cents)</th>
              <th>¥/yr (cents)</th>
              <th>Base credits</th>
              <th>Bonus credits</th>
              <th>Migr. %</th>
              <th>Migr. cycles</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p, i) => (
              <tr key={p.tier} className="border-b last:border-0">
                <td className="py-2 font-medium">{p.tier}</td>
                {(
                  [
                    'priceMonthly',
                    'priceAnnual',
                    'baseCredits',
                    'bonusCredits',
                    'migrationBonusPct',
                    'migrationBonusCycles',
                  ] as const
                ).map((k) => (
                  <td key={k}>
                    <input
                      className={inputCls}
                      type="number"
                      value={p[k]}
                      onChange={(e) => {
                        const next = [...plans]
                        next[i] = { ...p, [k]: parseInt(e.target.value, 10) || 0 }
                        setPlans(next)
                      }}
                    />
                  </td>
                ))}
                <td>
                  <button
                    onClick={() => patch('plan', plans[i] as unknown as Record<string, unknown>)}
                    className="text-primary-600 text-xs font-medium hover:underline"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Packs */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-4">Credit packs</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">ID</th>
              <th>Price (cents)</th>
              <th>Base</th>
              <th>Bonus</th>
              <th>Active</th>
              <th>Free-user eligible</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p, i) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2 font-mono text-xs">{p.id}</td>
                {(['priceCents', 'baseCredits', 'bonusCredits'] as const).map((k) => (
                  <td key={k}>
                    <input
                      className={inputCls}
                      type="number"
                      value={p[k]}
                      onChange={(e) => {
                        const next = [...packs]
                        next[i] = { ...p, [k]: parseInt(e.target.value, 10) || 0 }
                        setPacks(next)
                      }}
                    />
                  </td>
                ))}
                {(['active', 'freeUserEligible'] as const).map((k) => (
                  <td key={k}>
                    <input
                      type="checkbox"
                      checked={p[k]}
                      onChange={(e) => {
                        const next = [...packs]
                        next[i] = { ...p, [k]: e.target.checked }
                        setPacks(next)
                      }}
                    />
                  </td>
                ))}
                <td>
                  <button
                    onClick={() => patch('pack', packs[i] as unknown as Record<string, unknown>)}
                    className="text-primary-600 text-xs font-medium hover:underline"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Feature prices */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-4">Credit prices per feature</h2>
        <table className="w-full text-sm max-w-md">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">Feature</th>
              <th>Credits</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p, i) => (
              <tr key={p.featureKey} className="border-b last:border-0">
                <td className="py-2 font-mono text-xs">{p.featureKey}</td>
                <td>
                  <input
                    className={inputCls}
                    type="number"
                    value={p.credits}
                    onChange={(e) => {
                      const next = [...prices]
                      next[i] = { ...p, credits: parseInt(e.target.value, 10) || 0 }
                      setPrices(next)
                    }}
                  />
                </td>
                <td>
                  <button
                    onClick={() => patch('price', prices[i] as unknown as Record<string, unknown>)}
                    className="text-primary-600 text-xs font-medium hover:underline"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-3">
          Changes take effect within ~60s (server config cache). 0 credits = free feature.
        </p>
      </section>
    </div>
  )
}
