export type Modality = 'drug' | 'device' | 'ivd'

export type AssetKind =
  | 'nce'
  | 'biologic'
  | 'vaccine'
  | 'generic'
  | 'biosimilar'
  | 'atmp'
  | 'blood_product'
  | 'device'

// what an approval "counts as" when another market tries to rely on it.
// mexico and others refuse to treat reliance-derived approvals as references,
// so this has to travel with the approval rather than with the market.
export type Provenance = 'original' | 'reliance' | 'accelerated' | 'conditional'

// reliance is granted per assessment component, not per approval. mdsap is audit
// reliance, who crp is dossier reliance. a market is approved when every required
// component is done.
export type Component = 'dossier' | 'gmp_audit' | 'lot_release' | 'labelling'

export type Confidence = 'high' | 'medium' | 'low'

// who-listed authority scopes are modular: an agency can be listed for generics
// but not biotherapeutics, so a `wla` reference predicate resolves differently
// depending on the asset.
export type ProductCategory = 'generics' | 'nce' | 'biotherapeutics' | 'vaccines'

export interface Authority {
  id: string
  name: string
  ichMember: boolean
  wlaCategories: ProductCategory[]
  imdrfMember: boolean
  mdsapParticipant: boolean
}

export type ReferenceSet =
  | { kind: 'named'; authorities: string[] }
  | { kind: 'wla' }
  | { kind: 'ich' }

// k=1 is plain OR, k=n over a named set is AND. singapore needs 2-of-6,
// saudi verification needs both fda and ema.
export type Prereq =
  | { kind: 'none' }
  | { kind: 'kOf'; k: number; set: ReferenceSet }

export interface Eligibility {
  modalities?: Modality[]
  assetKinds?: AssetKind[]
  excludeAssetKinds?: AssetKind[]
  indications?: string[]
  excludeIndications?: string[]
  orphanOnly?: boolean
  // who pq and eu-m4all only open for categories with an active expression of interest
  requiresWhoEoi?: boolean
  requiresPriorityReviewGrade?: boolean
}

export interface Route {
  id: string
  marketId: string
  name: string
  programId?: string
  modality: Modality

  prereq: Prereq
  /**
   * whether the prerequisite must be *approved* or merely *submitted*. project orbis
   * type A partners file within a month of the fda submission and review concurrently;
   * treating that as "wait for fda approval" overstates the timeline by roughly a year.
   */
  prereqEvent: 'approval' | 'submission'
  /** how stale the reference approval may be. null = no limit. */
  prereqRecencyDays: number | null
  /** which kinds of reference approval qualify. */
  prereqProvenance: Provenance[]

  satisfiesComponents: Component[]
  grantsProvenance: Provenance

  /** mandatory pre-submission notification (eoi, eligibility request). */
  leadTimeDays: number
  durationDays: number
  costUsd: number | null
  /** null = continuous intake; otherwise submissions only open every periodDays. */
  cadenceDays: number | null

  eligibility: Eligibility
  confidence: Confidence
  sourceUrl: string
  note?: string
}

export interface Market {
  id: string
  name: string
  regulator: string
  authorityId: string
  region: string
  isAnchor: boolean
  populationM: number
  /** components this market requires before it will grant an approval. */
  requiredComponents: Component[]
  /** days of local work per component when a route does not satisfy it. */
  localComponentDays: Partial<Record<Component, number>>
  /** brand-originator price index, us = 100. */
  priceIndex: number | null
  /** share of global branded revenue, 0-1. */
  revenueWeight: number
  gdpPerCapitaPctUs: number | null
  oecdMember: boolean
  /** days between approval and actual availability (hta / reimbursement). */
  htaLagDays: number
  confidence: Confidence
  sourceUrl?: string
}

export interface Program {
  id: string
  name: string
  description: string
  sourceUrl: string
}

export interface Asset {
  id: string
  name: string
  modality: Modality
  kind: AssetKind
  indication: string
  orphan: boolean
  whoEoiEligible: boolean
  priorityReviewGrade: boolean
}

export interface ApprovalState {
  marketId: string
  authorityId: string
  routeId: string
  startDay: number
  finishDay: number
  provenance: Provenance
  /** which markets' approvals this route consumed as its prerequisite. */
  viaAuthorities: string[]
}

export interface SolveOptions {
  asset: Asset
  targetMarketIds: string[]
  /** max concurrent active submissions. null = unlimited. */
  capacity: number | null
  /** hard spend ceiling in usd. null = unlimited. */
  budgetUsd: number | null
  horizonDays: number
}

export interface PlanEntry {
  marketId: string
  routeId: string
  routeName: string
  startDay: number
  finishDay: number
  costUsd: number
  provenance: Provenance
  viaAuthorities: string[]
  isTarget: boolean
  isEnabler: boolean
  confidence: Confidence
}

export interface FrontierPoint {
  makespanDays: number
  costUsd: number
  anchorSet: string[]
  plan: PlanEntry[]
}

export interface Infeasible {
  marketId: string
  reason: string
}

export interface SolveResult {
  frontier: FrontierPoint[]
  unreachable: Infeasible[]
  /** uncapacitated lower bound on makespan, used to report an optimality gap. */
  lowerBoundDays: number
}

export interface KnowledgeBase {
  authorities: Authority[]
  markets: Market[]
  routes: Route[]
  programs: Program[]
}
