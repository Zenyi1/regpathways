'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Gantt } from './Gantt'
import { Pricing } from './Pricing'
import { Computing, SOLVE_STAGES } from './Computing'
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

type Field =
  | 'modality'
  | 'kind'
  | 'indication'
  | 'orphan'
  | 'whoEoiEligible'
  | 'priorityReviewGrade'
  | 'targetSet'
  | 'riskClass'
  | 'predicateDevice'

type Basis = Record<Field, string | null>

interface IntakeResponse {
  ok: boolean
  asset: {
    modality: 'drug' | 'device' | 'ivd'
    kind: string
    indication: string
    orphan: boolean
    whoEoiEligible: boolean
    priorityReviewGrade: boolean
    riskClass?: string
    predicateDevice?: boolean
  }
  matchedDrug: string | null
  targetSet: string
  basis: Basis
  assumptions: string[]
}

const EMPTY_BASIS: Basis = {
  modality: null,
  kind: null,
  indication: null,
  orphan: null,
  whoEoiEligible: null,
  priorityReviewGrade: null,
  targetSet: null,
  riskClass: null,
  predicateDevice: null,
}

const DRUG_KINDS = [
  { value: 'nce', label: 'Small molecule (NCE)' },
  { value: 'biologic', label: 'Biologic' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'biosimilar', label: 'Biosimilar' },
  { value: 'generic', label: 'Generic' },
  { value: 'atmp', label: 'Cell or gene therapy' },
  { value: 'blood_product', label: 'Blood product' },
]

const DEVICE_KINDS = [
  { value: 'device', label: 'Medical device' },
  { value: 'implantable', label: 'Implantable device' },
]

const IVD_KINDS = [{ value: 'ivd', label: 'In vitro diagnostic' }]

const RISK_CLASSES = [
  { value: 'low', label: 'Low (FDA I / MDR I / IVDR A)' },
  { value: 'moderate', label: 'Moderate (FDA II / MDR IIa / IVDR B)' },
  { value: 'high', label: 'High (FDA II / MDR IIb / IVDR C)' },
  { value: 'critical', label: 'Critical (FDA III / MDR III / IVDR D)' },
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
  deviceCommercial: {
    label: 'Device anchors (4)',
    markets: ['US', 'EU', 'UK', 'CH'],
  },
  deviceAccess: {
    label: 'Device + WHO PQ (4)',
    markets: ['US', 'EU', 'UK', 'WHOPQ'],
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
  const [description, setDescription] = useState('')
  const [modality, setModality] = useState<'drug' | 'device' | 'ivd'>('drug')
  const [kind, setKind] = useState('nce')
  const [indication, setIndication] = useState('oncology')
  const [orphan, setOrphan] = useState(false)
  const [priority, setPriority] = useState(true)
  const [whoEoi, setWhoEoi] = useState(false)
  const [riskClass, setRiskClass] = useState('moderate')
  const [predicateDevice, setPredicateDevice] = useState(true)

  const [basis, setBasis] = useState<Basis>(EMPTY_BASIS)
  const [assumptions, setAssumptions] = useState<string[]>([])
  const [matchedDrug, setMatchedDrug] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  const [targetSet, setTargetSet] = useState('commercial')
  const [customTargets, setCustomTargets] = useState<string[]>(TARGET_SETS.commercial.markets)
  const [showMarkets, setShowMarkets] = useState(false)
  const [marketSearch, setMarketSearch] = useState('')

  const [capacity, setCapacity] = useState('')
  const [budget, setBudget] = useState('')

  const [result, setResult] = useState<SolveResponse | null>(null)
  const [pointIndex, setPointIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'sequence' | 'pricing'>('sequence')
  const [stage, setStage] = useState(0)

  const targets = targetSet === 'custom' ? customTargets : (TARGET_SETS[targetSet]?.markets ?? TARGET_SETS.commercial.markets)

  const kindOptions =
    modality === 'ivd' ? IVD_KINDS : modality === 'device' ? DEVICE_KINDS : DRUG_KINDS

  /**
   * the description is the source of truth: it re-reads as you type, and every field it
   * fills stays editable afterwards. editing a field marks it as yours until the text
   * changes again.
   */
  const lastRead = useRef('')
  useEffect(() => {
    const text = description.trim()
    if (text === lastRead.current) return
    if (!text) {
      lastRead.current = ''
      // deferred off the effect body so clearing does not cascade a synchronous re-render
      const clear = setTimeout(() => {
        setBasis(EMPTY_BASIS)
        setAssumptions([])
        setMatchedDrug(null)
      }, 0)
      return () => clearTimeout(clear)
    }
    const timer = setTimeout(async () => {
      setReading(true)
      try {
        const res = await fetch(`/api/intake?text=${encodeURIComponent(text)}`)
        const j = (await res.json()) as IntakeResponse
        if (!j.ok) return
        lastRead.current = text
        setModality(j.asset.modality)
        setKind(j.asset.kind)
        setIndication(j.asset.indication)
        setOrphan(j.asset.orphan)
        setPriority(j.asset.priorityReviewGrade)
        setWhoEoi(j.asset.whoEoiEligible)
        if (j.asset.riskClass) setRiskClass(j.asset.riskClass)
        if (j.asset.predicateDevice !== undefined) setPredicateDevice(j.asset.predicateDevice)
        if (j.targetSet in TARGET_SETS) setTargetSet(j.targetSet)
        setBasis(j.basis)
        setAssumptions(j.assumptions)
        setMatchedDrug(j.matchedDrug)
      } finally {
        setReading(false)
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [description])

  function override<T>(name: Field, set: (v: T) => void) {
    return (v: T) => {
      set(v)
      setBasis((b) => ({ ...b, [name]: 'your choice' }))
    }
  }

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
    name: description.trim() || 'Unnamed asset',
    modality,
    kind,
    indication,
    orphan,
    priorityReviewGrade: priority,
    whoEoiEligible: whoEoi,
    ...(modality !== 'drug'
      ? { riskClass, predicateDevice }
      : {}),
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

  /**
   * The solve returns in well under a second. We hold the result for a floor duration and
   * walk the stage list so the work the solver does is legible, rather than the answer
   * appearing to have been sitting there all along.
   */
  const MIN_SOLVE_MS = 2200

  async function solve() {
    setLoading(true)
    setError(null)
    setResult(null)
    setStage(0)

    const started = Date.now()
    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, SOLVE_STAGES.length - 1)),
      MIN_SOLVE_MS / (SOLVE_STAGES.length + 0.5),
    )

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

      const elapsed = Date.now() - started
      if (elapsed < MIN_SOLVE_MS) {
        await new Promise((r) => setTimeout(r, MIN_SOLVE_MS - elapsed))
      }

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
      clearInterval(ticker)
      setLoading(false)
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const shown = pointIndex === null ? result?.recommended : result?.frontier?.[pointIndex]

  return (
    <div className="space-y-8">
      {/* ================= asset intake ================= */}
      <section className="border">
        <div className="p-5 border-b">
          <label htmlFor="describe" className={legend}>
            Describe the asset
          </label>
          <input
            id="describe"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="pembrolizumab for NSCLC, a class II infusion pump for the US and EU, or an HIV rapid test for Africa"
            className={`${field} mt-2 text-base py-3`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-soft">Try</span>
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setDescription(a.name)}
                className="px-2 py-1 border text-ink-soft hover:bg-surface hover:text-ink transition-colors"
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-baseline gap-3">
            <span className={legend}>Read as</span>
            {reading && <span className="text-xs text-ink-soft">reading…</span>}
            {matchedDrug && !reading && (
              <span className="text-xs text-brand">recognised {matchedDrug}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Labelled label="Modality" note={basis.modality}>
              <div className="grid grid-cols-3 border divide-x">
                {(['drug', 'device', 'ivd'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => override<typeof m>('modality', setModality)(m)}
                    className={`py-2 text-xs transition-colors ${
                      modality === m ? 'bg-brand text-white' : 'hover:bg-surface'
                    }`}
                  >
                    {m === 'ivd' ? 'IVD' : m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </Labelled>

            <Labelled label="Asset type" note={basis.kind}>
              <select
                value={kindOptions.some((k) => k.value === kind) ? kind : kindOptions[0].value}
                onChange={(e) => override<string>('kind', setKind)(e.target.value)}
                className={field}
              >
                {kindOptions.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Indication" note={basis.indication}>
              <select
                value={indication}
                onChange={(e) => override<string>('indication', setIndication)(e.target.value)}
                className={field}
              >
                {INDICATIONS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </Labelled>
          </div>

          {modality !== 'drug' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Labelled label="Risk class" note={basis.riskClass}>
                <select
                  value={riskClass}
                  onChange={(e) => override<string>('riskClass', setRiskClass)(e.target.value)}
                  className={field}
                >
                  {RISK_CLASSES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Check
                checked={predicateDevice}
                onChange={override<boolean>('predicateDevice', setPredicateDevice)}
                label="Legally marketed predicate exists (510(k) route)"
                note={basis.predicateDevice}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
            <Check
              checked={orphan}
              onChange={override<boolean>('orphan', setOrphan)}
              label="Orphan designation"
              note={basis.orphan}
            />
            <Check
              checked={priority}
              onChange={override<boolean>('priorityReviewGrade', setPriority)}
              label="Priority-review grade"
              note={basis.priorityReviewGrade}
            />
            <Check
              checked={whoEoi}
              onChange={override<boolean>('whoEoiEligible', setWhoEoi)}
              label="WHO prequalification category"
              note={basis.whoEoiEligible}
            />
          </div>

          {assumptions.length > 0 && (
            <ul className="text-xs text-ink-soft space-y-1 border-t pt-3">
              {assumptions.map((a) => (
                <li key={a}>
                  <span className="text-warn">Assumed</span> — {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
        {/* ================= scope ================= */}
        <aside className="space-y-5 lg:sticky lg:top-6">
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
                setBasis((b) => ({ ...b, targetSet: 'your choice' }))
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
            {basis.targetSet && (
              <p className="mt-1 text-[11px] leading-snug text-ink-soft">{basis.targetSet}</p>
            )}

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
                            <span
                              className="text-[9px] px-1 border text-ink-soft"
                              title="Reference regulator"
                            >
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
        <main id="results" className="min-w-0 space-y-8">
          {loading && <Computing stage={stage} />}

          {!result && !loading && (
            <div className="border border-dashed p-12 text-center text-sm text-ink-soft">
              Describe the asset above, correct anything read wrongly, then find the pathway.
            </div>
          )}

          {result && !result.ok && !loading && (
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

          {result?.ok && result.summary && shown && !loading && (
            <>
              <div className="fo-fade-up flex gap-6 border-b">
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
                          <span className="text-3xl tnum">
                            {result.summary.savingsVsNaive.costPct}%
                          </span>
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
    </div>
  )
}

function Labelled({
  label,
  note,
  children,
}: {
  label: string
  note: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <span className={legend}>{label}</span>
      <div className="mt-2">{children}</div>
      <p className={`mt-1 text-[11px] leading-snug ${note ? 'text-ink-soft' : 'text-warn'}`}>
        {note ?? 'assumed — check this'}
      </p>
    </div>
  )
}

function Check({
  checked,
  onChange,
  label,
  note,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  note: string | null
}) {
  return (
    <div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[var(--brand)] mt-0.5"
        />
        <span>{label}</span>
      </label>
      {checked && (
        <p className={`mt-1 text-[11px] leading-snug ${note ? 'text-ink-soft' : 'text-warn'}`}>
          {note ?? 'assumed — check this'}
        </p>
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
