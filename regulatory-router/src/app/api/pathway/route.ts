import type { NextRequest } from 'next/server'
import { solveEnriched } from '@/lib/api/enrich'
import { parseDrugDescription, refineWithModel } from '@/lib/api/intake'
import { apiError, json, preflight } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return preflight()
}

/**
 * One call: a drug description in, the recommended filing pathway out. Everything the
 * parser inferred is echoed back so the caller can see and correct it.
 */
async function handle(text: string, overrides: { targets?: string[]; capacity?: number | null; budgetUsd?: number | null }) {
  if (!text.trim()) return apiError('provide a description in "text" or "drug"', 422)

  const base = parseDrugDescription(text)
  const intake = await refineWithModel(text, base)
  const targets = overrides.targets?.length ? overrides.targets : intake.targets

  const solved = solveEnriched({
    asset: intake.asset,
    targetMarketIds: targets,
    capacity: overrides.capacity ?? null,
    budgetUsd: overrides.budgetUsd ?? null,
    horizonDays: 4000,
  })

  return json(
    {
      interpretation: {
        asset: intake.asset,
        matchedDrug: intake.matchedDrug,
        detected: intake.detected,
        assumptions: intake.assumptions,
        basis: intake.basis,
        targetSet: intake.targetSet,
        targets,
      },
      ...solved,
    },
    { cache: 'no-store' },
  )
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const targetsParam = q.get('targets')
  return handle(q.get('text') ?? q.get('description') ?? q.get('drug') ?? '', {
    targets: targetsParam ? targetsParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    capacity: q.get('capacity') ? Number(q.get('capacity')) : null,
    budgetUsd: q.get('budget') ? Number(q.get('budget')) : null,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      drug?: string
      text?: string
      description?: string
      targets?: string[]
      capacity?: number | null
      budgetUsd?: number | null
    }
    return handle(body.text ?? body.description ?? body.drug ?? '', {
      targets: body.targets,
      capacity: body.capacity ?? null,
      budgetUsd: body.budgetUsd ?? null,
    })
  } catch {
    return apiError('request body must be valid JSON', 400)
  }
}
