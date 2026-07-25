import { NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function json<T>(data: T, init?: { status?: number; cache?: string }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      ...CORS,
      'Cache-Control': init?.cache ?? 'public, max-age=60, stale-while-revalidate=600',
    },
  })
}

export function apiError(message: string, status = 400, detail?: unknown) {
  return NextResponse.json(
    { error: message, ...(detail === undefined ? {} : { detail }) },
    { status, headers: { ...CORS, 'Cache-Control': 'no-store' } },
  )
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export const OPTIONS = preflight
