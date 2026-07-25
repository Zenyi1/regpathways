import type { KnowledgeBase } from '../solver/types'
import { AUTHORITIES, AUTHORITY_IDS } from './authorities'
import { MARKETS } from './markets'
import { PROGRAMS, ROUTES } from './routes'

export const KB: KnowledgeBase = {
  authorities: AUTHORITIES,
  markets: MARKETS,
  routes: ROUTES,
  programs: PROGRAMS,
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  message: string
}

/**
 * seed-time hygiene. these run as a test rather than at request time: a curated graph
 * reliably picks up dangling references and mutual-recognition cycles, and finding them
 * during a demo is much worse than failing a build.
 */
export function validateKnowledgeBase(kb: KnowledgeBase = KB): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const marketIds = new Set(kb.markets.map((m) => m.id))
  const programIds = new Set(kb.programs.map((p) => p.id))
  const routeIds = new Set<string>()

  for (const market of kb.markets) {
    if (!AUTHORITY_IDS.has(market.authorityId)) {
      issues.push({ severity: 'error', message: `market ${market.id} references unknown authority ${market.authorityId}` })
    }
    if (!kb.routes.some((r) => r.marketId === market.id)) {
      issues.push({ severity: 'warning', message: `market ${market.id} has no routes` })
    }
  }

  for (const route of kb.routes) {
    if (routeIds.has(route.id)) {
      issues.push({ severity: 'error', message: `duplicate route id ${route.id}` })
    }
    routeIds.add(route.id)

    if (!marketIds.has(route.marketId)) {
      issues.push({ severity: 'error', message: `route ${route.id} references unknown market ${route.marketId}` })
    }
    if (route.programId && !programIds.has(route.programId)) {
      issues.push({ severity: 'error', message: `route ${route.id} references unknown program ${route.programId}` })
    }
    if (route.prereq.kind === 'kOf') {
      const { k, set } = route.prereq
      if (set.kind === 'named') {
        for (const authorityId of set.authorities) {
          if (!AUTHORITY_IDS.has(authorityId)) {
            issues.push({ severity: 'error', message: `route ${route.id} references unknown authority ${authorityId}` })
          }
        }
        if (k > set.authorities.length) {
          issues.push({ severity: 'error', message: `route ${route.id} needs ${k} of only ${set.authorities.length} authorities` })
        }
      }
      if (k < 1) {
        issues.push({ severity: 'error', message: `route ${route.id} has k < 1` })
      }
    }
    if (route.durationDays <= 0) {
      issues.push({ severity: 'error', message: `route ${route.id} has non-positive duration` })
    }
    if (!route.sourceUrl) {
      issues.push({ severity: 'error', message: `route ${route.id} has no source url` })
    }
  }

  return issues
}

/**
 * a market depends on another when one of its routes can only be unlocked by that
 * market's authority. mutual recognition makes cycles here normal — the solver's
 * monotone fixpoint absorbs them, but we surface them so nobody assumes a clean DAG.
 */
export function findReliancecycles(kb: KnowledgeBase = KB): string[][] {
  const authorityToMarkets = new Map<string, string[]>()
  for (const m of kb.markets) {
    const list = authorityToMarkets.get(m.authorityId) ?? []
    list.push(m.id)
    authorityToMarkets.set(m.authorityId, list)
  }

  const edges = new Map<string, Set<string>>()
  for (const route of kb.routes) {
    if (route.prereq.kind !== 'kOf') continue
    const set = route.prereq.set
    const authorities =
      set.kind === 'named' ? set.authorities : kb.authorities.map((a) => a.id)
    const targets = edges.get(route.marketId) ?? new Set<string>()
    for (const authorityId of authorities) {
      for (const dep of authorityToMarkets.get(authorityId) ?? []) {
        if (dep !== route.marketId) targets.add(dep)
      }
    }
    edges.set(route.marketId, targets)
  }

  const cycles: string[][] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const walk = (node: string) => {
    if (state.get(node) === 'done') return
    if (state.get(node) === 'visiting') {
      const at = stack.indexOf(node)
      if (at >= 0) cycles.push([...stack.slice(at), node])
      return
    }
    state.set(node, 'visiting')
    stack.push(node)
    for (const next of edges.get(node) ?? []) walk(next)
    stack.pop()
    state.set(node, 'done')
  }

  for (const market of kb.markets) walk(market.id)
  return cycles
}

export { AUTHORITIES, MARKETS, ROUTES, PROGRAMS }
export { ASSET_PRESETS } from './assets'
