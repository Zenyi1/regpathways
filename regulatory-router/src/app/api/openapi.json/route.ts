import type { NextRequest } from 'next/server'
import { buildOpenApiSpec } from '@/lib/api/openapi'
import { json, preflight } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return preflight()
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  return json(buildOpenApiSpec('/api', origin), { cache: 'public, max-age=300' })
}
