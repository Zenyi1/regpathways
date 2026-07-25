import type { NextRequest } from 'next/server'
import { KB } from '@/lib/data'
import { PRICING_MARKETS, mfnBasket, type MfnPolicy } from '@/lib/data/pricing'
import { computePricing, sweepLaunchSets, DEFAULT_MFN, DEFAULT_NPV } from '@/lib/solver/pricing'
import { solve } from '@/lib/solver/pareto'
import { apiError, json, preflight } from '@/lib/api/respond'
import { parseSolveRequest } from '@/lib/api/solve-request'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return preflight()
}

function readPolicy(source: Record<string, unknown>): MfnPolicy {
  const raw = (source.mfn ?? {}) as Record<string, unknown>
  const mode = String(raw.mode ?? DEFAULT_MFN.mode)
  return {
    enabled: raw.enabled === undefined ? DEFAULT_MFN.enabled : Boolean(raw.enabled),
    mode: (['threshold', 'generous', 'globe_guard'].includes(mode)
      ? mode
      : 'threshold') as MfnPolicy['mode'],
    gdpThresholdPct: Number(raw.gdpThresholdPct ?? DEFAULT_MFN.gdpThresholdPct),
    exposure: Number(raw.exposure ?? DEFAULT_MFN.exposure),
  }
}

async function handle(body: Record<string, unknown>) {
  const parsed = parseSolveRequest(body)
  if ('error' in parsed) return apiError(parsed.error, 422)

  const regulatory = solve(KB, parsed.options)
  if (regulatory.frontier.length === 0) {
    return apiError('no feasible regulatory sequence for these targets', 422, regulatory.unreachable)
  }

  // price against the fastest plan: earlier approval means more selling years
  const plan = regulatory.frontier[0]
  const approvalDays = new Map<string, number>()
  for (const step of plan.plan) approvalDays.set(step.marketId, step.finishDay)

  const mfn = readPolicy(body)
  const useRebates = body.useConfidentialRebates === undefined
    ? true
    : Boolean(body.useConfidentialRebates)

  const candidates = PRICING_MARKETS.filter((m) => approvalDays.has(m.approvalVia)).map((m) => m.id)
  if (candidates.length === 0) {
    return apiError('none of the approved markets have pricing data', 422)
  }

  const scenarios = sweepLaunchSets(approvalDays, candidates, { mfn, npv: DEFAULT_NPV, useConfidentialRebates: useRebates })

  const profitMax = scenarios.reduce((a, b) => (b.npvUsd > a.npvUsd ? b : a))
  const launchAll = scenarios[scenarios.length - 1]

  /** how much access you can buy for a given share of peak NPV. */
  const accessAtTolerance = [0.1, 0.25, 0.5].map((tol) => {
    const best = scenarios
      .filter((s) => s.npvUsd >= profitMax.npvUsd * (1 - tol))
      .reduce((a, b) => (b.accessPatientYears > a.accessPatientYears ? b : a), profitMax)
    return {
      giveUpToPct: tol * 100,
      markets: best.launchedCount,
      npvUsdM: Math.round(best.npvUsd / 1e5) / 10,
      patientYearsM: Math.round(best.accessPatientYears),
    }
  })

  /** the steepest single-market drop — the MFN cliff, located explicitly. */
  let cliff: { atMarket: number; dropUsdM: number; dropPct: number; trigger: string | null } | null = null
  for (let i = 1; i < scenarios.length; i++) {
    const drop = scenarios[i - 1].npvUsd - scenarios[i].npvUsd
    if (drop > 0 && (!cliff || drop / 1e6 > cliff.dropUsdM)) {
      cliff = {
        atMarket: scenarios[i].launchedCount,
        dropUsdM: Math.round(drop / 1e5) / 10,
        dropPct: Math.round((drop / scenarios[i - 1].npvUsd) * 1000) / 10,
        trigger: scenarios[i].mfnBindingMarket,
      }
    }
  }

  const detail = computePricing({
    approvalDays,
    launchSet: new Set(profitMax.launchSet),
    mfn,
    useConfidentialRebates: useRebates,
  })

  const withheld = candidates.filter((c) => !profitMax.launchSet.includes(c))

  return json(
    {
      ok: true,
      asset: parsed.options.asset,
      mfnPolicy: { ...mfn, basket: mfnBasket(mfn) },
      npvAssumptions: DEFAULT_NPV,
      useConfidentialRebates: useRebates,
      regulatoryPlan: {
        makespanMonths: Math.round((plan.makespanDays / 30.4) * 10) / 10,
        filingCostUsd: plan.costUsd,
      },
      strategies: {
        profitMax: {
          ...profitMax,
          withheldFrom: withheld,
          npvUsdM: Math.round(profitMax.npvUsd / 1e5) / 10,
        },
        launchEverywhere: { ...launchAll, npvUsdM: Math.round(launchAll.npvUsd / 1e5) / 10 },
      },
      mfnCliff: cliff,
      accessAtTolerance,
      /** the cost of full access, which is the number worth arguing about */
      accessTradeoff: {
        npvGivenUpUsdM: Math.round((profitMax.npvUsd - launchAll.npvUsd) / 1e5) / 10,
        npvGivenUpPct:
          profitMax.npvUsd > 0
            ? Math.round(((profitMax.npvUsd - launchAll.npvUsd) / profitMax.npvUsd) * 1000) / 10
            : 0,
        // populations are already in millions, so this is millions of patient-years
        extraPatientYearsM: Math.round(
          launchAll.accessPatientYears - profitMax.accessPatientYears,
        ),
      },
      /** non-monotone by construction: adding a market can destroy value */
      npvCurve: scenarios.map((s) => ({
        markets: s.launchedCount,
        priceFloor: s.priceFloor,
        npvUsdM: Math.round(s.npvUsd / 1e5) / 10,
        usNetPrice: Math.round(s.usNetPrice * 10) / 10,
        mfnBindingMarket: s.mfnBindingMarket,
        accessPatientYearsM: Math.round(s.accessPatientYears),
      })),
      pricingDetail: detail.markets
        .filter((m) => m.launched)
        .map((m) => ({
          id: m.id,
          name: m.name,
          freePrice: m.freePrice,
          listPrice: Math.round(m.listPrice * 10) / 10,
          netPrice: Math.round(m.netPrice * 10) / 10,
          erosion: Math.round(m.erosion * 10) / 10,
          inMfnBasket: m.inMfnBasket,
          referencedFrom: m.constrainedBy,
          launchMonth: m.launchDay === null ? null : Math.round((m.launchDay / 30.4) * 10) / 10,
        })),
      notes: [
        'Reference pricing propagates on list prices; NPV accrues on net prices. Confidential rebates keep the two apart.',
        'Belgium, Italy and Poland request net prices, so a discount there escapes into other baskets.',
        'MFN is proposed policy, not settled law. Every parameter here is an input, not a fact.',
      ],
    },
    { cache: 'no-store' },
  )
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return apiError('request body must be valid JSON', 400)
  }
  return handle(body)
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const body: Record<string, unknown> = {}
  if (q.get('assetId')) body.assetId = q.get('assetId')
  if (q.get('targets')) body.targets = q.get('targets')
  if (q.get('useConfidentialRebates')) body.useConfidentialRebates = q.get('useConfidentialRebates') === 'true'
  body.mfn = {
    enabled: q.get('mfn') !== 'false',
    mode: q.get('mfnMode') ?? DEFAULT_MFN.mode,
    gdpThresholdPct: Number(q.get('mfnThreshold') ?? DEFAULT_MFN.gdpThresholdPct),
    exposure: Number(q.get('mfnExposure') ?? DEFAULT_MFN.exposure),
  }
  return handle(body)
}
