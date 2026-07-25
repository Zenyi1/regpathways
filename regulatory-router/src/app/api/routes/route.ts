import type { NextRequest } from 'next/server'
import { KB } from '@/lib/data'
import { isRouteEligible } from '@/lib/solver/eligibility'
import { ASSET_PRESETS } from '@/lib/data/assets'
import { json, preflight } from '@/lib/api/respond'

export function OPTIONS() {
  return preflight()
}

function describePrereq(route: (typeof KB.routes)[number]): string {
  if (route.prereq.kind === 'none') return 'none (standalone filing)'
  const { k, set } = route.prereq
  const who =
    set.kind === 'named'
      ? set.authorities.join(', ')
      : set.kind === 'wla'
        ? 'any WHO-Listed Authority'
        : 'any ICH member'
  const noun = route.prereqEvent === 'submission' ? 'submission' : 'approval'
  const recency =
    route.prereqRecencyDays === null
      ? ''
      : `, within ${Math.round(route.prereqRecencyDays / 365)} year(s)`
  return `${k} of [${who}] ${noun}${recency}`
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const marketId = q.get('market')
  const programId = q.get('program')
  const confidence = q.get('confidence')
  const modality = q.get('modality')
  const assetId = q.get('assetId')
  const relianceOnly = q.get('reliance') === 'true'

  let routes = KB.routes

  if (marketId) routes = routes.filter((r) => r.marketId === marketId)
  if (programId) routes = routes.filter((r) => r.programId === programId)
  if (confidence) routes = routes.filter((r) => r.confidence === confidence)
  if (modality) routes = routes.filter((r) => r.modality === modality)
  if (relianceOnly) routes = routes.filter((r) => r.prereq.kind !== 'none')

  const asset = assetId ? ASSET_PRESETS.find((a) => a.id === assetId) : undefined
  if (assetId && !asset) {
    return json(
      { error: `unknown assetId "${assetId}"`, available: ASSET_PRESETS.map((a) => a.id) },
      { status: 422 },
    )
  }
  if (asset) routes = routes.filter((r) => isRouteEligible(r, asset))

  const marketsById = new Map(KB.markets.map((m) => [m.id, m]))
  const programsById = new Map(KB.programs.map((p) => [p.id, p]))

  return json({
    count: routes.length,
    filteredForAsset: asset?.name ?? null,
    routes: routes.map((r) => ({
      id: r.id,
      marketId: r.marketId,
      market: marketsById.get(r.marketId)?.name ?? r.marketId,
      name: r.name,
      program: r.programId ? (programsById.get(r.programId)?.name ?? null) : null,
      modality: r.modality,
      prerequisite: describePrereq(r),
      prereqRaw: r.prereq,
      prereqEvent: r.prereqEvent,
      prereqRecencyDays: r.prereqRecencyDays,
      acceptsProvenance: r.prereqProvenance,
      satisfiesComponents: r.satisfiesComponents,
      leadTimeDays: r.leadTimeDays,
      durationDays: r.durationDays,
      cadenceDays: r.cadenceDays,
      costUsd: r.costUsd,
      eligibility: r.eligibility,
      confidence: r.confidence,
      sourceUrl: r.sourceUrl,
      note: r.note ?? null,
    })),
  })
}
