'use client'

import { useState } from 'react'
import { Gantt } from './Gantt'
import { Pricing } from './Pricing'
import type { EnrichedPoint } from '@/lib/api/enrich'

export interface MarketOption {
  id: string
  name: string
  region: string
  isAnchor: boolean
  inMfnBasket: boolean
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
    naiveBaseline: { makespanMonths: number; costUsd: number } | null
    savingsVsNaive: { costUsd: number; costPct: number; months: number } | null
  }
  frontier?: EnrichedPoint[]
  unreachable?: { marketId: string; reason: string }[]
}

const KINDS = [
  { value: 'nce', label: 'Small molecule (NCE)' },
  { value: 'biologic', label: 'Biologic' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'biosimilar', label: 'Biosimilar' },
  { value: 'generic', label: 'Generic' },
  { value: 'atmp', label: 'Cell or gene therapy' },
  { value: 'blood_product', label: 'Blood product' },
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
    label: 'Major commercial markets (12)',
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
  'w-full border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand'

export function Router({ markets }: { markets: MarketOption[] }) {
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('biologic')
  const [indication, setIndication] = useState('oncology')
  const [orphan, setOrphan] = useState(false)
  const [priority, setPriority] = useState(true)
  const [targetSet, setTargetSet] = useState('commercial')
  const [customTargets, setCustomTargets] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
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

  /** free text fills the dropdowns; the dropdowns remain the source of truth. */
  async function interpret() {
    if (!description.trim()) return
    setInterpreting(true)
    try {
      const res = await fetch(`/api/intake?drug=${encodeURIComponent(description)}`)
      const j = await res.json()
      if (j.ok) {
        setKind(j.asset.kind)
        setIndication(j.asset.indication)
        setOrphan(j.asset.orphan)
        setPriority(j.asset.priorityReviewGrade)
        setTargetSet(j.targetSet)
        setDetected(j.detected ?? [])
      }
    } finally {
      setInterpreting(false)
    }
  }

  async function solve() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: {
            name: description || 'Unnamed asset',
            modality: 'drug',
            kind,
            indication,
            orphan,
            priorityReviewGrade: priority,
            whoEoiEligible: ['hiv', 'tuberculosis', 'malaria', 'maternal_newborn'].includes(indication),
          },
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

  const shown =
    pointIndex === null ? result?.recommended : result?.frontier?.[pointIndex]

  return (
    <div className="space-y-8">
      {/* ---------------- input ---------------- */}
      <section className="border p-5 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-ink-soft">
            Describe the drug
          </span>
          <div className="flex gap-2 mt-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={interpret}
              onKeyDown={(e) => e.key === 'Enter' && interpret()}
              placeholder="e.g. a monoclonal antibody for metastatic NSCLC"
              className={field}
            />
            <button
              type="button"
              onClick={interpret}
              disabled={interpreting || !description.trim()}
              className="px-4 border text-sm whitespace-nowrap hover:bg-surface disabled:opacity-40"
            >
              {interpreting ? 'Reading…' : 'Read it'}
            </button>
          </div>
          {detected.length > 0 && (
            <p className="mt-2 text-xs text-ink-soft">
              Understood: <span className="text-ink">{detected.join(' · ')}</span>. Adjust
              anything below.
            </p>
          )}
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-ink-soft">Asset type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} mt-2`}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-ink-soft">Indication</span>
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

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-ink-soft">Target markets</span>
            <select
              value={targetSet}
              onChange={(e) => setTargetSet(e.target.value)}
              className={`${field} mt-2`}
            >
              {Object.entries(TARGET_SETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
              <option value="custom">Choose markets…</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={orphan}
              onChange={(e) => setOrphan(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            Orphan designation
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={priority}
              onChange={(e) => setPriority(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            Priority review grade
          </label>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-brand hover:underline ml-auto"
          >
            {showAdvanced ? 'Hide constraints' : 'Add constraints'}
          </button>
        </div>

        {targetSet === 'custom' && (
          <div className="border max-h-56 overflow-y-auto divide-y">
            {markets.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={customTargets.includes(m.id)}
                  onChange={() =>
                    setCustomTargets((prev) =>
                      prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                    )
                  }
                  className="accent-[var(--brand)]"
                />
                <span className="flex-1">{m.name}</span>
                <span className="text-xs text-ink-soft">{m.region}</span>
                {m.inMfnBasket && <span className="text-[9px] px-1 bg-brand text-white">MFN</span>}
              </label>
            ))}
          </div>
        )}

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <label className="text-xs text-ink-soft">
              Max parallel filings
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
          </div>
        )}

        <button
          onClick={solve}
          disabled={loading || targets.length === 0}
          type="button"
          className="bg-brand text-white px-6 py-2.5 text-sm font-medium hover:bg-brand-strong disabled:opacity-40 transition-colors"
        >
          {loading ? 'Computing…' : 'Find best pathway'}
        </button>
        {targets.length === 0 && (
          <p className="text-xs text-warn">Choose at least one market.</p>
        )}
        {error && <p className="text-xs text-warn">{error}</p>}
      </section>

      {/* ---------------- results ---------------- */}
      {result && !result.ok && (
        <section className="border p-5">
          <h3 className="font-semibold mb-2">No pathway covers every market</h3>
          <ul className="text-sm text-ink-soft space-y-1">
            {result.unreachable?.map((u) => (
              <li key={u.marketId}>
                <span className="text-ink font-medium">{u.marketId}</span> — {u.reason}
              </li>
            ))}
          </ul>
        </section>
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

          {tab === 'pricing' && (
            <Pricing
              asset={{
                name: description || 'Unnamed asset',
                modality: 'drug',
                kind,
                indication,
                orphan,
                priorityReviewGrade: priority,
                whoEoiEligible: ['hiv', 'tuberculosis', 'malaria', 'maternal_newborn'].includes(indication),
              }}
              targets={targets}
            />
          )}

          {tab === 'sequence' && (
            <div className="space-y-8">
              <section className="border p-5 bg-surface">
                <div className="text-xs uppercase tracking-widest text-ink-soft">
                  Recommended pathway
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-8 gap-y-2">
                  <div>
                    <span className="text-3xl tnum">{shown.makespanMonths}</span>
                    <span className="text-sm text-ink-soft"> months to full coverage</span>
                  </div>
                  <div>
                    <span className="text-3xl tnum">{money(shown.costUsd)}</span>
                    <span className="text-sm text-ink-soft"> in filing cost</span>
                  </div>
                  {result.summary.savingsVsNaive && (
                    <div className="text-brand">
                      <span className="text-3xl tnum">
                        {result.summary.savingsVsNaive.costPct}%
                      </span>
                      <span className="text-sm"> cheaper than filing everywhere separately</span>
                    </div>
                  )}
                </div>
                {result.summary.naiveBaseline && (
                  <p className="mt-3 text-sm text-ink-soft">
                    Filing every market standalone would take{' '}
                    {result.summary.naiveBaseline.makespanMonths} months and cost{' '}
                    {money(result.summary.naiveBaseline.costUsd)}. Reliance pathways account for
                    the difference.
                  </p>
                )}
              </section>

              {result.frontier && result.frontier.length > 1 && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">
                    Other options on the frontier
                  </h3>
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
                          title={i === 0 ? 'Fastest' : i === result.frontier!.length - 1 ? 'Cheapest' : `Option ${i + 1}`}
                          sub={`${p.makespanMonths} mo · ${money(p.costUsd)}`}
                        />
                      ),
                    )}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">Schedule</h3>
                <Gantt steps={shown.steps} />
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
                      {shown.steps.map((s) => (
                        <tr key={s.marketId + s.routeId} className="hover:bg-surface">
                          <td className="px-3 py-2">
                            <span className="font-medium">{s.market}</span>
                            <span className="block text-xs text-ink-soft">{s.regulator}</span>
                          </td>
                          <td className="px-3 py-2">
                            {s.route}
                            {s.program && <span className="block text-xs text-brand">{s.program}</span>}
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
    </div>
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
