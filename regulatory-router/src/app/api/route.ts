import { json, preflight } from '@/lib/api/respond'

export function OPTIONS() {
  return preflight()
}

export async function GET() {
  return json({
    name: 'Regulatory Pathway Router API',
    description:
      'Computes the filing sequence that covers a set of target markets, exploiting reliance pathways where an approval by one regulator unlocks a faster route in another.',
    endpoints: [
      {
        path: '/api/solve',
        methods: ['GET', 'POST'],
        description:
          'The main endpoint. Returns the time/cost Pareto frontier of filing sequences, each with a fully scheduled plan.',
        body: {
          assetId: 'string: a preset id from /api/assets (or provide "asset" inline)',
          asset: 'object: { name, modality, kind, indication, orphan, whoEoiEligible, priorityReviewGrade }',
          targets: 'string[]: market ids from /api/markets',
          capacity: 'number | null: max concurrent submissions; omit for unlimited',
          budgetUsd: 'number | null: hard spend ceiling',
          horizonDays: 'number: planning horizon, default 4000',
        },
        examples: [
          '/api/solve?assetId=onc-biologic&targets=US,EU,JP,UK,CA,AU,SG,BR,SA',
          '/api/solve?assetId=hiv-small-molecule&targets=KE,UG,TZ,RW,ZA,NG,PH&budget=400000',
          '/api/solve?indication=oncology&kind=biologic&priorityReviewGrade=true&targets=US,EU,AU',
        ],
      },
      {
        path: '/api/markets',
        methods: ['GET'],
        description: 'Markets with price index, MFN basket membership and route counts.',
        query: {
          region: 'filter by region',
          anchor: 'true to list only reference regulators',
          modality: 'drug | device | ivd (default drug)',
          q: 'free-text search over name, regulator and id',
          mfnThreshold: 'GDP-per-capita percentage of the US that puts a market in the MFN basket (default 60)',
        },
      },
      {
        path: '/api/routes',
        methods: ['GET'],
        description: 'Every way into every market, with its prerequisite expressed in plain language.',
        query: {
          market: 'market id',
          program: 'program id',
          confidence: 'high | medium | low',
          modality: 'drug | device | ivd',
          assetId: 'filter to routes this asset is actually eligible for',
          reliance: 'true to exclude standalone filings',
        },
      },
      { path: '/api/programs', methods: ['GET'], description: 'Multilateral schemes: Orbis, Access Consortium, EU-M4all, WHO PQ and CRP, MAGHP, ZaZiBoNa, MDSAP.' },
      { path: '/api/authorities', methods: ['GET'], description: 'Reference authorities with ICH membership and WHO-Listed Authority scopes.' },
      { path: '/api/assets', methods: ['GET'], description: 'Asset archetypes, each with the routes and programs it can actually reach.' },
      { path: '/api/health', methods: ['GET'], description: 'Knowledge-base counts and seed-time validation status.' },
    ],
    notes: [
      'Durations are agency clocks in calendar days. Real elapsed time is routinely 1.5-3x longer.',
      'Timings are time-to-approval, not time-to-patient. Reimbursement and HTA are modelled separately as htaLagDays.',
      'Every route carries a confidence level and a source URL. Low-confidence rows are estimates.',
    ],
  })
}
