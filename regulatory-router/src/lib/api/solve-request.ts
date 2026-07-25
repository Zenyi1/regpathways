import { ASSET_PRESETS, KB } from '../data'
import type { Asset, SolveOptions } from '../solver/types'

export interface ParsedSolveRequest {
  options: SolveOptions
  warnings: string[]
}

const MODALITIES = new Set(['drug', 'device', 'ivd'])
const KINDS = new Set([
  'nce', 'biologic', 'vaccine', 'generic', 'biosimilar', 'atmp', 'blood_product', 'device',
])

function asBool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1' || v === 'yes'
  return fallback
}

function asNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * accepts either `assetId` naming a preset, or an inline `asset` object. everything
 * else has a sane default so a bare `{"targets":["US","EU"]}` works.
 */
export function parseSolveRequest(body: Record<string, unknown>): ParsedSolveRequest | { error: string } {
  const warnings: string[] = []

  let asset: Asset | undefined
  const assetId = body.assetId ?? body.asset_id
  if (typeof assetId === 'string') {
    asset = ASSET_PRESETS.find((a) => a.id === assetId)
    if (!asset) {
      return {
        error: `unknown assetId "${assetId}". Available: ${ASSET_PRESETS.map((a) => a.id).join(', ')}`,
      }
    }
  } else if (body.asset && typeof body.asset === 'object') {
    const a = body.asset as Record<string, unknown>
    const modality = String(a.modality ?? 'drug')
    const kind = String(a.kind ?? 'nce')
    if (!MODALITIES.has(modality)) return { error: `invalid modality "${modality}"` }
    if (!KINDS.has(kind)) return { error: `invalid asset kind "${kind}"` }
    asset = {
      id: String(a.id ?? 'custom'),
      name: String(a.name ?? 'Custom asset'),
      modality: modality as Asset['modality'],
      kind: kind as Asset['kind'],
      indication: String(a.indication ?? 'other'),
      orphan: asBool(a.orphan, false),
      whoEoiEligible: asBool(a.whoEoiEligible ?? a.who_eoi_eligible, false),
      priorityReviewGrade: asBool(a.priorityReviewGrade ?? a.priority_review_grade, false),
    }
  } else {
    return { error: 'provide either "assetId" (a preset) or an inline "asset" object' }
  }

  const rawTargets = body.targets ?? body.targetMarketIds ?? body.target_market_ids
  let targets: string[]
  if (Array.isArray(rawTargets)) targets = rawTargets.map(String)
  else if (typeof rawTargets === 'string') targets = rawTargets.split(',').map((s) => s.trim()).filter(Boolean)
  else return { error: '"targets" must be an array or comma-separated string of market ids' }

  if (targets.length === 0) return { error: '"targets" must contain at least one market id' }

  const known = new Set(KB.markets.map((m) => m.id))
  const unknown = targets.filter((t) => !known.has(t))
  if (unknown.length) {
    return { error: `unknown market ids: ${unknown.join(', ')}` }
  }

  const capacity = asNumber(body.capacity)
  const budgetUsd = asNumber(body.budgetUsd ?? body.budget_usd ?? body.budget)
  const horizonDays = asNumber(body.horizonDays ?? body.horizon_days) ?? 4000

  if (capacity !== null && capacity < 1) return { error: '"capacity" must be at least 1' }
  if (budgetUsd !== null && budgetUsd <= 0) return { error: '"budget" must be positive' }

  if (targets.length > 30) {
    warnings.push('large target sets increase solve time; consider narrowing the market list')
  }

  return {
    options: { asset, targetMarketIds: targets, capacity, budgetUsd, horizonDays },
    warnings,
  }
}
