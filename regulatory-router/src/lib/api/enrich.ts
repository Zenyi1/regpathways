import { KB } from '../data'
import { solve } from '../solver/pareto'
import type { FrontierPoint, SolveOptions } from '../solver/types'

const DAYS_PER_MONTH = 30.4

export interface EnrichedStep {
  marketId: string
  market: string
  regulator: string
  region: string
  routeId: string
  route: string
  program: string | null
  startDay: number
  finishDay: number
  startMonth: number
  finishMonth: number
  costUsd: number
  reliesOn: string[]
  role: 'target' | 'enabler'
  confidence: string
  sourceUrl: string
  note?: string
}

export interface EnrichedPoint {
  makespanDays: number
  makespanMonths: number
  costUsd: number
  anchors: string[]
  steps: EnrichedStep[]
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function enrichPoint(point: FrontierPoint): EnrichedPoint {
  const marketsById = new Map(KB.markets.map((m) => [m.id, m]))
  const routesById = new Map(KB.routes.map((r) => [r.id, r]))
  const programsById = new Map(KB.programs.map((p) => [p.id, p]))

  return {
    makespanDays: point.makespanDays,
    makespanMonths: round1(point.makespanDays / DAYS_PER_MONTH),
    costUsd: point.costUsd,
    anchors: point.anchorSet,
    steps: point.plan.map((entry) => {
      const market = marketsById.get(entry.marketId)
      const route = routesById.get(entry.routeId)
      const program = route?.programId ? programsById.get(route.programId) : undefined
      return {
        marketId: entry.marketId,
        market: market?.name ?? entry.marketId,
        regulator: market?.regulator ?? '',
        region: market?.region ?? '',
        routeId: entry.routeId,
        route: entry.routeName,
        program: program?.name ?? null,
        startDay: entry.startDay,
        finishDay: entry.finishDay,
        startMonth: round1(entry.startDay / DAYS_PER_MONTH),
        finishMonth: round1(entry.finishDay / DAYS_PER_MONTH),
        costUsd: entry.costUsd,
        reliesOn: entry.viaAuthorities,
        role: entry.isTarget ? 'target' : 'enabler',
        confidence: entry.confidence,
        sourceUrl: route?.sourceUrl ?? '',
        note: route?.note,
      }
    }),
  }
}

/** what the same target set costs with no reliance at all — the comparison that matters. */
function naiveBaseline(options: SolveOptions) {
  const standaloneOnly = {
    ...KB,
    routes: KB.routes.filter((r) => r.prereq.kind === 'none'),
  }
  const result = solve(standaloneOnly, options)
  const cheapest = result.frontier[result.frontier.length - 1]
  if (!cheapest) return null
  return {
    makespanDays: cheapest.makespanDays,
    makespanMonths: round1(cheapest.makespanDays / DAYS_PER_MONTH),
    costUsd: cheapest.costUsd,
  }
}

export function solveEnriched(options: SolveOptions, warnings: string[] = []) {
  const started = Date.now()
  const result = solve(KB, options)
  const elapsedMs = Date.now() - started

  if (result.frontier.length === 0) {
    return {
      ok: false as const,
      asset: options.asset,
      targets: options.targetMarketIds,
      unreachable: result.unreachable,
      warnings,
      elapsedMs,
    }
  }

  const fastest = result.frontier[0]
  const cheapest = result.frontier[result.frontier.length - 1]
  const baseline = naiveBaseline(options)

  // the single recommended plan: the compromise point closest to the ideal corner once
  // time and cost are normalised. with one frontier point it degenerates to that point.
  const timeSpan = fastest.makespanDays - cheapest.makespanDays
  const costSpan = cheapest.costUsd - fastest.costUsd
  let recommendedIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  result.frontier.forEach((p, i) => {
    const t = timeSpan === 0 ? 0 : (p.makespanDays - fastest.makespanDays) / -timeSpan
    const c = costSpan === 0 ? 0 : (p.costUsd - fastest.costUsd) / costSpan
    const distance = Math.hypot(Math.abs(t), Math.abs(c))
    if (distance < bestDistance) {
      bestDistance = distance
      recommendedIndex = i
    }
  })
  const recommended = result.frontier[recommendedIndex]

  const allSteps = result.frontier.flatMap((p) => p.plan)
  const lowConfidence = allSteps.filter((s) => s.confidence === 'low').length
  const confidenceMix = {
    high: allSteps.filter((s) => s.confidence === 'high').length,
    medium: allSteps.filter((s) => s.confidence === 'medium').length,
    low: lowConfidence,
  }

  return {
    ok: true as const,
    asset: options.asset,
    targets: options.targetMarketIds,
    constraints: {
      capacity: options.capacity,
      budgetUsd: options.budgetUsd,
      horizonDays: options.horizonDays,
    },
    recommendedIndex,
    recommended: enrichPoint(recommended),
    summary: {
      frontierPoints: result.frontier.length,
      fastest: {
        makespanMonths: round1(fastest.makespanDays / DAYS_PER_MONTH),
        costUsd: fastest.costUsd,
      },
      cheapest: {
        makespanMonths: round1(cheapest.makespanDays / DAYS_PER_MONTH),
        costUsd: cheapest.costUsd,
      },
      /** uncapacitated makespan; with a capacity limit the gap is the optimality gap. */
      lowerBoundMonths: round1(result.lowerBoundDays / DAYS_PER_MONTH),
      naiveBaseline: baseline,
      savingsVsNaive: baseline
        ? {
            costUsd: baseline.costUsd - cheapest.costUsd,
            costPct: round1(((baseline.costUsd - cheapest.costUsd) / baseline.costUsd) * 100),
            months: round1(baseline.makespanMonths - fastest.makespanDays / DAYS_PER_MONTH),
          }
        : null,
      confidenceMix,
    },
    frontier: result.frontier.map(enrichPoint),
    warnings,
    elapsedMs,
  }
}
