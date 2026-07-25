import { KB } from '@/lib/data'
import { ASSET_PRESETS } from '@/lib/data/assets'
import { isRouteEligible } from '@/lib/solver/eligibility'
import { Router, type AssetOption, type MarketOption } from '@/components/Router'
import { RegulationHero } from '@/components/RegulationHero'
import { IntroModal } from '@/components/IntroModal'

const MFN_THRESHOLD = 60

export default function Home() {
  const markets: MarketOption[] = KB.markets
    .filter((m) => m.populationM > 0)
    .map((m) => ({
      id: m.id,
      name: m.name,
      region: m.region,
      regulator: m.regulator,
      isAnchor: m.isAnchor,
      inMfnBasket:
        m.oecdMember && m.gdpPerCapitaPctUs !== null && m.gdpPerCapitaPctUs >= MFN_THRESHOLD,
      routeCount: KB.routes.filter((r) => r.marketId === m.id).length,
    }))

  const programNames = new Map(KB.programs.map((p) => [p.id, p.name]))
  const assets: AssetOption[] = ASSET_PRESETS.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    indication: a.indication,
    orphan: a.orphan,
    whoEoiEligible: a.whoEoiEligible,
    priorityReviewGrade: a.priorityReviewGrade,
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
      <IntroModal />

      <RegulationHero
        markets={KB.markets.length}
        routes={KB.routes.length}
        programs={KB.programs.length}
      />

      <section id="how" className="bg-white border-b">
        <div className="max-w-[1100px] mx-auto px-6 md:px-10 py-16 md:py-20">
          <h2 className="max-w-[24ch] text-[26px] md:text-[34px] font-semibold leading-[1.14] tracking-[-0.02em]">
            Two networks tie the markets together, and they pull in{' '}
            <span className="text-brand">opposite directions</span>.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                h: 'Reliance rewards filing early',
                p: 'Project Orbis, the Access Consortium, EU-M4all, WHO prequalification and dozens of national verification routes all shortcut review once a stringent regulator has approved.',
              },
              {
                h: 'Reference pricing punishes it',
                p: 'Countries cap price against a basket of their neighbours, and Most Favoured Nation pegs the US to the lowest comparable price. Launching cheap early is expensive later.',
              },
              {
                h: 'So the order is solved, not looked up',
                p: 'Minimising time is a shortest path. Minimising cost is set cover, and NP-hard. Both are solved exactly here, in milliseconds, because the hard part is only about a dozen anchors.',
              },
            ].map((c) => (
              <div key={c.h} className="border-t pt-5">
                <h3 className="text-sm font-semibold">{c.h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <header id="router" className="border-b scroll-mt-4">
        <div className="max-w-[1500px] mx-auto px-6 py-5 flex items-baseline justify-between gap-6">
          <div>
            <h1 className="text-lg font-semibold">Regulatory Pathway Router</h1>
            <p className="text-sm text-ink-soft mt-0.5">
              Filing sequences across {KB.markets.length} markets and {KB.routes.length} routes,
              routed through reliance pathways.
            </p>
          </div>
          <a href="/docs" className="text-sm text-brand hover:underline whitespace-nowrap">
            API reference →
          </a>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-6 py-8 flex-1 w-full">
        <Router markets={markets} assets={assets} />
      </div>

      <footer className="bg-footer text-ink-on-dark mt-16">
        <div className="max-w-[1500px] mx-auto px-6 py-8 text-sm space-y-2">
          <p className="font-medium">How to read the numbers</p>
          <p className="text-white/70 max-w-3xl leading-relaxed">
            Durations are agency review clocks in calendar days, so real elapsed time usually runs
            1.5 to 3 times longer. Reliance pathways shorten registration, not reimbursement, and
            an approval is not the same as access. Every route carries a confidence level and a
            link to its regulator source. Rows marked low confidence are estimates rather than
            published figures.
          </p>
        </div>
      </footer>
    </>
  )
}
