import {
  authorityEventsFrom,
  earliestApprovals,
  routeStaircase,
  type AuthorityEvent,
  type NodeState,
} from './graph'
import { explainIneligibility, isRouteEligible } from './eligibility'
import type {
  FrontierPoint,
  Infeasible,
  KnowledgeBase,
  PlanEntry,
  SolveOptions,
  SolveResult,
} from './types'

/** hard cap so the subset enumeration stays in the millisecond range. */
const MAX_ANCHORS = 12

/**
 * only anchors that some eligible route of some reachable market actually references
 * are worth enumerating over. this is what keeps 2^n small.
 */
function relevantAnchors(kb: KnowledgeBase, opts: SolveOptions): string[] {
  const referenced = new Set<string>()
  for (const route of kb.routes) {
    if (!isRouteEligible(route, opts.asset)) continue
    if (route.prereq.kind === 'none') continue
    const set = route.prereq.set
    if (set.kind === 'named') for (const a of set.authorities) referenced.add(a)
    else for (const a of kb.authorities) referenced.add(a.id)
  }

  const anchors = kb.markets
    .filter((m) => m.isAnchor && referenced.has(m.authorityId))
    .filter((m) => kb.routes.some((r) => r.marketId === m.id && isRouteEligible(r, opts.asset)))
    .map((m) => m.id)

  return anchors.slice(0, MAX_ANCHORS)
}

function authorityToMarket(kb: KnowledgeBase): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of kb.markets) if (!map.has(m.authorityId)) map.set(m.authorityId, m.id)
  return map
}

/** walk back from the chosen routes to find every filing the plan actually depends on. */
function closeOverDependencies(
  chosen: Map<string, NodeState>,
  states: Map<string, NodeState>,
  authToMarket: Map<string, string>,
): Map<string, NodeState> {
  const out = new Map(chosen)
  const queue = [...chosen.values()]

  while (queue.length) {
    const node = queue.pop()!
    for (const authorityId of node.viaAuthorities) {
      const marketId = authToMarket.get(authorityId)
      if (!marketId || out.has(marketId)) continue
      const dep = states.get(marketId)
      if (!dep) continue
      out.set(marketId, dep)
      queue.push(dep)
    }
  }
  return out
}

/**
 * capacity-constrained makespan by list scheduling. the uncapacitated result is an
 * admissible lower bound, so the gap between the two is reportable rather than hidden.
 */
function applyCapacity(entries: PlanEntry[], capacity: number): PlanEntry[] {
  const sorted = [...entries].sort((a, b) => a.startDay - b.startDay || a.finishDay - b.finishDay)
  const running: number[] = [] // finish days of active submissions
  const shifted: PlanEntry[] = []
  const finishByMarket = new Map<string, number>()

  for (const entry of sorted) {
    const duration = entry.finishDay - entry.startDay
    // cannot start before its own prerequisites completed under the shifted schedule
    let earliest = entry.startDay
    for (const [marketId, finish] of finishByMarket) {
      if (entry.viaAuthorities.length && marketId !== entry.marketId) continue
      earliest = Math.max(earliest, finish)
    }

    while (running.length >= capacity) {
      running.sort((a, b) => a - b)
      const freed = running.shift()!
      earliest = Math.max(earliest, freed)
    }

    const start = earliest
    const finish = start + duration
    running.push(finish)
    finishByMarket.set(entry.marketId, finish)
    shifted.push({ ...entry, startDay: start, finishDay: finish })
  }

  return shifted
}

function paretoFilter(points: FrontierPoint[]): FrontierPoint[] {
  const sorted = [...points].sort(
    (a, b) => a.makespanDays - b.makespanDays || a.costUsd - b.costUsd,
  )
  const kept: FrontierPoint[] = []
  let bestCost = Number.POSITIVE_INFINITY
  for (const p of sorted) {
    if (p.costUsd < bestCost) {
      kept.push(p)
      bestCost = p.costUsd
    }
  }
  return kept
}

export function solve(kb: KnowledgeBase, opts: SolveOptions): SolveResult {
  const targets = opts.targetMarketIds
  const targetSet = new Set(targets)
  const anchors = relevantAnchors(kb, opts)
  const authToMarket = authorityToMarket(kb)
  const marketsById = new Map(kb.markets.map((m) => [m.id, m]))

  const points: FrontierPoint[] = []
  let lowerBound = Number.POSITIVE_INFINITY

  const subsetCount = 1 << anchors.length
  for (let mask = 0; mask < subsetCount; mask++) {
    const anchorSet: string[] = []
    for (let i = 0; i < anchors.length; i++) {
      if (mask & (1 << i)) anchorSet.push(anchors[i])
    }

    const allowed = new Set<string>([...anchorSet, ...targets])
    const states = earliestApprovals(kb, opts.asset, {
      allowedMarketIds: allowed,
      horizonDays: opts.horizonDays,
    })

    if (!targets.every((t) => states.has(t))) continue

    const events = authorityEventsFrom(states, kb)
    const makespanHere = Math.max(...targets.map((t) => states.get(t)!.finishDay))
    lowerBound = Math.min(lowerBound, makespanHere)

    // per-target cost/time staircases, then sweep the deadline upward
    const staircases = new Map<string, NodeState[]>()
    for (const t of targets) {
      const market = marketsById.get(t)
      if (!market) continue
      staircases.set(t, routeStaircase(market, kb, opts.asset, events))
    }
    if ([...staircases.values()].some((s) => s.length === 0)) continue

    const deadlines = new Set<number>()
    for (const stair of staircases.values()) for (const s of stair) deadlines.add(s.finishDay)

    for (const deadline of [...deadlines].sort((a, b) => a - b)) {
      const chosen = new Map<string, NodeState>()
      let feasible = true

      for (const [marketId, stair] of staircases) {
        const options = stair.filter((s) => s.finishDay <= deadline)
        if (options.length === 0) {
          feasible = false
          break
        }
        const cheapest = options.reduce((a, b) => (b.costUsd < a.costUsd ? b : a))
        chosen.set(marketId, cheapest)
      }
      if (!feasible) continue

      const full = closeOverDependencies(chosen, states, authToMarket)
      const cost = [...full.values()].reduce((sum, s) => sum + s.costUsd, 0)
      if (opts.budgetUsd !== null && cost > opts.budgetUsd) continue

      let entries: PlanEntry[] = [...full.entries()].map(([marketId, s]) => {
        const route = kb.routes.find((r) => r.id === s.routeId)
        return {
          marketId,
          routeId: s.routeId,
          routeName: route?.name ?? s.routeId,
          startDay: s.startDay,
          finishDay: s.finishDay,
          costUsd: s.costUsd,
          provenance: s.provenance,
          viaAuthorities: s.viaAuthorities,
          isTarget: targetSet.has(marketId),
          isEnabler: !targetSet.has(marketId),
          confidence: route?.confidence ?? 'low',
        }
      })

      if (opts.capacity !== null && opts.capacity > 0) {
        entries = applyCapacity(entries, opts.capacity)
      }

      const makespan = Math.max(
        ...entries.filter((e) => e.isTarget).map((e) => e.finishDay),
      )

      points.push({
        makespanDays: makespan,
        costUsd: cost,
        anchorSet,
        plan: entries.sort((a, b) => a.startDay - b.startDay),
      })
    }
  }

  const unreachable: Infeasible[] = []
  if (points.length === 0) {
    const allowed = new Set(kb.markets.map((m) => m.id))
    const states = earliestApprovals(kb, opts.asset, {
      allowedMarketIds: allowed,
      horizonDays: opts.horizonDays,
    })
    for (const t of targets) {
      if (states.has(t)) continue
      const routes = kb.routes.filter((r) => r.marketId === t)
      const reasons = routes
        .map((r) => explainIneligibility(r, opts.asset))
        .filter((x): x is string => Boolean(x))
      unreachable.push({
        marketId: t,
        reason:
          routes.length === 0
            ? 'no routes defined for this market and modality'
            : reasons.length > 0
              ? `no eligible route: ${[...new Set(reasons)].join('; ')}`
              : 'eligible routes exist but their prerequisites are unreachable',
      })
    }
  }

  return {
    frontier: paretoFilter(points),
    unreachable,
    lowerBoundDays: Number.isFinite(lowerBound) ? lowerBound : 0,
  }
}

export type { AuthorityEvent }
