import { ASSET_PRESETS, KB, findReliancecycles, validateKnowledgeBase } from '../src/lib/data'
import { solve } from '../src/lib/solver/pareto'
import type { Asset } from '../src/lib/solver/types'

const months = (d: number) => (d / 30.4).toFixed(1)
const usd = (n: number) => `$${(n / 1e6).toFixed(2)}M`

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('=== knowledge base ===')
const issues = validateKnowledgeBase()
const errors = issues.filter((i) => i.severity === 'error')
for (const i of issues) console.log(`  [${i.severity}] ${i.message}`)
check('no validation errors', errors.length === 0, `${errors.length} errors`)
console.log(`  markets=${KB.markets.length} routes=${KB.routes.length} authorities=${KB.authorities.length}`)

const cycles = findReliancecycles()
console.log(`  reliance cycles detected: ${cycles.length} (expected, mutual recognition)`)

const TARGETS = ['US', 'EU', 'JP', 'UK', 'CA', 'AU', 'SG', 'BR', 'SA', 'ZA', 'KE', 'PH', 'MX', 'IN']

function run(asset: Asset, targets = TARGETS, capacity: number | null = null) {
  return solve(KB, {
    asset,
    targetMarketIds: targets,
    capacity,
    budgetUsd: null,
    horizonDays: 4000,
  })
}

console.log('\n=== archetypes produce different plans ===')
const byAsset = new Map<string, ReturnType<typeof run>>()
for (const asset of ASSET_PRESETS) {
  const res = run(asset)
  byAsset.set(asset.id, res)
  const best = res.frontier[0]
  const cheapest = res.frontier[res.frontier.length - 1]
  if (!best) {
    console.log(`  ${asset.name}: NO SOLUTION (${res.unreachable.map((u) => `${u.marketId}: ${u.reason}`).join(', ')})`)
    continue
  }
  console.log(
    `  ${asset.name.padEnd(42)} fastest ${months(best.makespanDays).padStart(5)} mo / ${usd(best.costUsd)}` +
      `   cheapest ${months(cheapest.makespanDays).padStart(5)} mo / ${usd(cheapest.costUsd)}   (${res.frontier.length} frontier pts)`,
  )
}

const onc = byAsset.get('onc-biologic')!
const cardio = byAsset.get('cardio-nce')!

check('every archetype solves', [...byAsset.values()].every((r) => r.frontier.length > 0))

console.log('\n=== eligibility gating ===')
const oncPlan = onc.frontier[0].plan
const cardioPlan = cardio.frontier[0].plan
check(
  'oncology asset uses Project Orbis',
  oncPlan.some((e) => e.routeId.includes('ORBIS')),
)
check(
  'cardiovascular asset gets no Orbis route',
  !cardioPlan.some((e) => e.routeId.includes('ORBIS')),
)
check(
  'oncology asset cannot use WHO PQ or EU-M4all',
  !onc.frontier.some((p) => p.plan.some((e) => e.marketId === 'WHOPQ' || e.marketId === 'EUM4ALL')),
)

console.log('\n=== flagship: LMIC-only targets should find the global-health chain ===')
const LMIC = ['KE', 'UG', 'TZ', 'RW', 'ZA', 'NG', 'PH', 'VN', 'TH', 'ID']
const lmicHiv = run(ASSET_PRESETS[1], LMIC)
const lmicOnc = run(ASSET_PRESETS[0], LMIC)
{
  const cheapest = lmicHiv.frontier[lmicHiv.frontier.length - 1]
  const enablers = cheapest.plan.filter((e) => e.isEnabler).map((e) => e.marketId)
  console.log(`  HIV asset   cheapest ${months(cheapest.makespanDays)} mo / ${usd(cheapest.costUsd)}  enablers: ${enablers.join(', ') || 'none'}`)
  const oncCheapest = lmicOnc.frontier[lmicOnc.frontier.length - 1]
  const oncEnablers = oncCheapest.plan.filter((e) => e.isEnabler).map((e) => e.marketId)
  console.log(`  Onc asset   cheapest ${months(oncCheapest.makespanDays)} mo / ${usd(oncCheapest.costUsd)}  enablers: ${oncEnablers.join(', ') || 'none'}`)

  check(
    'HIV asset routes LMIC access through EU-M4all or WHO PQ',
    cheapest.plan.some((e) => e.marketId === 'EUM4ALL' || e.marketId === 'WHOPQ'),
  )
  check(
    'oncology asset is barred from that chain and must pay for a full anchor',
    !oncCheapest.plan.some((e) => e.marketId === 'EUM4ALL' || e.marketId === 'WHOPQ'),
  )
  check(
    'the global-health chain is cheaper than the commercial one',
    cheapest.costUsd < oncCheapest.costUsd,
    `${usd(cheapest.costUsd)} vs ${usd(oncCheapest.costUsd)}`,
  )
}

console.log('\n=== frontier invariants ===')
for (const [id, res] of byAsset) {
  if (res.frontier.length < 2) continue
  let monotone = true
  for (let i = 1; i < res.frontier.length; i++) {
    if (res.frontier[i].costUsd >= res.frontier[i - 1].costUsd) monotone = false
    if (res.frontier[i].makespanDays <= res.frontier[i - 1].makespanDays) monotone = false
  }
  check(`${id}: frontier strictly pareto-minimal`, monotone)
}

console.log('\n=== capacity constraint ===')
const uncapped = run(ASSET_PRESETS[0])
const capped = run(ASSET_PRESETS[0], TARGETS, 3)
check(
  'capacity-limited makespan is not shorter than the unconstrained bound',
  capped.frontier[0].makespanDays >= uncapped.frontier[0].makespanDays,
  `capped ${months(capped.frontier[0].makespanDays)} mo vs bound ${months(uncapped.frontier[0].makespanDays)} mo`,
)

console.log('\n=== naive vs optimised ===')
{
  const asset = ASSET_PRESETS[0]
  const standaloneOnly = {
    ...KB,
    routes: KB.routes.filter((r) => r.prereq.kind === 'none'),
  }
  const naive = solve(standaloneOnly, {
    asset,
    targetMarketIds: TARGETS,
    capacity: null,
    budgetUsd: null,
    horizonDays: 4000,
  })
  const smart = run(asset)
  if (naive.frontier.length && smart.frontier.length) {
    const n = naive.frontier[naive.frontier.length - 1]
    const s = smart.frontier[smart.frontier.length - 1]
    console.log(`  naive (standalone only): ${months(n.makespanDays)} mo / ${usd(n.costUsd)}`)
    console.log(`  optimised (reliance):    ${months(s.makespanDays)} mo / ${usd(s.costUsd)}`)
    check('reliance beats standalone on cost', s.costUsd <= n.costUsd)
  } else {
    console.log('  naive baseline infeasible — some targets have no standalone route')
  }
}

console.log('\n=== sample plan (oncology biologic, fastest) ===')
for (const e of onc.frontier[0].plan.slice(0, 14)) {
  const via = e.viaAuthorities.length ? ` via ${e.viaAuthorities.join('+')}` : ''
  console.log(
    `  d${String(e.startDay).padStart(4)}-${String(e.finishDay).padStart(4)}  ${e.marketId.padEnd(8)} ${e.routeName}${via}${e.isEnabler ? '  [enabler]' : ''}`,
  )
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
