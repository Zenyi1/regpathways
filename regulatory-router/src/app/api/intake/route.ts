import type { NextRequest } from 'next/server'
import { parseDrugDescription, refineWithModel } from '@/lib/api/intake'
import { apiError, json, preflight } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return preflight()
}

async function handle(text: string) {
  if (!text.trim()) return apiError('provide a description in "text" or "drug"', 422)
  const base = parseDrugDescription(text)
  const result = await refineWithModel(text, base)
  return json(
    {
      ok: true,
      input: text,
      asset: result.asset,
      matchedDrug: result.matchedDrug,
      suggestedTargets: result.targets,
      targetSet: result.targetSet,
      detected: result.detected,
      assumptions: result.assumptions,
      basis: result.basis,
      modelUsed: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    { cache: 'no-store' },
  )
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  return handle(q.get('text') ?? q.get('description') ?? q.get('drug') ?? '')
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { drug?: string; text?: string }
    return handle(body.drug ?? body.text ?? '')
  } catch {
    return apiError('request body must be valid JSON', 400)
  }
}
