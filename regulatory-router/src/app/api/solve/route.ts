import type { NextRequest } from 'next/server'
import { solveEnriched } from '@/lib/api/enrich'
import { apiError, json, preflight } from '@/lib/api/respond'
import { parseSolveRequest } from '@/lib/api/solve-request'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return preflight()
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return apiError('request body must be valid JSON', 400)
  }

  const parsed = parseSolveRequest(body)
  if ('error' in parsed) return apiError(parsed.error, 422)

  try {
    return json(solveEnriched(parsed.options, parsed.warnings), { cache: 'no-store' })
  } catch (err) {
    return apiError('solver failed', 500, err instanceof Error ? err.message : String(err))
  }
}

/** query-string form so the API is usable straight from a browser or curl. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const body: Record<string, unknown> = {}

  if (q.get('assetId')) body.assetId = q.get('assetId')
  if (q.get('targets')) body.targets = q.get('targets')
  if (q.get('capacity')) body.capacity = q.get('capacity')
  if (q.get('budget')) body.budget = q.get('budget')
  if (q.get('horizonDays')) body.horizonDays = q.get('horizonDays')

  // inline asset via flat query params, for quick experiments
  if (!body.assetId && (q.get('indication') || q.get('kind'))) {
    body.asset = {
      name: q.get('name') ?? 'Custom asset',
      modality: q.get('modality') ?? 'drug',
      kind: q.get('kind') ?? 'nce',
      indication: q.get('indication') ?? 'other',
      orphan: q.get('orphan') ?? false,
      whoEoiEligible: q.get('whoEoiEligible') ?? false,
      priorityReviewGrade: q.get('priorityReviewGrade') ?? false,
    }
  }

  const parsed = parseSolveRequest(body)
  if ('error' in parsed) return apiError(parsed.error, 422)

  try {
    return json(solveEnriched(parsed.options, parsed.warnings), { cache: 'no-store' })
  } catch (err) {
    return apiError('solver failed', 500, err instanceof Error ? err.message : String(err))
  }
}
