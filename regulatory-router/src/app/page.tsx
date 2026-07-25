import { KB } from '@/lib/data'
import { ASSET_PRESETS } from '@/lib/data/assets'
import { isRouteEligible } from '@/lib/solver/eligibility'
import { Router, type AssetOption, type MarketOption } from '@/components/Router'

const MFN_THRESHOLD = 60

export default function Home() {
  const markets: MarketOption[] = KB.markets
    .filter((m) => m.populationM > 0)
    .map((m) => ({
      id: m.id,
      name: m.name,
      region: m.region,
      isAnchor: m.isAnchor,
      inMfnBasket:
        m.oecdMember && m.gdpPerCapitaPctUs !== null && m.gdpPerCapitaPctUs >= MFN_THRESHOLD,
      priceIndex: m.priceIndex,
      gdpPerCapitaPctUs: m.gdpPerCapitaPctUs,
    }))

  const programNames = new Map(KB.programs.map((p) => [p.id, p.name]))
  const assets: AssetOption[] = ASSET_PRESETS.map((a) => ({
    id: a.id,
    name: a.name,
    indication: a.indication,
    kind: a.kind,
    reachablePrograms: [
      ...new Set(
        KB.routes
          .filter((r) => isRouteEligible(r, a) && r.programId)
          .map((r) => programNames.get(r.programId as string) ?? (r.programId as string)),
      ),
    ],
  }))

  return (
    <>
      <header className="border-b">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-baseline justify-between gap-6">
          <div>
            <h1 className="text-lg font-semibold">Regulatory Pathway Router</h1>
            <p className="text-sm text-ink-soft mt-0.5">
              Filing sequences across {KB.markets.length} markets and {KB.routes.length} routes,
              routed through reliance pathways.
            </p>
          </div>
          <a href="/api" className="text-sm text-brand hover:underline whitespace-nowrap">
            API reference →
          </a>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8 flex-1 w-full">
        <Router markets={markets} assets={assets} />
      </div>

      <footer className="bg-footer text-ink-on-dark mt-16">
        <div className="max-w-[1400px] mx-auto px-6 py-8 text-sm space-y-2">
          <p className="font-medium">How to read the numbers</p>
          <p className="text-white/70 max-w-3xl leading-relaxed">
            Durations are agency clocks in calendar days; real elapsed time runs 1.5–3× longer.
            Reliance pathways shorten registration, not reimbursement — an approval is not access.
            Every route carries a confidence level and a link to its regulator source, and rows
            marked low confidence are estimates rather than published figures.
          </p>
        </div>
      </footer>
    </>
  )
}
