import { isRouteEligible, resolveReferenceSet } from './eligibility'
import type {
  Asset,
  Component,
  KnowledgeBase,
  Market,
  Provenance,
  Route,
} from './types'

export interface NodeState {
  marketId: string
  routeId: string
  startDay: number
  finishDay: number
  provenance: Provenance
  viaAuthorities: string[]
  costUsd: number
}

interface AuthorityEvent {
  startDay: number
  finishDay: number
  provenance: Provenance
}

const INF = Number.POSITIVE_INFINITY

/** components the route does not cover still have to be done locally, in parallel. */
function unmetComponentDays(market: Market, route: Route): number {
  let worst = 0
  for (const c of market.requiredComponents) {
    if (route.satisfiesComponents.includes(c)) continue
    worst = Math.max(worst, market.localComponentDays[c as Component] ?? 0)
  }
  return worst
}

function effectiveDuration(market: Market, route: Route): number {
  // local component work runs concurrently with the review clock, so the market is
  // approved when the slower of the two finishes. this is why a fast dossier route
  // does not help when a gmp inspection is the real bottleneck.
  return Math.max(route.durationDays, unmetComponentDays(market, route))
}

/**
 * earliest day the prerequisite is satisfied, choosing which reference approvals to
 * lean on. with a recency window we cannot simply take the k earliest approvals: the
 * oldest one in the chosen set must still be valid on the submission date. so we slide
 * a window of size k over the sorted qualifying times and take the window that closes
 * soonest while staying inside the window length.
 */
function prereqReady(
  route: Route,
  authorityEvents: Map<string, AuthorityEvent>,
  kb: KnowledgeBase,
  asset: Asset,
): { day: number; via: string[] } | null {
  if (route.prereq.kind === 'none') return { day: 0, via: [] }

  const { k, set } = route.prereq
  const candidates = resolveReferenceSet(set, kb.authorities, asset)

  const qualifying: { authorityId: string; day: number }[] = []
  for (const authorityId of candidates) {
    const ev = authorityEvents.get(authorityId)
    if (!ev) continue
    if (!route.prereqProvenance.includes(ev.provenance)) continue
    const day = route.prereqEvent === 'approval' ? ev.finishDay : ev.startDay
    if (!Number.isFinite(day)) continue
    qualifying.push({ authorityId, day })
  }

  if (qualifying.length < k) return null
  qualifying.sort((a, b) => a.day - b.day)

  let best: { day: number; via: string[] } | null = null
  for (let i = 0; i + k <= qualifying.length; i++) {
    const window = qualifying.slice(i, i + k)
    const closes = window[window.length - 1].day
    const oldest = window[0].day
    if (route.prereqRecencyDays !== null && closes - oldest > route.prereqRecencyDays) {
      continue
    }
    if (!best || closes < best.day) {
      best = { day: closes, via: window.map((w) => w.authorityId) }
    }
  }
  return best
}

function evaluateRoute(
  market: Market,
  route: Route,
  authorityEvents: Map<string, AuthorityEvent>,
  kb: KnowledgeBase,
  asset: Asset,
): NodeState | null {
  const ready = prereqReady(route, authorityEvents, kb, asset)
  if (!ready) return null

  // the pre-submission notification can run while waiting for the reference approval,
  // so it is a floor on the start date rather than an addition to it.
  let start = Math.max(ready.day, route.leadTimeDays)

  if (route.cadenceDays && route.cadenceDays > 0) {
    start = Math.ceil(start / route.cadenceDays) * route.cadenceDays
  }

  // re-check recency against the actual submission date, not just the prerequisite date.
  // cadence quantisation or a lead time can push a submission past a window that was
  // open when the reference approval landed.
  if (route.prereqRecencyDays !== null && ready.via.length > 0) {
    for (const authorityId of ready.via) {
      const ev = authorityEvents.get(authorityId)
      if (!ev) return null
      const refDay = route.prereqEvent === 'approval' ? ev.finishDay : ev.startDay
      if (start - refDay > route.prereqRecencyDays) return null
    }
  }

  const finish = start + effectiveDuration(market, route)

  return {
    marketId: market.id,
    routeId: route.id,
    startDay: start,
    finishDay: finish,
    provenance: route.grantsProvenance,
    viaAuthorities: ready.via,
    costUsd: route.costUsd ?? 0,
  }
}

export interface EarliestOptions {
  /** restrict which markets we are willing to file in at all. */
  allowedMarketIds: Set<string>
  /** restrict which routes may be used, for pareto sweeps. */
  routeAllowed?: (route: Route) => boolean
  horizonDays: number
}

/**
 * label-correcting fixpoint over the reliance hypergraph. a market's approval time is
 * the min over its eligible routes of the max over that route's prerequisites, so both
 * operators are monotone and non-negative — the iteration converges regardless of cycles
 * in the reliance graph, which mutual-recognition pairs reliably introduce.
 */
export function earliestApprovals(
  kb: KnowledgeBase,
  asset: Asset,
  opts: EarliestOptions,
): Map<string, NodeState> {
  const marketsById = new Map(kb.markets.map((m) => [m.id, m]))
  const routesByMarket = new Map<string, Route[]>()

  for (const route of kb.routes) {
    if (!opts.allowedMarketIds.has(route.marketId)) continue
    if (!isRouteEligible(route, asset)) continue
    if (opts.routeAllowed && !opts.routeAllowed(route)) continue
    const list = routesByMarket.get(route.marketId) ?? []
    list.push(route)
    routesByMarket.set(route.marketId, list)
  }

  const states = new Map<string, NodeState>()
  const authorityEvents = new Map<string, AuthorityEvent>()

  const maxIterations = kb.markets.length + 2
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false

    for (const [marketId, routes] of routesByMarket) {
      const market = marketsById.get(marketId)
      if (!market) continue

      let best: NodeState | null = null
      for (const route of routes) {
        const candidate = evaluateRoute(market, route, authorityEvents, kb, asset)
        if (!candidate) continue
        if (candidate.finishDay > opts.horizonDays) continue
        if (!best || candidate.finishDay < best.finishDay) best = candidate
      }

      if (!best) continue
      const current = states.get(marketId)
      if (!current || best.finishDay < current.finishDay) {
        states.set(marketId, best)
        const existing = authorityEvents.get(market.authorityId)
        if (!existing || best.finishDay < existing.finishDay) {
          authorityEvents.set(market.authorityId, {
            startDay: best.startDay,
            finishDay: best.finishDay,
            provenance: best.provenance,
          })
        }
        changed = true
      }
    }

    if (!changed) break
  }

  return states
}

/**
 * every (finishDay, cost) step available for one market, given fixed anchor approval
 * times. used to build the cost frontier: for a deadline D the market contributes the
 * cheapest route that still finishes by D.
 */
export function routeStaircase(
  market: Market,
  kb: KnowledgeBase,
  asset: Asset,
  authorityEvents: Map<string, AuthorityEvent>,
): NodeState[] {
  const out: NodeState[] = []
  for (const route of kb.routes) {
    if (route.marketId !== market.id) continue
    if (!isRouteEligible(route, asset)) continue
    const s = evaluateRoute(market, route, authorityEvents, kb, asset)
    if (s) out.push(s)
  }
  // keep only non-dominated (earlier and cheaper) options
  out.sort((a, b) => a.finishDay - b.finishDay || a.costUsd - b.costUsd)
  const kept: NodeState[] = []
  let cheapest = INF
  for (const s of out) {
    if (s.costUsd < cheapest) {
      kept.push(s)
      cheapest = s.costUsd
    }
  }
  return kept
}

export function authorityEventsFrom(
  states: Map<string, NodeState>,
  kb: KnowledgeBase,
): Map<string, AuthorityEvent> {
  const marketsById = new Map(kb.markets.map((m) => [m.id, m]))
  const events = new Map<string, AuthorityEvent>()
  for (const [marketId, s] of states) {
    const market = marketsById.get(marketId)
    if (!market) continue
    const existing = events.get(market.authorityId)
    if (!existing || s.finishDay < existing.finishDay) {
      events.set(market.authorityId, {
        startDay: s.startDay,
        finishDay: s.finishDay,
        provenance: s.provenance,
      })
    }
  }
  return events
}

export type { AuthorityEvent }
