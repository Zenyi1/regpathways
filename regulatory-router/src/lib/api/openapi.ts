/**
 * OpenAPI 3.1 description of the router API. Takes a base path so the same spec serves
 * the standalone app (/api) and the mount inside the First Ocean site (/api/regulation).
 */

const ASSET_SCHEMA = {
  type: 'object',
  description: 'A pharmaceutical asset. Eligibility gates mean these fields change which routes exist at all, not merely their ranking.',
  properties: {
    name: { type: 'string', example: 'Anti-PD-1 monoclonal antibody' },
    modality: { type: 'string', enum: ['drug', 'device', 'ivd'], default: 'drug' },
    kind: {
      type: 'string',
      enum: ['nce', 'biologic', 'vaccine', 'generic', 'biosimilar', 'atmp', 'blood_product', 'device'],
      default: 'nce',
    },
    indication: {
      type: 'string',
      enum: ['oncology', 'hiv', 'tuberculosis', 'malaria', 'maternal_newborn', 'infectious_disease', 'rare_disease', 'cardiovascular', 'diabetes', 'neurology', 'other'],
    },
    orphan: { type: 'boolean', default: false },
    whoEoiEligible: {
      type: 'boolean',
      default: false,
      description: 'Whether an active WHO Expression of Interest covers this category. Gates WHO Prequalification, EU-M4all and the PQ-based CRP.',
    },
    priorityReviewGrade: {
      type: 'boolean',
      default: false,
      description: 'Required for Project Orbis and for accelerated national routes.',
    },
  },
  required: ['modality', 'kind', 'indication'],
} as const

const STEP_SCHEMA = {
  type: 'object',
  properties: {
    marketId: { type: 'string', example: 'AU' },
    market: { type: 'string', example: 'Australia' },
    regulator: { type: 'string', example: 'TGA' },
    region: { type: 'string' },
    routeId: { type: 'string', example: 'AU-ORBIS-C' },
    route: { type: 'string', example: 'Project Orbis Type C (post-FDA reliance)' },
    program: { type: ['string', 'null'], example: 'FDA Project Orbis' },
    startDay: { type: 'integer' },
    finishDay: { type: 'integer' },
    startMonth: { type: 'number' },
    finishMonth: { type: 'number' },
    costUsd: { type: 'number' },
    reliesOn: {
      type: 'array',
      items: { type: 'string' },
      description: 'Reference authorities whose approval this filing leans on.',
      example: ['FDA'],
    },
    role: { type: 'string', enum: ['target', 'enabler'], description: 'An enabler is filed only because it unlocks other markets.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    sourceUrl: { type: 'string', format: 'uri' },
    note: { type: 'string' },
  },
} as const

const POINT_SCHEMA = {
  type: 'object',
  properties: {
    makespanDays: { type: 'integer' },
    makespanMonths: { type: 'number' },
    costUsd: { type: 'number' },
    anchors: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: STEP_SCHEMA },
  },
} as const

export function buildOpenApiSpec(basePath: string, origin?: string) {
  const server = origin ? `${origin}${basePath}` : basePath

  return {
    openapi: '3.1.0',
    info: {
      title: 'Regulatory Pathway Router API',
      version: '1.0.0',
      description: [
        'Computes the filing sequence that covers a set of target markets, exploiting **reliance pathways** — where approval by one regulator unlocks a faster, cheaper route in another.',
        '',
        '38 markets, 125 routes, 9 multilateral programmes (Project Orbis, Access Consortium, EU-M4all, WHO Prequalification and its Collaborative Registration Procedure, Swissmedic MAGHP, ZaZiBoNa, MDSAP).',
        '',
        '### Reading the numbers honestly',
        '- Durations are **agency clocks in calendar days**. Real elapsed time runs 1.5–3× longer.',
        '- These are times to **approval, not to patient**. Reimbursement is a separate clock, exposed as `htaLagDays`.',
        '- Every route carries a `confidence` level and a `sourceUrl`. Rows marked `low` are estimates, not published figures.',
        '- MFN pricing is **proposed policy, not settled law**. Every pricing parameter is an input you can move.',
        '',
        '### No authentication',
        'All endpoints are public and CORS-open. No API key is required.',
      ].join('\n'),
    },
    servers: [{ url: server, description: 'This deployment' }],
    tags: [
      { name: 'Pathway', description: 'The main solver endpoints.' },
      { name: 'Pricing', description: 'Reference pricing, Most Favoured Nation, NPV and access.' },
      { name: 'Reference data', description: 'The underlying knowledge base.' },
    ],
    paths: {
      '/pathway': {
        get: {
          tags: ['Pathway'],
          summary: 'Describe a drug, get a pathway',
          description:
            'The one-call endpoint. Free text in, recommended filing sequence out. Everything the parser inferred is echoed back under `interpretation` so you can see and correct it.',
          parameters: [
            { name: 'drug', in: 'query', required: true, schema: { type: 'string' }, example: 'a monoclonal antibody for metastatic NSCLC' },
            { name: 'targets', in: 'query', schema: { type: 'string' }, description: 'Comma-separated market ids. Omit to use the set inferred from the description.', example: 'US,EU,JP,UK' },
            { name: 'capacity', in: 'query', schema: { type: 'integer' }, description: 'Maximum concurrent submissions. Omit for unlimited.' },
            { name: 'budget', in: 'query', schema: { type: 'number' }, description: 'Hard spend ceiling in USD.' },
          ],
          responses: { '200': { description: 'Recommended pathway with interpretation', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolveResponse' } } } }, '422': { $ref: '#/components/responses/Invalid' } },
        },
        post: {
          tags: ['Pathway'],
          summary: 'Describe a drug, get a pathway',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    drug: { type: 'string', example: 'a paediatric TB formulation for sub-Saharan Africa' },
                    targets: { type: 'array', items: { type: 'string' } },
                    capacity: { type: ['integer', 'null'] },
                    budgetUsd: { type: ['number', 'null'] },
                  },
                  required: ['drug'],
                },
              },
            },
          },
          responses: { '200': { description: 'Recommended pathway', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolveResponse' } } } }, '422': { $ref: '#/components/responses/Invalid' } },
        },
      },

      '/solve': {
        get: {
          tags: ['Pathway'],
          summary: 'Solve for a structured asset',
          description:
            'Returns the full time/cost Pareto frontier plus a single `recommended` plan (the compromise point closest to the ideal corner once time and cost are normalised).',
          parameters: [
            { name: 'assetId', in: 'query', schema: { type: 'string' }, description: 'A preset id from /assets.', example: 'onc-biologic' },
            { name: 'targets', in: 'query', required: true, schema: { type: 'string' }, example: 'US,EU,JP,UK,CA,AU,SG,BR,SA' },
            { name: 'indication', in: 'query', schema: { type: 'string' }, description: 'Inline asset: used when assetId is absent.' },
            { name: 'kind', in: 'query', schema: { type: 'string' } },
            { name: 'priorityReviewGrade', in: 'query', schema: { type: 'boolean' } },
            { name: 'capacity', in: 'query', schema: { type: 'integer' } },
            { name: 'budget', in: 'query', schema: { type: 'number' } },
          ],
          responses: { '200': { description: 'Pareto frontier', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolveResponse' } } } }, '422': { $ref: '#/components/responses/Invalid' } },
        },
        post: {
          tags: ['Pathway'],
          summary: 'Solve for a structured asset',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    assetId: { type: 'string', description: 'A preset id, or provide `asset` inline.' },
                    asset: ASSET_SCHEMA,
                    targets: { type: 'array', items: { type: 'string' }, example: ['US', 'EU', 'JP', 'UK', 'CA', 'AU'] },
                    capacity: { type: ['integer', 'null'], description: 'Max concurrent submissions.' },
                    budgetUsd: { type: ['number', 'null'] },
                    horizonDays: { type: 'integer', default: 4000 },
                  },
                  required: ['targets'],
                },
              },
            },
          },
          responses: { '200': { description: 'Pareto frontier', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolveResponse' } } } }, '422': { $ref: '#/components/responses/Invalid' } },
        },
      },

      '/intake': {
        get: {
          tags: ['Pathway'],
          summary: 'Parse a free-text drug description',
          description:
            'Deterministic keyword parsing over closed vocabularies — reliable and inspectable. If `ANTHROPIC_API_KEY` is configured it is used only to fill fields the parser could not resolve, never to override a match or invent a timing.',
          parameters: [{ name: 'drug', in: 'query', required: true, schema: { type: 'string' }, example: 'a paediatric TB formulation for sub-Saharan Africa' }],
          responses: {
            '200': {
              description: 'Structured asset and suggested markets',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      asset: ASSET_SCHEMA,
                      suggestedTargets: { type: 'array', items: { type: 'string' } },
                      targetSet: { type: 'string', enum: ['commercial', 'global', 'lmic'] },
                      detected: { type: 'array', items: { type: 'string' }, description: 'Fields the parser found evidence for.' },
                      assumptions: { type: 'array', items: { type: 'string' }, description: 'Where it had to guess.' },
                      modelUsed: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/pricing': {
        get: {
          tags: ['Pricing'],
          summary: 'Reference pricing, MFN and NPV',
          description: [
            'Propagates external reference prices in descending price order, applies the Most Favoured Nation peg, and sweeps launch breadth to find the profit-maximising market set.',
            '',
            'The NPV curve is **non-monotone by construction**: adding a market can destroy value once it trips the MFN reference. `mfnCliff` locates the steepest such drop.',
            '',
            'Reference pricing propagates on **list** prices while revenue accrues on **net** prices; confidential rebates keep the two apart.',
          ].join('\n'),
          parameters: [
            { name: 'assetId', in: 'query', schema: { type: 'string' }, example: 'onc-biologic' },
            { name: 'targets', in: 'query', required: true, schema: { type: 'string' }, example: 'US,EU,JP,UK,CA,AU,CH,BR,MX,SA,KR' },
            { name: 'mfn', in: 'query', schema: { type: 'boolean', default: true }, description: 'Set false to switch MFN off entirely.' },
            { name: 'mfnMode', in: 'query', schema: { type: 'string', enum: ['threshold', 'generous', 'globe_guard'], default: 'threshold' }, description: 'threshold computes the basket from GDP per capita; generous and globe_guard use the named CMMI baskets (8 and 19 countries).' },
            { name: 'mfnThreshold', in: 'query', schema: { type: 'number', default: 60 }, description: 'GDP per capita as a percentage of the US. 60 is the operative HHS definition.' },
            { name: 'mfnExposure', in: 'query', schema: { type: 'number', default: 0.25 }, description: 'Share of US revenue bound by the MFN price. The single most sensitive parameter in the model.' },
            { name: 'useConfidentialRebates', in: 'query', schema: { type: 'boolean', default: true } },
          ],
          responses: { '200': { description: 'Pricing outcome', content: { 'application/json': { schema: { $ref: '#/components/schemas/PricingResponse' } } } }, '422': { $ref: '#/components/responses/Invalid' } },
        },
        post: {
          tags: ['Pricing'],
          summary: 'Reference pricing, MFN and NPV',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    assetId: { type: 'string' },
                    asset: ASSET_SCHEMA,
                    targets: { type: 'array', items: { type: 'string' } },
                    useConfidentialRebates: { type: 'boolean', default: true },
                    mfn: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean', default: true },
                        mode: { type: 'string', enum: ['threshold', 'generous', 'globe_guard'] },
                        gdpThresholdPct: { type: 'number', default: 60 },
                        exposure: { type: 'number', default: 0.25 },
                      },
                    },
                  },
                  required: ['targets'],
                },
              },
            },
          },
          responses: { '200': { description: 'Pricing outcome', content: { 'application/json': { schema: { $ref: '#/components/schemas/PricingResponse' } } } }, '422': { $ref: '#/components/responses/Invalid' } },
        },
      },

      '/markets': {
        get: {
          tags: ['Reference data'],
          summary: 'Markets',
          description: 'Every market with its price index, MFN basket membership and route count.',
          parameters: [
            { name: 'region', in: 'query', schema: { type: 'string' }, example: 'Africa' },
            { name: 'anchor', in: 'query', schema: { type: 'boolean' }, description: 'Only reference regulators.' },
            { name: 'modality', in: 'query', schema: { type: 'string', enum: ['drug', 'device', 'ivd'], default: 'drug' } },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Free-text search over name, regulator and id.' },
            { name: 'mfnThreshold', in: 'query', schema: { type: 'number', default: 60 } },
          ],
          responses: { '200': { description: 'Market list', content: { 'application/json': { schema: { type: 'object' } } } } },
        },
      },

      '/routes': {
        get: {
          tags: ['Reference data'],
          summary: 'Routes',
          description:
            'Every way into every market, with its prerequisite rendered in plain language — for example *2 of [FDA, EMA, HC, MHRA, SWISSMEDIC, TGA] approval, within 3 year(s)*.',
          parameters: [
            { name: 'market', in: 'query', schema: { type: 'string' }, example: 'SG' },
            { name: 'program', in: 'query', schema: { type: 'string' }, example: 'ORBIS' },
            { name: 'confidence', in: 'query', schema: { type: 'string', enum: ['high', 'medium', 'low'] } },
            { name: 'modality', in: 'query', schema: { type: 'string', enum: ['drug', 'device', 'ivd'] } },
            { name: 'assetId', in: 'query', schema: { type: 'string' }, description: 'Filter to routes this asset is actually eligible for.' },
            { name: 'reliance', in: 'query', schema: { type: 'boolean' }, description: 'true excludes standalone filings.' },
          ],
          responses: { '200': { description: 'Route list', content: { 'application/json': { schema: { type: 'object' } } } } },
        },
      },

      '/programs': { get: { tags: ['Reference data'], summary: 'Multilateral programmes', responses: { '200': { description: 'Programme list', content: { 'application/json': { schema: { type: 'object' } } } } } } },
      '/authorities': { get: { tags: ['Reference data'], summary: 'Reference authorities', description: 'ICH membership and WHO-Listed Authority scopes. WLA listings are modular by product category, so a `wla` reference set resolves differently per asset.', responses: { '200': { description: 'Authority list', content: { 'application/json': { schema: { type: 'object' } } } } } } },
      '/assets': { get: { tags: ['Reference data'], summary: 'Asset archetypes', description: 'Presets, each with the routes and programmes it can actually reach.', responses: { '200': { description: 'Preset list', content: { 'application/json': { schema: { type: 'object' } } } } } } },
      '/health': { get: { tags: ['Reference data'], summary: 'Health and validation', responses: { '200': { description: 'Counts and validation status', content: { 'application/json': { schema: { type: 'object' } } } } } } },
    },

    components: {
      responses: {
        Invalid: {
          description: 'Invalid request — unknown market ids, unknown preset, or a malformed asset.',
          content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' }, detail: {} } } } },
        },
      },
      schemas: {
        Asset: ASSET_SCHEMA,
        PlanStep: STEP_SCHEMA,
        FrontierPoint: POINT_SCHEMA,
        SolveResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            interpretation: {
              type: 'object',
              description: 'Present on /pathway only: what the parser understood from the description.',
              properties: {
                asset: ASSET_SCHEMA,
                detected: { type: 'array', items: { type: 'string' } },
                assumptions: { type: 'array', items: { type: 'string' } },
                targets: { type: 'array', items: { type: 'string' } },
              },
            },
            recommendedIndex: { type: 'integer' },
            recommended: POINT_SCHEMA,
            summary: {
              type: 'object',
              properties: {
                frontierPoints: { type: 'integer' },
                fastest: { type: 'object', properties: { makespanMonths: { type: 'number' }, costUsd: { type: 'number' } } },
                cheapest: { type: 'object', properties: { makespanMonths: { type: 'number' }, costUsd: { type: 'number' } } },
                lowerBoundMonths: { type: 'number', description: 'Uncapacitated makespan. With a capacity limit, the gap to the returned makespan is the optimality gap.' },
                naiveBaseline: { type: ['object', 'null'], description: 'The same targets filed standalone, with no reliance.' },
                savingsVsNaive: { type: ['object', 'null'], properties: { costUsd: { type: 'number' }, costPct: { type: 'number' }, months: { type: 'number' } } },
                confidenceMix: { type: 'object', properties: { high: { type: 'integer' }, medium: { type: 'integer' }, low: { type: 'integer' } } },
              },
            },
            frontier: { type: 'array', items: POINT_SCHEMA },
            unreachable: {
              type: 'array',
              description: 'Present when no plan covers every target — names which market failed and why.',
              items: { type: 'object', properties: { marketId: { type: 'string' }, reason: { type: 'string' } } },
            },
            elapsedMs: { type: 'integer' },
          },
        },
        PricingResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            mfnPolicy: { type: 'object', properties: { enabled: { type: 'boolean' }, mode: { type: 'string' }, gdpThresholdPct: { type: 'number' }, exposure: { type: 'number' }, basket: { type: 'array', items: { type: 'string' } } } },
            strategies: {
              type: 'object',
              properties: {
                profitMax: { type: 'object', description: 'The NPV-maximising launch set, and which markets it withholds from.' },
                launchEverywhere: { type: 'object' },
              },
            },
            mfnCliff: { type: ['object', 'null'], description: 'The steepest single-market NPV drop and the market that triggers it.', properties: { atMarket: { type: 'integer' }, dropUsdM: { type: 'number' }, dropPct: { type: 'number' }, trigger: { type: ['string', 'null'] } } },
            accessAtTolerance: { type: 'array', description: 'How much access a given share of forgone NPV buys.', items: { type: 'object' } },
            accessTradeoff: { type: 'object', properties: { npvGivenUpUsdM: { type: 'number' }, npvGivenUpPct: { type: 'number' }, extraPatientYearsM: { type: 'number' } } },
            npvCurve: { type: 'array', items: { type: 'object', properties: { markets: { type: 'integer' }, npvUsdM: { type: 'number' }, usNetPrice: { type: 'number' }, mfnBindingMarket: { type: ['string', 'null'] }, accessPatientYearsM: { type: 'number' } } } },
            pricingDetail: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, freePrice: { type: 'number' }, listPrice: { type: 'number' }, netPrice: { type: 'number' }, erosion: { type: 'number' }, inMfnBasket: { type: 'boolean' }, referencedFrom: { type: 'array', items: { type: 'string' } } } } },
          },
        },
      },
    },
  }
}
