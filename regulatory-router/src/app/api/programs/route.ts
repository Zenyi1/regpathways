import { KB } from '@/lib/data'
import { json, preflight } from '@/lib/api/respond'

export function OPTIONS() {
  return preflight()
}

export async function GET() {
  return json({
    count: KB.programs.length,
    programs: KB.programs.map((p) => {
      const routes = KB.routes.filter((r) => r.programId === p.id)
      return {
        ...p,
        routeCount: routes.length,
        markets: [...new Set(routes.map((r) => r.marketId))],
        typicalDurationDays: routes.length
          ? Math.round(routes.reduce((s, r) => s + r.durationDays, 0) / routes.length)
          : null,
      }
    }),
  })
}
