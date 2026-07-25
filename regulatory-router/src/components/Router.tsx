'use client'

import { useMemo, useState } from 'react'
import { Gantt } from './Gantt'
import type { EnrichedPoint } from '@/lib/api/enrich'

export interface MarketOption {
  id: string
  name: string
  region: string
  isAnchor: boolean
  inMfnBasket: boolean
  priceIndex: number | null
  gdpPerCapitaPctUs: number | null
}

export interface AssetOption {
  id: string
  name: string
  indication: string
  kind: string
  reachablePrograms: string[]
}

interface SolveResponse {
  ok: boolean
  summary?: {
    frontierPoints: number
    fastest: { makespanMonths: number; costUsd: number }
    cheapest: { makespanMonths: number; costUsd: number }
    lowerBoundMonths: number
    naiveBaseline: { makespanMonths: number; costUsd: number } | null
    savingsVsNaive: { costUsd: number; costPct: number; months: number } | null
    confidenceMix: { high: number; medium: number; low: number }
  }
  frontier?: EnrichedPoint[]
  unreachable?: { marketId: string; reason: string }[]
  elapsedMs?: number
}

const DEFAULT_TARGETS = ['US', 'EU', 'JP', 'UK', 'CA', 'AU', 'SG', 'BR', 'SA', 'ZA', 'MX']

const money = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`

export function Router({
  markets,
  assets,
}: {
  markets: MarketOption[]
  assets: AssetOption[]
}) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? '')
  const [targets, setTargets] = useState<string[]>(DEFAULT_TARGETS)
  const [capacity, setCapacity] = useState<string>('')
  const [budget, setBudget] = useState<string>('')
  const [result, setResult] = useState<SolveResponse | null>(null)
  const [pointIndex, setPointIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byRegion = useMemo(() => {
    const map = new Map<string, MarketOption[]>()
    for (const m of markets) {
      const list = map.get(m.region) ?? []
      list.push(m)
      map.set(m.region, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [markets])

  const asset = assets.find((a) => a.id === assetId)

  async function solve() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          targets,
          capacity: capacity ? Number(capacity) : null,
          budgetUsd: budget ? Number(budget) : null,
        }),
      })
      const data = (await res.json()) as SolveResponse & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'solve failed')
        setResult(null)
      } else {
        setResult(data)
        setPointIndex(0)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: string) {
    setTargets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  const point = result?.frontier?.[pointIndex]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
      {/* ---------------- controls ---------------- */}
      <aside className="space-y-6">
        <section>
          <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-2">Asset</h3>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="w-full border px-3 py-2 text-sm bg-white"
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {asset && (
            <p className="mt-2 text-xs text-ink-soft leading-relaxed">
              Reaches:{' '}
              {asset.reachablePrograms.length ? (
                <span className="text-ink">{asset.reachablePrograms.join(', ')}</span>
              ) : (
                <span>no multilateral programmes</span>
              )}
            </p>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-xs uppercase tracking-widest text-ink-soft">
              Target markets ({targets.length})
            </h3>
            <button
              onClick={() => setTargets([])}
              className="text-xs text-brand hover:underline"
              type="button"
            >
              clear
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto border divide-y">
            {byRegion.map(([region, list]) => (
              <div key={region}>
                <div className="px-2 py-1 bg-surface text-[10px] uppercase tracking-wider text-ink-soft">
                  {region}
                </div>
                {list.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-surface cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={targets.includes(m.id)}
                      onChange={() => toggle(m.id)}
                      className="accent-[var(--brand)]"
                    />
                    <span className="flex-1">{m.name}</span>
                    {m.isAnchor && (
                      <span className="text-[9px] px-1 border text-ink-soft">REF</span>
                    )}
                    {m.inMfnBasket && (
                      <span
                        className="text-[9px] px-1 bg-brand text-white"
                        title="Inside the MFN reference basket: launching cheap here drags down the US price"
                      >
                        MFN
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <label className="text-xs text-ink-soft">
            Parallel filings
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="∞"
              inputMode="numeric"
              className="mt-1 w-full border px-2 py-1.5 text-sm text-ink tnum"
            />
          </label>
          <label className="text-xs text-ink-soft">
            Budget (USD)
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="∞"
              inputMode="numeric"
              className="mt-1 w-full border px-2 py-1.5 text-sm text-ink tnum"
            />
          </label>
        </section>

        <button
          onClick={solve}
          disabled={loading || targets.length === 0}
          type="button"
          className="w-full bg-brand text-white py-2.5 text-sm font-medium hover:bg-brand-strong disabled:opacity-40 transition-colors"
        >
          {loading ? 'Solving…' : 'Compute filing sequence'}
        </button>

        {error && <p className="text-xs text-warn">{error}</p>}
      </aside>

      {/* ---------------- results ---------------- */}
      <main className="min-w-0">
        {!result && (
          <div className="border border-dashed p-12 text-center text-sm text-ink-soft">
            Pick an asset and target markets, then compute. The solver enumerates reference-
            regulator subsets and returns the full time/cost frontier.
          </div>
        )}

        {result && !result.ok && (
          <div className="border p-6">
            <h3 className="font-semibold mb-2">No feasible sequence</h3>
            <ul className="text-sm text-ink-soft space-y-1">
              {result.unreachable?.map((u) => (
                <li key={u.marketId}>
                  <span className="text-ink font-medium">{u.marketId}</span> — {u.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result?.ok && result.summary && (
          <div className="space-y-8">
            <section className="grid grid-cols-2 md:grid-cols-4 border divide-x divide-y md:divide-y-0">
              <Stat
                label="Fastest"
                value={`${result.summary.fastest.makespanMonths} mo`}
                sub={money(result.summary.fastest.costUsd)}
              />
              <Stat
                label="Cheapest"
                value={money(result.summary.cheapest.costUsd)}
                sub={`${result.summary.cheapest.makespanMonths} mo`}
              />
              <Stat
                label="No reliance"
                value={
                  result.summary.naiveBaseline
                    ? `${result.summary.naiveBaseline.makespanMonths} mo`
                    : '—'
                }
                sub={
                  result.summary.naiveBaseline
                    ? money(result.summary.naiveBaseline.costUsd)
                    : 'infeasible standalone'
                }
              />
              <Stat
                label="Saved"
                value={
                  result.summary.savingsVsNaive
                    ? `${result.summary.savingsVsNaive.costPct}%`
                    : '—'
                }
                sub={
                  result.summary.savingsVsNaive
                    ? `${money(result.summary.savingsVsNaive.costUsd)} · ${result.summary.savingsVsNaive.months} mo`
                    : ''
                }
                accent
              />
            </section>

            {result.frontier && result.frontier.length > 1 && (
              <section>
                <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">
                  Pareto frontier — {result.summary.frontierPoints} non-dominated plans
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.frontier.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPointIndex(i)}
                      className={`px-3 py-2 text-xs border tnum transition-colors ${
                        i === pointIndex
                          ? 'bg-brand text-white border-brand'
                          : 'hover:bg-surface'
                      }`}
                    >
                      {p.makespanMonths} mo · {money(p.costUsd)}
                      <span
                        className={`block text-[10px] ${i === pointIndex ? 'text-white/70' : 'text-ink-soft'}`}
                      >
                        {p.anchors.length ? p.anchors.join(', ') : 'no anchors'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {point && (
              <>
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">
                    Schedule
                  </h3>
                  <Gantt steps={point.steps} />
                  <p className="mt-2 text-xs text-ink-soft">
                    Solid bars are enabling filings whose approval unlocks others. Arrows name
                    the reference authorities each filing relies on.
                  </p>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">
                    Filing plan
                  </h3>
                  <div className="overflow-x-auto border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface text-left text-xs uppercase tracking-wider text-ink-soft">
                          <th className="px-3 py-2 font-medium">Market</th>
                          <th className="px-3 py-2 font-medium">Route</th>
                          <th className="px-3 py-2 font-medium">Relies on</th>
                          <th className="px-3 py-2 font-medium text-right">Start</th>
                          <th className="px-3 py-2 font-medium text-right">Approved</th>
                          <th className="px-3 py-2 font-medium text-right">Cost</th>
                          <th className="px-3 py-2 font-medium">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {point.steps.map((s) => (
                          <tr key={s.marketId + s.routeId} className="hover:bg-surface">
                            <td className="px-3 py-2">
                              <span className="font-medium">{s.market}</span>
                              <span className="block text-xs text-ink-soft">{s.regulator}</span>
                            </td>
                            <td className="px-3 py-2">
                              {s.route}
                              {s.program && (
                                <span className="block text-xs text-brand">{s.program}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-ink-soft">
                              {s.reliesOn.join(' + ') || '—'}
                            </td>
                            <td className="px-3 py-2 text-right tnum">{s.startMonth}</td>
                            <td className="px-3 py-2 text-right tnum">{s.finishMonth}</td>
                            <td className="px-3 py-2 text-right tnum">{money(s.costUsd)}</td>
                            <td className="px-3 py-2">
                              <a
                                href={s.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs hover:underline ${
                                  s.confidence === 'low' ? 'text-warn' : 'text-brand'
                                }`}
                                title={`Confidence: ${s.confidence}`}
                              >
                                {s.confidence}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">
                    Months are time to approval, not time to patient — reimbursement is a separate
                    clock. Confidence links go to the underlying regulator source.
                  </p>
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-ink-soft">{label}</div>
      <div className={`text-2xl mt-1 tnum ${accent ? 'text-brand' : 'text-ink'}`}>{value}</div>
      {sub && <div className="text-xs text-ink-soft tnum">{sub}</div>}
    </div>
  )
}
