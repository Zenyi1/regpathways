'use client'

import { useState } from 'react'
import { NpvCurve, type CurvePoint } from './NpvCurve'

interface Strategy {
  launchedCount: number
  npvUsdM: number
  usNetPrice: number
  mfnBindingMarket: string | null
  withheldFrom?: string[]
}

export interface PricingResponse {
  ok: boolean
  error?: string
  mfnPolicy: { enabled: boolean; mode: string; gdpThresholdPct: number; exposure: number; basket: string[] }
  strategies: { profitMax: Strategy; launchEverywhere: Strategy }
  mfnCliff: { atMarket: number; dropUsdM: number; dropPct: number; trigger: string | null } | null
  accessAtTolerance: { giveUpToPct: number; markets: number; npvUsdM: number; patientYearsM: number }[]
  accessTradeoff: { npvGivenUpUsdM: number; npvGivenUpPct: number; extraPatientYearsM: number }
  npvCurve: CurvePoint[]
  pricingDetail: {
    id: string
    name: string
    freePrice: number
    listPrice: number
    netPrice: number
    erosion: number
    inMfnBasket: boolean
    referencedFrom: string[]
    launchMonth: number | null
  }[]
}

export interface PricingAsset {
  name: string
  modality: string
  kind: string
  indication: string
  orphan: boolean
  priorityReviewGrade: boolean
  whoEoiEligible: boolean
}

export function Pricing({
  asset,
  targets,
}: {
  asset: PricingAsset
  targets: string[]
}) {
  const [data, setData] = useState<PricingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [enabled, setEnabled] = useState(true)
  const [threshold, setThreshold] = useState(60)
  const [exposure, setExposure] = useState(25)
  const [rebates, setRebates] = useState(true)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          targets,
          useConfidentialRebates: rebates,
          mfn: { enabled, mode: 'threshold', gdpThresholdPct: threshold, exposure: exposure / 100 },
        }),
      })
      const j = (await res.json()) as PricingResponse
      if (!res.ok) {
        setError(j.error ?? 'pricing failed')
        setData(null)
      } else setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="border p-4">
        <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-4">
          Most Favoured Nation policy — scenario inputs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            MFN in force
          </label>

          <label className="text-xs text-ink-soft">
            Reference threshold — {threshold}% of US GDP per capita
            <input
              type="range"
              min={30}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              disabled={!enabled}
              className="w-full mt-2 accent-[var(--brand)]"
            />
          </label>

          <label className="text-xs text-ink-soft">
            US revenue exposed — {exposure}%
            <input
              type="range"
              min={0}
              max={100}
              value={exposure}
              onChange={(e) => setExposure(Number(e.target.value))}
              disabled={!enabled}
              className="w-full mt-2 accent-[var(--brand)]"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rebates}
              onChange={(e) => setRebates(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            Confidential rebates
          </label>
        </div>

        <button
          onClick={run}
          disabled={loading || targets.length === 0}
          type="button"
          className="mt-4 bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-strong disabled:opacity-40"
        >
          {loading ? 'Pricing…' : 'Run pricing model'}
        </button>
        {error && <p className="mt-2 text-xs text-warn">{error}</p>}
        <p className="mt-3 text-xs text-ink-soft max-w-3xl leading-relaxed">
          The 60% threshold is the operative HHS definition: the lowest price in an OECD country
          with GDP per capita at least 60% of the US. Exposure defaults to 25% because GLOBE is
          proposed as a phased model covering roughly a quarter of Part B beneficiaries. None of
          this is settled law — every field here is an assumption you can move.
        </p>
      </section>

      {data && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 border divide-x divide-y md:divide-y-0">
            <Stat
              label="Profit-max"
              value={`$${data.strategies.profitMax.npvUsdM.toLocaleString()}M`}
              sub={`${data.strategies.profitMax.launchedCount} markets`}
            />
            <Stat
              label="Launch everywhere"
              value={`$${data.strategies.launchEverywhere.npvUsdM.toLocaleString()}M`}
              sub={`${data.strategies.launchEverywhere.launchedCount} markets`}
            />
            <Stat
              label="Cost of full access"
              value={`${data.accessTradeoff.npvGivenUpPct}%`}
              sub={`$${data.accessTradeoff.npvGivenUpUsdM.toLocaleString()}M given up`}
              accent
            />
            <Stat
              label="MFN cliff"
              value={data.mfnCliff ? `−${data.mfnCliff.dropPct}%` : 'none'}
              sub={
                data.mfnCliff
                  ? `at market ${data.mfnCliff.atMarket}${data.mfnCliff.trigger ? ` · ${data.mfnCliff.trigger}` : ''}`
                  : 'no value-destroying market'
              }
            />
          </section>

          {data.mfnPolicy.enabled && (
            <p className="text-sm text-ink-soft">
              At a {data.mfnPolicy.gdpThresholdPct}% threshold the MFN basket holds{' '}
              <span className="text-ink">{data.mfnPolicy.basket.length} markets</span>:{' '}
              {data.mfnPolicy.basket.join(', ')}. Markets below the line are not referenced, so
              launching there costs nothing in US revenue.
            </p>
          )}

          <section>
            <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">
              Value and access against launch breadth
            </h3>
            <NpvCurve
              curve={data.npvCurve}
              cliff={data.mfnCliff}
              profitMaxMarkets={data.strategies.profitMax.launchedCount}
            />
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">
              What access costs
            </h3>
            <div className="border divide-y">
              {data.accessAtTolerance.map((a) => (
                <div key={a.giveUpToPct} className="flex items-baseline gap-4 px-4 py-2 text-sm">
                  <span className="w-40 text-ink-soft">Give up up to {a.giveUpToPct}% of NPV</span>
                  <span className="tnum w-24">{a.markets} markets</span>
                  <span className="tnum w-28">${a.npvUsdM.toLocaleString()}M</span>
                  <span className="tnum text-ink-soft">
                    {a.patientYearsM.toLocaleString()}M patient-years
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-ink-soft mb-3">
              Price by market — list versus net
            </h3>
            <div className="overflow-x-auto border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-left text-xs uppercase tracking-wider text-ink-soft">
                    <th className="px-3 py-2 font-medium">Market</th>
                    <th className="px-3 py-2 font-medium">MFN basket</th>
                    <th className="px-3 py-2 font-medium text-right">Free</th>
                    <th className="px-3 py-2 font-medium text-right">List</th>
                    <th className="px-3 py-2 font-medium text-right">Net</th>
                    <th className="px-3 py-2 font-medium text-right">Erosion</th>
                    <th className="px-3 py-2 font-medium">References</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.pricingDetail.map((m) => (
                    <tr key={m.id} className="hover:bg-surface">
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2 text-xs">
                        {m.inMfnBasket ? (
                          <span className="px-1 bg-brand text-white text-[10px]">IN</span>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tnum text-ink-soft">{m.freePrice}</td>
                      <td className="px-3 py-2 text-right tnum">{m.listPrice}</td>
                      <td className="px-3 py-2 text-right tnum">{m.netPrice}</td>
                      <td className="px-3 py-2 text-right tnum">
                        {m.erosion > 0 ? `−${m.erosion}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-soft">
                        {m.referencedFrom.join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink-soft max-w-3xl leading-relaxed">
              Prices are indices with the US free price at 100. External referencing propagates on
              the list price; revenue accrues on the net price. Where a confidential rebate is
              available the two diverge, which is how a manufacturer serves a market without
              exporting the discount.
            </p>
          </section>
        </>
      )}
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
