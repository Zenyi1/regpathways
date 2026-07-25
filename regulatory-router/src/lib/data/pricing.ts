/**
 * Regulatory markets and pricing markets are not the same thing. One EU centralised
 * approval is followed by 27 separate pricing negotiations, each with its own external
 * reference basket. So pricing lives in its own table, keyed to whichever regulatory
 * market grants the approval.
 */

export type ErpFormula = 'lowest' | 'mean' | 'mean_of_3_lowest' | 'median' | 'none'

export interface PricingMarket {
  id: string
  name: string
  /** regulatory market whose approval unlocks launch here. */
  approvalVia: string
  /** brand-originator price index, US = 100. */
  priceIndex: number
  /** share of global branded revenue, 0-1. */
  revenueWeight: number
  gdpPerCapitaPctUs: number
  oecdMember: boolean
  /** external reference basket: which markets this one looks at when setting price. */
  erpBasket: string[]
  erpFormula: ErpFormula
  /** days between approval and price/reimbursement decision. */
  htaLagDays: number
  /** whether a confidential net rebate is available, letting list price stay high. */
  confidentialRebate: boolean
  /** markets that ask for net rather than list prices — the leak points. */
  requestsNetPrice: boolean
  confidence: 'high' | 'medium' | 'low'
  sourceUrl: string
  note?: string
}

const EU = 'EU'

export const PRICING_MARKETS: PricingMarket[] = [
  {
    id: 'US', name: 'United States', approvalVia: 'US',
    priceIndex: 100, revenueWeight: 0.52, gdpPerCapitaPctUs: 100, oecdMember: true,
    // the MFN basket is computed from the threshold, not hardcoded here
    erpBasket: [], erpFormula: 'none', htaLagDays: 30,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'high', sourceUrl: 'https://www.whitehouse.gov/presidential-actions/2025/05/delivering-most-favored-nation-prescription-drug-pricing-to-american-patients/',
    note: 'MFN policy is proposed, not finalised. Treat as a scenario parameter.',
  },

  // ---- EU member states: one approval, many prices ----
  {
    id: 'DE', name: 'Germany', approvalVia: EU,
    priceIndex: 25.8, revenueWeight: 0.045, gdpPerCapitaPctUs: 76, oecdMember: true,
    erpBasket: [], erpFormula: 'none', htaLagDays: 190,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'high', sourceUrl: 'https://www.insideeulifesciences.com/2024/07/12/germany-amends-drug-pricing-and-reimbursement-laws-with-medical-research-act-drug-pricing-becomes-intertwined-with-local-clinical-research-expectations/',
    note: 'Abolished its own external referencing in 2024. Free pricing for six months, then AMNOG. Confidential price available from 2025 for an extra 9% discount, and Germany is referenced by 12-17 other countries.',
  },
  {
    id: 'FR', name: 'France', approvalVia: EU,
    priceIndex: 22.5, revenueWeight: 0.032, gdpPerCapitaPctUs: 66, oecdMember: true,
    erpBasket: ['DE', 'IT', 'ES', 'UK'], erpFormula: 'lowest', htaLagDays: 500,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://www.simon-kucher.com/en/node/4612',
    note: 'Accord Cadre guarantees a list price at least the lowest of the four for ASMR I-III.',
  },
  {
    id: 'IT', name: 'Italy', approvalVia: EU,
    priceIndex: 28.2, revenueWeight: 0.022, gdpPerCapitaPctUs: 62, oecdMember: true,
    erpBasket: ['DE', 'FR', 'ES', 'UK'], erpFormula: 'lowest', htaLagDays: 430,
    confidentialRebate: true, requestsNetPrice: true,
    confidence: 'medium', sourceUrl: 'https://portolano.it/en/blog/life-sciences/reimbursement-and-pricing-of-medicines-aifas-new-rules-effective-1-april-2026-',
    note: 'Requests net prices, a leak point in an otherwise opaque system.',
  },
  {
    id: 'ES', name: 'Spain', approvalVia: EU,
    priceIndex: 23.0, revenueWeight: 0.017, gdpPerCapitaPctUs: 57, oecdMember: true,
    erpBasket: ['DE', 'FR', 'IT', 'PT'], erpFormula: 'lowest', htaLagDays: 480,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4802694/',
  },
  {
    id: 'NL', name: 'Netherlands', approvalVia: EU,
    priceIndex: 26.0, revenueWeight: 0.011, gdpPerCapitaPctUs: 85, oecdMember: true,
    erpBasket: ['BE', 'FR', 'NO', 'UK'], erpFormula: 'mean', htaLagDays: 300,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'high', sourceUrl: 'https://www.taylorwessing.com/synapse/ti-lower-maximum-prices.html',
    note: 'Binding maximum price. Germany was swapped for Norway in the basket in 2020.',
  },
  {
    id: 'BE', name: 'Belgium', approvalVia: EU,
    priceIndex: 25.0, revenueWeight: 0.008, gdpPerCapitaPctUs: 75, oecdMember: true,
    erpBasket: ['DE', 'FR', 'IT', 'ES', 'NL', 'AT', 'PT', 'GR'], erpFormula: 'mean', htaLagDays: 330,
    confidentialRebate: true, requestsNetPrice: true,
    confidence: 'medium', sourceUrl: 'https://www.globallegalinsights.com/practice-areas/pricing-reimbursement-laws-and-regulations/belgium/',
    note: 'Averages across the EU states where a price exists, and requests net prices.',
  },
  {
    id: 'AT', name: 'Austria', approvalVia: EU,
    priceIndex: 27.0, revenueWeight: 0.006, gdpPerCapitaPctUs: 78, oecdMember: true,
    erpBasket: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'PT', 'GR', 'CZ', 'PL'], erpFormula: 'mean', htaLagDays: 280,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'high', sourceUrl: 'https://ppri.goeg.at/system/files/inline-files/PPRI_Pharma_Brief_AT_2023_bf.pdf',
    note: 'Arithmetic mean of ex-factory prices across all EU states where marketed.',
  },
  {
    id: 'PT', name: 'Portugal', approvalVia: EU,
    priceIndex: 20.0, revenueWeight: 0.004, gdpPerCapitaPctUs: 52, oecdMember: true,
    erpBasket: ['ES', 'FR', 'IT', 'SI'], erpFormula: 'mean', htaLagDays: 840,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://pharmaboardroom.com/legal-reports/market-access-health-technology-assesment-portugal/',
    note: 'Binding maximum, basket redefined annually. Slowest availability in the EFPIA W.A.I.T. index at 840 days.',
  },
  {
    id: 'GR', name: 'Greece', approvalVia: EU,
    priceIndex: 18.0, revenueWeight: 0.004, gdpPerCapitaPctUs: 44, oecdMember: true,
    erpBasket: ['DE', 'FR', 'IT', 'ES', 'PT', 'AT', 'BE', 'NL'], erpFormula: 'mean_of_3_lowest', htaLagDays: 600,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://remapconsulting.com/international-reference-pricing/eu-and-uk-reference-pricing-considerations-guide/',
    note: 'Reprices every three months, the most frequent in Europe. Named by the EFPIA root-cause report as a structural barrier to launch.',
  },
  {
    id: 'CZ', name: 'Czechia', approvalVia: EU,
    priceIndex: 19.0, revenueWeight: 0.004, gdpPerCapitaPctUs: 58, oecdMember: true,
    erpBasket: ['DE', 'FR', 'IT', 'ES', 'PT', 'GR', 'PL', 'AT'], erpFormula: 'mean_of_3_lowest', htaLagDays: 400,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://www.pharmaceutical-technology.com/pricing-and-market-access/reference-pricing-cee-countries-pressure-prices-html/',
    note: 'In the GLOBE/GUARD MFN basket despite being structurally low-priced.',
  },
  {
    id: 'PL', name: 'Poland', approvalVia: EU,
    priceIndex: 17.0, revenueWeight: 0.006, gdpPerCapitaPctUs: 50, oecdMember: true,
    erpBasket: ['DE', 'FR', 'IT', 'ES', 'CZ', 'GR', 'PT'], erpFormula: 'lowest', htaLagDays: 450,
    confidentialRebate: true, requestsNetPrice: true,
    confidence: 'medium', sourceUrl: 'https://www.pharmaceutical-technology.com/pricing-and-market-access/reference-pricing-cee-countries-pressure-prices-html/',
    note: 'Requests net prices, a leak point.',
  },
  {
    id: 'BG', name: 'Bulgaria', approvalVia: EU,
    priceIndex: 15.0, revenueWeight: 0.001, gdpPerCapitaPctUs: 40, oecdMember: false,
    erpBasket: ['BE', 'FR', 'GR', 'IT', 'RO', 'SK', 'SI', 'ES'], erpFormula: 'lowest', htaLagDays: 500,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://www.pharmaceutical-technology.com/pricing-and-market-access/reference-pricing-cee-countries-pressure-prices-html/',
    note: 'Hard lowest-price cap across ten countries. Also named by EFPIA as a structural launch barrier.',
  },
  {
    id: 'RO', name: 'Romania', approvalVia: EU,
    priceIndex: 15.0, revenueWeight: 0.002, gdpPerCapitaPctUs: 42, oecdMember: false,
    erpBasket: ['BG', 'CZ', 'GR', 'IT', 'ES', 'PL', 'SK'], erpFormula: 'lowest', htaLagDays: 500,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://www.pharmaceutical-technology.com/pricing-and-market-access/reference-pricing-cee-countries-pressure-prices-html/',
  },
  {
    id: 'SE', name: 'Sweden', approvalVia: EU,
    priceIndex: 27.0, revenueWeight: 0.006, gdpPerCapitaPctUs: 78, oecdMember: true,
    erpBasket: [], erpFormula: 'none', htaLagDays: 250,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4802694/',
    note: 'Value-based, no binding external referencing.',
  },
  {
    id: 'DK', name: 'Denmark', approvalVia: EU,
    priceIndex: 28.0, revenueWeight: 0.004, gdpPerCapitaPctUs: 85, oecdMember: true,
    erpBasket: ['DE', 'FR', 'NL', 'SE', 'AT', 'BE'], erpFormula: 'mean', htaLagDays: 260,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4802694/',
  },
  {
    id: 'IE', name: 'Ireland', approvalVia: EU,
    priceIndex: 26.0, revenueWeight: 0.003, gdpPerCapitaPctUs: 130, oecdMember: true,
    erpBasket: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'DK'], erpFormula: 'mean', htaLagDays: 400,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4802694/',
  },
  {
    id: 'NO', name: 'Norway', approvalVia: EU,
    priceIndex: 27.0, revenueWeight: 0.003, gdpPerCapitaPctUs: 105, oecdMember: true,
    erpBasket: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'DK', 'SE'], erpFormula: 'mean_of_3_lowest', htaLagDays: 280,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://remapconsulting.com/international-reference-pricing/eu-and-uk-reference-pricing-considerations-guide/',
  },

  // ---- non-EU ----
  {
    id: 'UK', name: 'United Kingdom', approvalVia: 'UK',
    priceIndex: 26.0, revenueWeight: 0.022, gdpPerCapitaPctUs: 68, oecdMember: true,
    erpBasket: [], erpFormula: 'none', htaLagDays: 300,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'high', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4802694/',
    note: 'No external referencing of its own, but referenced by 13-17 other countries.',
  },
  {
    id: 'CH', name: 'Switzerland', approvalVia: 'CH',
    priceIndex: 30.0, revenueWeight: 0.01, gdpPerCapitaPctUs: 110, oecdMember: true,
    erpBasket: ['AT', 'BE', 'DK', 'FI', 'FR', 'DE', 'NL', 'SE', 'UK'], erpFormula: 'mean', htaLagDays: 180,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'high', sourceUrl: 'https://www.bag.admin.ch/en/prices-of-medicines-in-switzerland-faqs',
    note: 'Two-thirds weight on the foreign average, one-third on domestic therapeutic comparison.',
  },
  {
    id: 'CA', name: 'Canada', approvalVia: 'CA',
    priceIndex: 30.9, revenueWeight: 0.02, gdpPerCapitaPctUs: 72, oecdMember: true,
    erpBasket: ['AU', 'BE', 'FR', 'DE', 'IT', 'JP', 'NL', 'NO', 'ES', 'SE', 'UK'], erpFormula: 'median', htaLagDays: 450,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'high', sourceUrl: 'https://www.mccarthy.ca/en/insights/blogs/techlex/federal-court-appeal-upholds-new-list-pmprb-comparator-countries',
    note: 'PMPRB11. The US and Switzerland were removed in 2022 and the removal was upheld on appeal.',
  },
  {
    id: 'JP', name: 'Japan', approvalVia: 'JP',
    priceIndex: 21.6, revenueWeight: 0.04, gdpPerCapitaPctUs: 60, oecdMember: true,
    erpBasket: ['US', 'UK', 'DE', 'FR'], erpFormula: 'mean', htaLagDays: 90,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://www.jstage.jst.go.jp/article/iken/19/1/19_1_5/_article/-char/en',
    note: 'Foreign Average Price adjustment applies when the Japanese price deviates by 25% or more, in either direction.',
  },
  {
    id: 'KR', name: 'South Korea', approvalVia: 'KR',
    priceIndex: 23.7, revenueWeight: 0.014, gdpPerCapitaPctUs: 62, oecdMember: true,
    erpBasket: ['US', 'UK', 'DE', 'FR', 'IT', 'CH', 'JP'], erpFormula: 'mean', htaLagDays: 270,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11113548/',
    note: 'The A7 basket. In the GLOBE/GUARD MFN basket.',
  },
  {
    id: 'AU', name: 'Australia', approvalVia: 'AU',
    priceIndex: 24.0, revenueWeight: 0.012, gdpPerCapitaPctUs: 75, oecdMember: true,
    erpBasket: [], erpFormula: 'none', htaLagDays: 330,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://www.pbs.gov.au/',
  },
  {
    id: 'IL', name: 'Israel', approvalVia: 'IL',
    priceIndex: 24.0, revenueWeight: 0.004, gdpPerCapitaPctUs: 66, oecdMember: true,
    erpBasket: ['DE', 'FR', 'NL', 'BE', 'UK'], erpFormula: 'mean', htaLagDays: 365,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://barlaw.co.il/',
  },
  {
    id: 'TR', name: 'Türkiye', approvalVia: 'TR',
    priceIndex: 9.7, revenueWeight: 0.004, gdpPerCapitaPctUs: 45, oecdMember: true,
    erpBasket: ['FR', 'GR', 'IT', 'PT', 'ES'], erpFormula: 'lowest', htaLagDays: 400,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'high', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5081695/',
    note: 'Lowest of five deliberately low-priced EU markets, converted at a government-fixed rate below market FX.',
  },
  {
    id: 'BR', name: 'Brazil', approvalVia: 'BR',
    priceIndex: 20.0, revenueWeight: 0.02, gdpPerCapitaPctUs: 30, oecdMember: false,
    erpBasket: ['ZA', 'DE', 'AU', 'CA', 'ES', 'US', 'FR', 'GR', 'IT', 'JP', 'MX', 'NO', 'PT', 'UK'], erpFormula: 'lowest', htaLagDays: 300,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://www.soutocorrea.com.br/en/client-alerts/cmed-publishes-new-regulatory-framework-for-pricing-medicines-in-brazil/',
    note: 'CMED basket expanded from 9 to 14 in 2025. Requires marketing in at least four reference countries.',
  },
  {
    id: 'MX', name: 'Mexico', approvalVia: 'MX',
    priceIndex: 24.9, revenueWeight: 0.009, gdpPerCapitaPctUs: 35, oecdMember: true,
    erpBasket: ['US', 'CA', 'FR', 'DE', 'UK', 'ES'], erpFormula: 'mean', htaLagDays: 180,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://www.lexology.com/library/detail.aspx?g=4ae967b9-e758-40f2-99c4-15df6bcd1e33',
  },
  {
    id: 'SA', name: 'Saudi Arabia', approvalVia: 'SA',
    priceIndex: 30.0, revenueWeight: 0.006, gdpPerCapitaPctUs: 55, oecdMember: false,
    erpBasket: ['AU', 'AT', 'BE', 'BR', 'CA', 'FR', 'IT', 'JP', 'NL', 'PT', 'ZA', 'KR', 'SE', 'CH', 'UK'], erpFormula: 'median', htaLagDays: 150,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://www.sciencedirect.com/science/article/pii/S2212109926000142',
    note: 'Basket narrowed from 30 markets pre-2021 to about 16 by 2022.',
  },
  {
    id: 'JO', name: 'Jordan', approvalVia: 'JO',
    priceIndex: 16.0, revenueWeight: 0.001, gdpPerCapitaPctUs: 15, oecdMember: false,
    erpBasket: ['SA', 'DE', 'FR', 'IT', 'ES', 'GR'], erpFormula: 'lowest', htaLagDays: 120,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'medium', sourceUrl: 'https://applications.emro.who.int/dsaf/dsa786.pdf',
    note: 'Takes the minimum of four benchmarks, one of which is explicitly the Saudi public price, so KSA cascades straight into Jordan.',
  },
  {
    id: 'ZA', name: 'South Africa', approvalVia: 'ZA',
    priceIndex: 14.0, revenueWeight: 0.003, gdpPerCapitaPctUs: 23, oecdMember: false,
    erpBasket: [], erpFormula: 'none', htaLagDays: 180,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://www.sahpra.org.za/',
  },
  {
    id: 'IN', name: 'India', approvalVia: 'IN',
    priceIndex: 12.0, revenueWeight: 0.017, gdpPerCapitaPctUs: 16, oecdMember: false,
    erpBasket: [], erpFormula: 'none', htaLagDays: 120,
    confidentialRebate: false, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://www.nppaindia.nic.in/',
  },
  {
    id: 'CN', name: 'China', approvalVia: 'CN',
    priceIndex: 18.0, revenueWeight: 0.073, gdpPerCapitaPctUs: 35, oecdMember: false,
    erpBasket: [], erpFormula: 'none', htaLagDays: 365,
    confidentialRebate: true, requestsNetPrice: false,
    confidence: 'low', sourceUrl: 'https://www.nhsa.gov.cn/',
    note: 'NRDL negotiation rather than external referencing.',
  },
]

export const PRICING_BY_ID = new Map(PRICING_MARKETS.map((p) => [p.id, p]))

/**
 * MFN scenario parameters. The May 2025 executive order contains no formula; the
 * 60%-of-US-GDP-per-capita OECD rule comes from the HHS announcement and is
 * operationalised in the CMMI models, which name concrete baskets.
 */
export interface MfnPolicy {
  enabled: boolean
  mode: 'threshold' | 'generous' | 'globe_guard'
  /** GDP per capita as a percentage of the US, for threshold mode. */
  gdpThresholdPct: number
  /** fraction of US revenue exposed to the MFN price. */
  exposure: number
}

export const GENEROUS_BASKET = ['CA', 'DK', 'FR', 'DE', 'IT', 'JP', 'CH', 'UK']

export const GLOBE_GUARD_BASKET = [
  'AU', 'AT', 'BE', 'CA', 'CZ', 'DK', 'FR', 'DE', 'IE', 'IL',
  'IT', 'JP', 'NL', 'NO', 'KR', 'ES', 'SE', 'CH', 'UK',
]

/**
 * exposure defaults to 0.25 because GLOBE is proposed as a geographically phased model
 * covering roughly a quarter of Part B fee-for-service beneficiaries. It is the single
 * most sensitive parameter in the whole pricing model, so it is an input, not a constant.
 */
export const DEFAULT_MFN: MfnPolicy = {
  enabled: true,
  mode: 'threshold',
  gdpThresholdPct: 60,
  exposure: 0.25,
}

export function mfnBasket(policy: MfnPolicy): string[] {
  if (!policy.enabled) return []
  if (policy.mode === 'generous') return GENEROUS_BASKET
  if (policy.mode === 'globe_guard') return GLOBE_GUARD_BASKET
  return PRICING_MARKETS.filter(
    (m) => m.id !== 'US' && m.oecdMember && m.gdpPerCapitaPctUs >= policy.gdpThresholdPct,
  ).map((m) => m.id)
}

/** NPV assumptions, all exposed as inputs because the sensitivity is the point. */
export interface NpvAssumptions {
  discountRate: number
  exclusivityYears: number
  /** global branded revenue for an asset at full uptake, USD per year. */
  peakAnnualRevenueUsd: number
}

export const DEFAULT_NPV: NpvAssumptions = {
  discountRate: 0.09,
  exclusivityYears: 12,
  peakAnnualRevenueUsd: 1_000_000_000,
}
