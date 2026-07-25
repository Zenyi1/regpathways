import type { Component, Confidence, Market } from '../solver/types'

const BASE_COMPONENTS: Component[] = ['dossier', 'gmp_audit', 'labelling']

interface MarketSpec {
  id: string
  name: string
  regulator: string
  authorityId: string
  region: string
  isAnchor?: boolean
  populationM: number
  /** local gmp / site-inspection burden in days. the residual bottleneck in several markets. */
  gmpDays?: number
  labellingDays?: number
  lotRelease?: boolean
  priceIndex: number | null
  revenueWeight: number
  gdpPerCapitaPctUs: number | null
  oecdMember?: boolean
  htaLagDays: number
  confidence: Confidence
  sourceUrl?: string
}

function build(spec: MarketSpec): Market {
  const components = [...BASE_COMPONENTS]
  if (spec.lotRelease) components.push('lot_release')
  return {
    id: spec.id,
    name: spec.name,
    regulator: spec.regulator,
    authorityId: spec.authorityId,
    region: spec.region,
    isAnchor: spec.isAnchor ?? false,
    populationM: spec.populationM,
    requiredComponents: components,
    localComponentDays: {
      dossier: 0,
      gmp_audit: spec.gmpDays ?? 90,
      labelling: spec.labellingDays ?? 30,
      ...(spec.lotRelease ? { lot_release: 60 } : {}),
    },
    priceIndex: spec.priceIndex,
    revenueWeight: spec.revenueWeight,
    gdpPerCapitaPctUs: spec.gdpPerCapitaPctUs,
    oecdMember: spec.oecdMember ?? false,
    htaLagDays: spec.htaLagDays,
    confidence: spec.confidence,
    sourceUrl: spec.sourceUrl,
  }
}

/**
 * price index is brand-originator, us = 100, derived from RAND RRA788-3 (2022 data).
 * where RAND does not publish a country we fall back to the 33-OECD brand average of
 * 23.7 for oecd members, or a lower estimate for lmics — flagged as low confidence.
 *
 * gdpPerCapitaPctUs is approximate ppp-based and exists to drive the MFN 60% threshold
 * predicate, not to be quoted as a statistic.
 */
const SPECS: MarketSpec[] = [
  // ---- anchors / reference authorities ----
  { id: 'US', name: 'United States', regulator: 'FDA', authorityId: 'FDA', region: 'North America', isAnchor: true, populationM: 335, priceIndex: 100, revenueWeight: 0.52, gdpPerCapitaPctUs: 100, oecdMember: true, htaLagDays: 30, confidence: 'high', sourceUrl: 'https://www.federalregister.gov/documents/2025/07/30/2025-14413/prescription-drug-user-fee-rates-for-fiscal-year-2026' },
  { id: 'EU', name: 'European Union (centralised)', regulator: 'EMA', authorityId: 'EMA', region: 'Europe', isAnchor: true, populationM: 448, lotRelease: true, priceIndex: 25.5, revenueWeight: 0.17, gdpPerCapitaPctUs: 72, oecdMember: true, htaLagDays: 400, confidence: 'high', sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory-overview/marketing-authorisation/evaluation-medicines-step-step' },
  { id: 'JP', name: 'Japan', regulator: 'PMDA', authorityId: 'PMDA', region: 'Asia-Pacific', isAnchor: true, populationM: 124, priceIndex: 21.6, revenueWeight: 0.04, gdpPerCapitaPctUs: 60, oecdMember: true, htaLagDays: 90, confidence: 'medium', sourceUrl: 'https://www.pmda.go.jp/' },
  { id: 'UK', name: 'United Kingdom', regulator: 'MHRA', authorityId: 'MHRA', region: 'Europe', isAnchor: true, populationM: 68, priceIndex: 26.0, revenueWeight: 0.022, gdpPerCapitaPctUs: 68, oecdMember: true, htaLagDays: 300, confidence: 'high', sourceUrl: 'https://www.gov.uk/government/publications/international-recognition-procedure/international-recognition-procedure-supplementary-information' },
  { id: 'CA', name: 'Canada', regulator: 'Health Canada', authorityId: 'HC', region: 'North America', isAnchor: true, populationM: 40, priceIndex: 30.9, revenueWeight: 0.02, gdpPerCapitaPctUs: 72, oecdMember: true, htaLagDays: 450, confidence: 'high', sourceUrl: 'https://www.canada.ca/en/health-canada/services/drugs-health-products/ministerial-reliance-order.html' },
  { id: 'CH', name: 'Switzerland', regulator: 'Swissmedic', authorityId: 'SWISSMEDIC', region: 'Europe', isAnchor: true, populationM: 9, priceIndex: 30.0, revenueWeight: 0.01, gdpPerCapitaPctUs: 110, oecdMember: true, htaLagDays: 180, confidence: 'medium', sourceUrl: 'https://www.swissmedic.ch/swissmedic/en/home/services/documents/faq-art-13.html' },
  { id: 'AU', name: 'Australia', regulator: 'TGA', authorityId: 'TGA', region: 'Asia-Pacific', isAnchor: true, populationM: 27, priceIndex: 24.0, revenueWeight: 0.012, gdpPerCapitaPctUs: 75, oecdMember: true, htaLagDays: 330, confidence: 'high', sourceUrl: 'https://www.tga.gov.au/products/medicines/prescription-medicines/application-and-market-authorisation/supply-prescription-medicine/application-process-prescription-medicines/comparable-overseas-regulators/comparable-overseas-regulators-cors-timeframes-and-milestones' },
  { id: 'SG', name: 'Singapore', regulator: 'HSA', authorityId: 'HSA', region: 'Asia-Pacific', isAnchor: true, populationM: 6, priceIndex: 28.0, revenueWeight: 0.003, gdpPerCapitaPctUs: 105, oecdMember: false, htaLagDays: 180, confidence: 'high', sourceUrl: 'https://www.hsa.gov.sg/therapeutic-products/registration-of-therapeutic-products/register-your-therapeutic-product/registration-of-therapeutic-products/evaluation-routes/' },
  { id: 'WHOPQ', name: 'WHO Prequalification', regulator: 'WHO', authorityId: 'WHO', region: 'Global', isAnchor: true, populationM: 0, gmpDays: 120, priceIndex: null, revenueWeight: 0, gdpPerCapitaPctUs: null, htaLagDays: 0, confidence: 'high', sourceUrl: 'https://extranet.who.int/prequal/' },
  // an eu-m4all opinion is not an eu marketing authorisation, but it is an ema-grade
  // assessment and is an accepted reference for the who collaborative registration
  // procedure. modelling it as a separate market sharing the EMA authority lets the
  // solver reach the same downstream unlocks without implying an eu launch.
  { id: 'EUM4ALL', name: 'EU-M4all (EMA scientific opinion)', regulator: 'EMA', authorityId: 'EMA', region: 'Global', isAnchor: true, populationM: 0, priceIndex: null, revenueWeight: 0, gdpPerCapitaPctUs: null, htaLagDays: 0, confidence: 'high', sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory-overview/marketing-authorisation/medicines-use-outside-european-union' },

  // ---- asia-pacific reliance markets ----
  { id: 'KR', name: 'South Korea', regulator: 'MFDS', authorityId: 'MFDS', region: 'Asia-Pacific', populationM: 52, gmpDays: 240, priceIndex: 23.7, revenueWeight: 0.014, gdpPerCapitaPctUs: 62, oecdMember: true, htaLagDays: 270, confidence: 'medium' },
  { id: 'MY', name: 'Malaysia', regulator: 'NPRA', authorityId: 'NPRA', region: 'Asia-Pacific', populationM: 34, priceIndex: 20, revenueWeight: 0.002, gdpPerCapitaPctUs: 40, htaLagDays: 180, confidence: 'medium' },
  { id: 'TH', name: 'Thailand', regulator: 'Thai FDA', authorityId: 'THAIFDA', region: 'Asia-Pacific', populationM: 72, priceIndex: 18, revenueWeight: 0.003, gdpPerCapitaPctUs: 30, htaLagDays: 240, confidence: 'medium' },
  { id: 'PH', name: 'Philippines', regulator: 'FDA Philippines', authorityId: 'PHFDA', region: 'Asia-Pacific', populationM: 117, priceIndex: 16, revenueWeight: 0.002, gdpPerCapitaPctUs: 17, htaLagDays: 180, confidence: 'high' },
  { id: 'ID', name: 'Indonesia', regulator: 'BPOM', authorityId: 'BPOM', region: 'Asia-Pacific', populationM: 279, priceIndex: 15, revenueWeight: 0.004, gdpPerCapitaPctUs: 22, htaLagDays: 180, confidence: 'medium' },
  { id: 'VN', name: 'Vietnam', regulator: 'DAV', authorityId: 'DAV', region: 'Asia-Pacific', populationM: 100, priceIndex: 14, revenueWeight: 0.002, gdpPerCapitaPctUs: 20, htaLagDays: 180, confidence: 'medium' },
  { id: 'IN', name: 'India', regulator: 'CDSCO', authorityId: 'CDSCO', region: 'Asia-Pacific', populationM: 1430, gmpDays: 150, priceIndex: 12, revenueWeight: 0.017, gdpPerCapitaPctUs: 16, htaLagDays: 120, confidence: 'medium' },
  { id: 'CN', name: 'China', regulator: 'NMPA', authorityId: 'NMPA', region: 'Asia-Pacific', populationM: 1410, gmpDays: 300, priceIndex: 18, revenueWeight: 0.073, gdpPerCapitaPctUs: 35, htaLagDays: 365, confidence: 'medium' },
  { id: 'TW', name: 'Taiwan', regulator: 'TFDA', authorityId: 'TFDA', region: 'Asia-Pacific', populationM: 23, priceIndex: 22, revenueWeight: 0.004, gdpPerCapitaPctUs: 75, htaLagDays: 240, confidence: 'medium' },

  // ---- middle east ----
  { id: 'SA', name: 'Saudi Arabia', regulator: 'SFDA', authorityId: 'SFDA', region: 'Middle East', populationM: 37, priceIndex: 30, revenueWeight: 0.006, gdpPerCapitaPctUs: 55, htaLagDays: 150, confidence: 'high', sourceUrl: 'https://www.sfda.gov.sa/sites/default/files/2024-05/VerificationAbridgedProcess22.pdf' },
  { id: 'AE', name: 'United Arab Emirates', regulator: 'EDE', authorityId: 'EDE', region: 'Middle East', populationM: 10, priceIndex: 32, revenueWeight: 0.003, gdpPerCapitaPctUs: 85, htaLagDays: 150, confidence: 'low' },
  { id: 'JO', name: 'Jordan', regulator: 'JFDA', authorityId: 'JFDA', region: 'Middle East', populationM: 11, priceIndex: 16, revenueWeight: 0.001, gdpPerCapitaPctUs: 15, htaLagDays: 120, confidence: 'medium' },
  { id: 'IL', name: 'Israel', regulator: 'Israel MoH', authorityId: 'MOHIL', region: 'Middle East', populationM: 10, priceIndex: 24, revenueWeight: 0.004, gdpPerCapitaPctUs: 66, oecdMember: true, htaLagDays: 365, confidence: 'medium' },
  { id: 'TR', name: 'Türkiye', regulator: 'TİTCK', authorityId: 'TITCK', region: 'Europe', populationM: 86, gmpDays: 400, priceIndex: 9.7, revenueWeight: 0.004, gdpPerCapitaPctUs: 45, oecdMember: true, htaLagDays: 400, confidence: 'medium' },

  // ---- latin america ----
  { id: 'BR', name: 'Brazil', regulator: 'ANVISA', authorityId: 'ANVISA', region: 'Latin America', populationM: 216, priceIndex: 20, revenueWeight: 0.02, gdpPerCapitaPctUs: 30, htaLagDays: 300, confidence: 'high', sourceUrl: 'https://www.demarest.com.br/en/anvisa-approves-regulations-on-using-analyses-by-equivalent-foreign-regulatory-authorities-reliance/' },
  { id: 'MX', name: 'Mexico', regulator: 'COFEPRIS', authorityId: 'COFEPRIS', region: 'Latin America', populationM: 129, priceIndex: 24.9, revenueWeight: 0.009, gdpPerCapitaPctUs: 35, oecdMember: true, htaLagDays: 180, confidence: 'high', sourceUrl: 'https://sidof.segob.gob.mx/notas/docFuente/5585043' },
  { id: 'CO', name: 'Colombia', regulator: 'INVIMA', authorityId: 'INVIMA', region: 'Latin America', populationM: 52, priceIndex: 18, revenueWeight: 0.003, gdpPerCapitaPctUs: 22, oecdMember: true, htaLagDays: 240, confidence: 'low' },
  { id: 'CL', name: 'Chile', regulator: 'ISP', authorityId: 'ISP', region: 'Latin America', populationM: 20, priceIndex: 20, revenueWeight: 0.002, gdpPerCapitaPctUs: 40, oecdMember: true, htaLagDays: 240, confidence: 'low' },
  { id: 'PE', name: 'Peru', regulator: 'DIGEMID', authorityId: 'DIGEMID', region: 'Latin America', populationM: 34, priceIndex: 16, revenueWeight: 0.001, gdpPerCapitaPctUs: 20, htaLagDays: 180, confidence: 'medium' },
  { id: 'AR', name: 'Argentina', regulator: 'ANMAT', authorityId: 'ANMAT', region: 'Latin America', populationM: 46, priceIndex: 15, revenueWeight: 0.003, gdpPerCapitaPctUs: 30, htaLagDays: 240, confidence: 'low' },

  // ---- africa ----
  { id: 'ZA', name: 'South Africa', regulator: 'SAHPRA', authorityId: 'SAHPRA', region: 'Africa', populationM: 60, priceIndex: 14, revenueWeight: 0.003, gdpPerCapitaPctUs: 23, htaLagDays: 180, confidence: 'medium', sourceUrl: 'https://www.sahpra.org.za/wp-content/uploads/2025/08/SAHPGL-BAU-01_v5-Reliance-Guideline.pdf' },
  { id: 'EG', name: 'Egypt', regulator: 'EDA', authorityId: 'EDA', region: 'Africa', populationM: 113, priceIndex: 10, revenueWeight: 0.002, gdpPerCapitaPctUs: 18, htaLagDays: 120, confidence: 'high', sourceUrl: 'https://www.edaegypt.gov.eg/media/2rydqaxz/guide-line-reliance-practices-during-registration-of-medicinal-products.pdf' },
  { id: 'NG', name: 'Nigeria', regulator: 'NAFDAC', authorityId: 'NAFDAC', region: 'Africa', populationM: 224, gmpDays: 300, priceIndex: 9, revenueWeight: 0.001, gdpPerCapitaPctUs: 12, htaLagDays: 90, confidence: 'low' },
  { id: 'KE', name: 'Kenya', regulator: 'PPB', authorityId: 'PPB', region: 'Africa', populationM: 55, priceIndex: 9, revenueWeight: 0.001, gdpPerCapitaPctUs: 10, htaLagDays: 90, confidence: 'medium' },
  { id: 'UG', name: 'Uganda', regulator: 'NDA Uganda', authorityId: 'NDA_UG', region: 'Africa', populationM: 48, priceIndex: 8, revenueWeight: 0.0005, gdpPerCapitaPctUs: 5, htaLagDays: 90, confidence: 'medium' },
  { id: 'TZ', name: 'Tanzania', regulator: 'TMDA', authorityId: 'TMDA', region: 'Africa', populationM: 67, priceIndex: 8, revenueWeight: 0.0005, gdpPerCapitaPctUs: 5, htaLagDays: 90, confidence: 'medium' },
  { id: 'RW', name: 'Rwanda', regulator: 'Rwanda FDA', authorityId: 'RWANDAFDA', region: 'Africa', populationM: 14, priceIndex: 8, revenueWeight: 0.0002, gdpPerCapitaPctUs: 4, htaLagDays: 90, confidence: 'medium' },

  // ---- eastern europe ----
  { id: 'UA', name: 'Ukraine', regulator: 'MoH Ukraine / SEC', authorityId: 'MOHUA', region: 'Europe', populationM: 38, priceIndex: 12, revenueWeight: 0.001, gdpPerCapitaPctUs: 20, htaLagDays: 120, confidence: 'medium' },
]

export const MARKETS: Market[] = SPECS.map(build)
export const MARKETS_BY_ID = new Map(MARKETS.map((m) => [m.id, m]))
