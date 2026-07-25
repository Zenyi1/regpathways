import type { NextRequest } from 'next/server'
import { KB } from '@/lib/data'
import { json, preflight } from '@/lib/api/respond'

export function OPTIONS() {
  return preflight()
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const region = q.get('region')
  const anchorsOnly = q.get('anchor') === 'true'
  const modality = q.get('modality') ?? 'drug'
  const search = q.get('q')?.toLowerCase()
  const mfnThreshold = Number(q.get('mfnThreshold') ?? 60)

  let markets = KB.markets

  if (region) markets = markets.filter((m) => m.region.toLowerCase() === region.toLowerCase())
  if (anchorsOnly) markets = markets.filter((m) => m.isAnchor)
  if (search) {
    markets = markets.filter(
      (m) =>
        m.name.toLowerCase().includes(search) ||
        m.regulator.toLowerCase().includes(search) ||
        m.id.toLowerCase().includes(search),
    )
  }

  const data = markets.map((m) => {
    const routes = KB.routes.filter((r) => r.marketId === m.id && r.modality === modality)
    return {
      id: m.id,
      name: m.name,
      regulator: m.regulator,
      authorityId: m.authorityId,
      region: m.region,
      isAnchor: m.isAnchor,
      populationM: m.populationM,
      priceIndexBrandUs100: m.priceIndex,
      revenueWeight: m.revenueWeight,
      gdpPerCapitaPctUs: m.gdpPerCapitaPctUs,
      oecdMember: m.oecdMember,
      /** whether this market sits inside the MFN reference basket at the given threshold. */
      inMfnBasket:
        m.oecdMember && m.gdpPerCapitaPctUs !== null && m.gdpPerCapitaPctUs >= mfnThreshold,
      htaLagDays: m.htaLagDays,
      requiredComponents: m.requiredComponents,
      localComponentDays: m.localComponentDays,
      routeCount: routes.length,
      fastestRouteDays: routes.length ? Math.min(...routes.map((r) => r.durationDays)) : null,
      confidence: m.confidence,
      sourceUrl: m.sourceUrl ?? null,
    }
  })

  return json({
    count: data.length,
    mfnThreshold,
    regions: [...new Set(KB.markets.map((m) => m.region))].sort(),
    markets: data,
  })
}
