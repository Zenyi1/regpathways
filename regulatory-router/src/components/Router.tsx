'use client'

import { useMemo, useState } from 'react'
import { Gantt } from './Gantt'
import { Pricing } from './Pricing'
import type { EnrichedPoint } from '@/lib/api/enrich'

export interface MarketOption {
  id: string
  name: string
  region: string
  regulator: string
  isAnchor: boolean
  inMfnBasket: boolean
  routeCount: number
}

export interface AssetOption {
  id: string
  name: string
  kind: string
  indication: string
  orphan: boolean
  whoEoiEligible: boolean
  priorityReviewGrade: boolean
  reachablePrograms: string[]
}

interface SolveResponse {
  ok: boolean
  error?: string
  recommendedIndex?: number
  recommended?: EnrichedPoint
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

const KINDS = [
  { value: 'nce', label: 'Small molecule (NCE)' },
  { value: 'biologic', label: 'Biologic' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'biosimilar', label: 'Biosimilar' },
  { value: 'generic', label: 'Generic' },
  { value: 'atmp', label: 'Cell or gene therapy' },
  { value: 'blood_product', label: 'Blood product' },
  { value: 'device', label: 'Medical device' },
]

const INDICATIONS = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'hiv', label: 'HIV' },
  { value: 'tuberculosis', label: 'Tuberculosis' },
  { value: 'malaria', label: 'Malaria' },
  { value: 'maternal_newborn', label: 'Maternal & newborn' },
  { value: 'infectious_disease', label: 'Infectious disease' },
  { value: 'rare_disease', label: 'Rare disease' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'other', label: 'Other' },
]

const TARGET_SETS: Record<string, { label: string; markets: string[] }> = {
  commercial: {
    label: 'Major commercial (12)',
    markets: ['US', 'EU', 'JP', 'UK', 'CA', 'AU', 'CH', 'SG', 'BR', 'MX', 'SA', 'KR'],
  },
  global: {
    label: 'Global reach (20)',
    markets: ['US', 'EU', 'JP', 'UK', 'CA', 'AU', 'CH', 'SG', 'BR', 'MX', 'SA', 'KR', 'ZA', 'IN', 'PH', 'TH', 'ID', 'EG', 'KE', 'NG'],
  },
  lmic: {
    label: 'Low & middle income (12)',
    markets: ['ZA', 'KE', 'UG', 'TZ', 'RW', 'NG', 'EG', 'PH', 'VN', 'TH', 'ID', 'IN'],
  },
  us_eu: { label: 'US and EU only', markets: ['US', 'EU'] },
}

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`)

const field =
  'w-full border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand'
const legend = 'text-xs uppercase tracking-widest text-ink-soft'

export function Router({
  markets,
  assets,
}: {
  markets: MarketOption[]
  assets: AssetOption[]
}) {
  const [presetId, setPresetId] = useState('custom')
  const [description, setDescription] = useState('')
  const [modality, setModality] = useState<'drug' | 'device' | 'ivd'>('drug')
  const [kind, setKind] = useState('biologic')
  const [indication, setIndication] = useState('oncology')
  const [orphan, setOrphan] = useState(false)
  const [priority, setPriority] = useState(true)
  const [whoEoi, setWhoEoi] = useState(false)

  const [targetSet, setTargetSet] = useState('commercial')
  const [customTargets, setCustomTargets] = useState<string[]>(TARGET_SETS.commercial.markets)
  const [showMarkets, setShowMarkets] = useState(false)
  const [marketSearch, setMarketSearch] = useState('')

  const [capacity, setCapacity] = useState('')
  const [budget, setBudget] = useState('')

  const [result, setResult] = useState<SolveResponse | null>(null)
  const [pointIndex, setPointIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [interpreting, setInterpreting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detected, setDetected] = useState<string[]>([])
  const [tab, setTab] = useState<'sequence' | 'pricing'>('sequence')

  const targets = targetSet === 'custom' ? customTargets : TARGET_SETS[targetSet].markets

  const byRegion = useMemo(() => {
    const q = marketSearch.trim().toLowerCase()
    const filtered = q
      ? markets.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.regulator.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q),
        )
      : markets
    const map = new Map<string, MarketOption[]>()
    for (const m of filtered) {
      const list = map.get(m.region) ?? []
      list.push(m)
      map.set(m.region, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [markets, marketSearch])

  const asset = {
    name: description || assets.find((a) => a.id === presetId)?.name || 'Custom asset',
    modality,
    kind,
    indication,
    orphan,
    priorityReviewGrade: priority,
    whoEoiEligible: whoEoi,
  }

  function applyPreset(id: string) {
    setPresetId(id)
    const p = assets.find((a) => a.id === id)
    if (!p) return
    setKind(p.kind)
    setIndication(p.indication)
    setOrphan(p.orphan)
    setPriority(p.priorityReviewGrade)
    setWhoEoi(p.whoEoiEligible)
    setModality('drug')
    setDetected([])
  }

  /** free text fills every field; each stays editable afterwards. */
  async function interpret() {
    if (!description.trim()) return
    setInterpreting(true)
    try {
      const res = await fetch(`/api/intake?drug=${encodeURIComponent(description)}`)
      const j = await res.json()
      if (j.ok) {
        setPresetId('custom')
        setModality(j.asset.modality)
        setKind(j.asset.kind)
        setIndication(j.asset.indication)
        setOrphan(j.asset.orphan)
        setPriority(j.asset.priorityReviewGrade)
        setWhoEoi(j.asset.whoEoiEligible)
        setTargetSet(j.targetSet)
        setDetected(j.detected ?? [])
      }
    } finally {
      setInterpreting(false)
    }
  }

  function switchToCustomMarkets() {
    if (targetSet !== 'custom') {
      setCustomTargets(TARGET_SETS[targetSet].markets)
      setTargetSet('custom')
    }
    setShowMarkets(true)
  }

  function toggleMarket(id: string) {
    switchToCustomMarkets()
    setCustomTargets((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleRegion(region: string, list: MarketOption[]) {
    switchToCustomMarkets()
    const ids = list.map((m) => m.id)
    setCustomTargets((prev) =>
      ids.every((i) => prev.includes(i))
        ? prev.filter((x) => !ids.includes(x))
        : [...new Set([...prev, ...ids])],
    )
  }

  async function solve() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          targets,
          capacity: capacity ? Number(capacity) : null,
          budgetUsd: budget ? Number(budget) : null,
        }),
      })
      const data = (await res.json()) as SolveResponse
      if (!res.ok) {
        setError(data.error ?? 'Could not compute a pathway')
        setResult(null)
      } else {
        setResult(data)
        setPointIndex(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const shown = pointIndex === null ? result?.recommended : result?.frontier?.[pointIndex]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
      {/* ================= controls ================= */}
      <aside className="space-y-5 lg:sticky lg:top-6">
        <section>
          <span className={legend}>Start from</span>
          <select
            value={presetId}
            onChange={(e) => applyPreset(e.target.value)}
            className={`${field} mt-2`}
          >
            <option value="custom">Custom asset</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </section>

        <section>
          <span className={legend}>Or describe it</span>
          <div className="flex gap-2 mt-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && interpret()}
              placeholder="monoclonal antibody for NSCLC"
              className={field}
            />
            <button
              type="button"
              onClick={interpret}
              disabled={interpreting || !description.trim()}
              className="px-3 border text-sm whitespace-nowrap hover:bg-surface disabled:opacity-40"
            >
              {interpreting ? '…' : 'Read'}
            </button>
          </div>
          {detected.length > 0 && (
            <p className="mt-2 text-xs text-ink-soft leading-relaxed">
              Understood: <span className="text-ink">{detected.join(' · ')}</span>
            </p>
          )}
        </section>

        <section>
          <span className={legend}>Modality</span>
          <div className="grid grid-cols-3 mt-2 border divide-x">
            {(['drug', 'device', 'ivd'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModality(m)}
                className={`py-2 text-xs transition-colors ${
                  modality === m ? 'bg-brand text-white' : 'hover:bg-surface'
                }`}
              >
                {m === 'ivd' ? 'IVD' : m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {modality !== 'drug' && (
            <p className="mt-2 text-xs text-warn leading-relaxed">
              Device and IVD routes are not curated yet — this build has drug pathways only.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <label className="block">
            <span className={legend}>Asset type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} mt-2`}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={legend}>Indication</span>
            <select
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              className={`${field} mt-2`}
            >
              {INDICATIONS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="space-y-2 text-sm">
          <Check checked={orphan} onChange={setOrphan} label="Orphan designation" />
          <Check checked={priority} onChange={setPriority} label="Priority review grade" />
          <Check
            checked={whoEoi}
            onChange={setWhoEoi}
            label="WHO prequalification category"
            hint="Opens EU-M4all, WHO PQ and the PQ-based CRP"
          />
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <span className={legend}>Target markets ({targets.length})</span>
            <button
              type="button"
              onClick={() => setShowMarkets((v) => !v)}
              className="text-xs text-brand hover:underline"
            >
              {showMarkets ? 'collapse' : 'customize'}
            </button>
          </div>
          <select
            value={targetSet}
            onChange={(e) => {
              const v = e.target.value
              setTargetSet(v)
              if (v !== 'custom') setCustomTargets(TARGET_SETS[v].markets)
            }}
            className={`${field} mt-2`}
          >
            {Object.entries(TARGET_SETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
            <option value="custom">Custom selection ({customTargets.length})</option>
          </select>

          {showMarkets && (
            <div className="mt-2 border">
              <div className="flex gap-1 p-2 border-b">
                <input
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  placeholder="Search markets"
                  className="flex-1 border px-2 py-1 text-xs focus:outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => {
                    setTargetSet('custom')
                    setCustomTargets(markets.map((m) => m.id))
                  }}
                  className="px-2 text-xs border hover:bg-surface"
                >
                  all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetSet('custom')
                    setCustomTargets([])
                  }}
                  className="px-2 text-xs border hover:bg-surface"
                >
                  none
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y">
                {byRegion.map(([region, list]) => (
                  <div key={region}>
                    <button
                      type="button"
                      onClick={() => toggleRegion(region, list)}
                      className="w-full flex items-center justify-between px-2 py-1 bg-surface text-[10px] uppercase tracking-wider text-ink-soft hover:text-ink"
                    >
                      <span>{region}</span>
                      <span>toggle</span>
                    </button>
                    {list.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-surface cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={targets.includes(m.id)}
                          onChange={() => toggleMarket(m.id)}
                          className="accent-[var(--brand)]"
                        />
                        <span className="flex-1 truncate" title={m.regulator}>
                          {m.name}
                        </span>
                        <span className="text-[10px] text-ink-soft tnum">{m.routeCount}</span>
                        {m.isAnchor && (
                          <span className="text-[9px] px-1 border text-ink-soft" title="Reference regulator">
                            REF
                          </span>
                        )}
                        {m.inMfnBasket && (
                          <span
                            className="text-[9px] px-1 bg-brand text-white"
                            title="Inside the MFN reference basket"
                          >
                            MFN
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <label className="text-xs text-ink-soft">
            Parallel filings
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="unlimited"
              inputMode="numeric"
              className={`${field} mt-1 tnum`}
            />
          </label>
          <label className="text-xs text-ink-soft">
            Budget (USD)
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="unlimited"
              inputMode="numeric"
              className={`${field} mt-1 tnum`}
            />
          </label>
        </section>

        <button
          onClick={solve}
          disabled={loading || targets.length === 0}
          type="button"
          className="w-full bg-brand text-white py-2.5 text-sm font-medium hover:bg-brand-strong disabled:opacity-40 transition-colors"
        >
          {loading ? 'Computing…' : 'Find best pathway'}
        </button>
        {targets.length === 0 && <p className="text-xs text-warn">Choose at least one market.</p>}
        {error && <p className="text-xs text-warn">{error}</p>}
      </aside>

      {/* ================= results ================= */}
      <main className="min-w-0 space-y-8">
        {!result && (
          <div className="border border-dashed p-12 text-center text-sm text-ink-soft">
            Pick a preset, describe the drug, or set the fields by hand — then find the pathway.
          </div>
        )}

        {result && !result.ok && (
          <div className="border p-5">
            <h3 className="font-semibold mb-2">No pathway covers every market</h3>
            <ul className="text-sm text-ink-soft space-y-1">
              {result.unreachable?.map((u) => (
                <li key={u.marketId}>
                  <span className="text-ink font-medium">{u.marketId}</span> — {u.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result?.ok && result.summary && shown && (
          <>
            <div className="flex gap-6 border-b">
              {(['sequence', 'pricing'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`pb-2 -mb-px text-sm border-b-2 transition-colors ${
                    tab === t
                      ? 'border-brand text-brand font-medium'
                      : 'border-transparent text-ink-soft hover:text-ink'
                  }`}
                >
                  {t === 'sequence' ? 'Filing pathway' : 'Pricing & MFN'}
                </button>
              ))}
            </div>

            {tab === 'pricing' && <Pricing asset={asset} targets={targets} />}

            {tab === 'sequence' && (
              <div className="space-y-8">
                <section className="border p-5 bg-surface">
                  <div className={legend}>
                    {pointIndex === null ? 'Recommended pathway' : 'Selected pathway'}
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-10 gap-y-2">
                    <div>
                      <span className="text-3xl tnum">{shown.makespanMonths}</span>
                      <span className="text-sm text-ink-soft"> months to full coverage</span>
                    </div>
                    <div>
                      <span className="text-3xl tnum">{money(shown.costUsd)}</span>
                      <span className="text-sm text-ink-soft"> filing cost</span>
                    </div>
                    {result.summary.savingsVsNaive && (
                      <div className="text-brand">
                        <span className="text-3xl tnum">{result.summary.savingsVsNaive.costPct}%</span>
                        <span className="text-sm"> cheaper than filing separately</span>
                      </div>
                    )}
                  </div>
                  {result.summary.naiveBaseline && (
                    <p className="mt-3 text-sm text-ink-soft">
                      Filing every market standalone would take{' '}
                      {result.summary.naiveBaseline.makespanMonths} months and cost{' '}
                      {money(result.summary.naiveBaseline.costUsd)}. Reliance pathways account for
                      the difference. Solved in {result.elapsedMs}ms across{' '}
                      {result.summary.frontierPoints} non-dominated plans.
                    </p>
                  )}
                </section>

                {result.frontier && result.frontier.length > 1 && (
                  <section>
                    <h3 className={`${legend} mb-3`}>Trade time against cost</h3>
                    <div className="flex flex-wrap gap-2">
                      <Option
                        active={pointIndex === null}
                        onClick={() => setPointIndex(null)}
                        title="Recommended"
                        sub={`${result.recommended?.makespanMonths} mo · ${money(result.recommended?.costUsd ?? 0)}`}
                      />
                      {result.frontier.map((p, i) =>
                        i === result.recommendedIndex ? null : (
                          <Option
                            key={i}
                            active={pointIndex === i}
                            onClick={() => setPointIndex(i)}
                            title={
                              i === 0
                                ? 'Fastest'
                                : i === result.frontier!.length - 1
                                  ? 'Cheapest'
                                  : `Option ${i + 1}`
                            }
                            sub={`${p.makespanMonths} mo · ${money(p.costUsd)}`}
                          />
                        ),
                      )}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className={`${legend} mb-3`}>Schedule</h3>
                  <Gantt steps={shown.steps} />
                  <p className="mt-2 text-xs text-ink-soft">
                    Solid bars are enabling filings whose approval unlocks others. Arrows name the
                    reference authorities each filing relies on.
                  </p>
                </section>

                <section>
                  <h3 className={`${legend} mb-3`}>Filing plan</h3>
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
                        {shown.steps.map((s) => (
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
                    clock. Confidence links go to the regulator source.
                  </p>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--brand)] mt-0.5"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
    </label>
  )
}

function Option({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean
  onClick: () => void
  title: string
  sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs border text-left transition-colors ${
        active ? 'bg-brand text-white border-brand' : 'hover:bg-surface'
      }`}
    >
      <span className="block font-medium">{title}</span>
      <span className={`block tnum ${active ? 'text-white/75' : 'text-ink-soft'}`}>{sub}</span>
    </button>
  )
}
