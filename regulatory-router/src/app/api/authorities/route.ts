import { KB } from '@/lib/data'
import { json, preflight } from '@/lib/api/respond'

export function OPTIONS() {
  return preflight()
}

export async function GET() {
  return json({
    count: KB.authorities.length,
    note:
      'WHO-Listed Authority scopes are modular by product category, so a `wla` reference set resolves to different authorities depending on the asset.',
    authorities: KB.authorities.map((a) => ({
      ...a,
      referencedByRoutes: KB.routes.filter(
        (r) => r.prereq.kind === 'kOf' && r.prereq.set.kind === 'named' && r.prereq.set.authorities.includes(a.id),
      ).length,
    })),
  })
}
