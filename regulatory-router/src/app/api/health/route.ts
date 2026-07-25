import { KB, validateKnowledgeBase } from '@/lib/data'
import { json, preflight } from '@/lib/api/respond'

export function OPTIONS() {
  return preflight()
}

export async function GET() {
  const issues = validateKnowledgeBase()
  const errors = issues.filter((i) => i.severity === 'error')
  return json(
    {
      status: errors.length === 0 ? 'ok' : 'degraded',
      counts: {
        markets: KB.markets.length,
        routes: KB.routes.length,
        authorities: KB.authorities.length,
        programs: KB.programs.length,
      },
      validation: { errors: errors.length, warnings: issues.length - errors.length },
    },
    { status: errors.length === 0 ? 200 : 500, cache: 'no-store' },
  )
}
