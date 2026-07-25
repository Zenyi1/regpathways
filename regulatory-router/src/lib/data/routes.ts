import type { Confidence, Modality, Program, Provenance, Route } from '../solver/types'

/** working days -> calendar days. agency clocks are quoted in both and it matters. */
const wd = (n: number) => Math.round(n * 1.4)

const SRA = ['FDA', 'EMA', 'PMDA', 'MHRA', 'HC', 'SWISSMEDIC', 'TGA'] as const
const ORBIS_PARTNERS = ['AU', 'CA', 'SG', 'CH', 'BR', 'UK', 'IL'] as const
const ACCESS_MEMBERS = ['AU', 'CA', 'SG', 'CH', 'UK'] as const
/** africa + asia markets that participate in the who collaborative registration procedure. */
const CRP_MARKETS = ['KE', 'UG', 'TZ', 'RW', 'ZA', 'NG', 'EG', 'PH', 'VN', 'TH', 'ID'] as const
const ZAZIBONA_MARKETS = ['ZA', 'TZ'] as const

export const PROGRAMS: Program[] = [
  { id: 'ORBIS', name: 'FDA Project Orbis', description: 'Concurrent oncology review with FDA across seven partner regulators. Type A files within one month of the FDA submission and reviews concurrently; Type C is pure post-approval reliance.', sourceUrl: 'https://www.fda.gov/about-fda/oncology-center-excellence/project-orbis' },
  { id: 'ACCESS', name: 'Access Consortium', description: 'Work-sharing across Australia, Canada, Singapore, Switzerland and the UK. Dossiers must reach every participating agency within a two-week window.', sourceUrl: 'https://accessconsortium.info/' },
  { id: 'EU_M4ALL', name: 'EU-M4all', description: 'EMA scientific opinion for medicines used outside the EU. Gated to HIV, TB, malaria, maternal-newborn health and priority vaccines.', sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory-overview/marketing-authorisation/medicines-use-outside-european-union' },
  { id: 'WHO_PQ', name: 'WHO Prequalification', description: 'Unlocks UN and donor procurement, and the prequalification-based collaborative registration procedure.', sourceUrl: 'https://extranet.who.int/prequal/' },
  { id: 'CRP_SRA', name: 'WHO CRP (SRA-based)', description: 'National registration relying on a shared stringent-regulator assessment. Ninety-day target; twelve to eighteen working days observed for lenacapavir.', sourceUrl: 'https://www.who.int/teams/regulation-prequalification/regulation-and-safety/facilitated-product-introduction/collaborative-registration-procedure' },
  { id: 'CRP_PQ', name: 'WHO CRP (PQ-based)', description: 'National registration relying on WHO prequalification. Requires the national dossier to be the same in all essential features.', sourceUrl: 'https://www.who.int/teams/regulation-prequalification/regulation-and-safety/facilitated-product-introduction/collaborative-registration-procedure/procedure-for-prequalified-med-vax' },
  { id: 'MAGHP', name: 'Swissmedic MAGHP', description: 'A Swiss marketing authorisation for a product that will not be marketed in Switzerland, assessed alongside invited LMIC regulators.', sourceUrl: 'https://www.swissmedic.ch/swissmedic/en/home/about-us/development-cooperation/marketing-authorisation-for-global-health-products.html' },
  { id: 'ZAZIBONA', name: 'ZaZiBoNa', description: 'SADC collaborative assessment. Requires submission to at least two member countries and runs in quarterly sessions.', sourceUrl: 'https://zazibona.com/' },
  { id: 'MDSAP', name: 'MDSAP', description: 'One quality-management-system audit accepted by the US, Canada, Brazil, Japan and Australia.', sourceUrl: 'https://www.fda.gov/medical-devices/cdrh-international-programs/medical-device-single-audit-program-mdsap' },
]

interface Spec {
  id: string
  marketId: string
  name: string
  programId?: string
  modality?: Modality
  prereq?: Route['prereq']
  prereqEvent?: 'approval' | 'submission'
  recency?: number | null
  provenance?: Provenance[]
  satisfies?: Route['satisfiesComponents']
  grants?: Provenance
  lead?: number
  days: number
  cost?: number | null
  cadence?: number | null
  eligibility?: Route['eligibility']
  confidence: Confidence
  sourceUrl: string
  note?: string
}

function r(spec: Spec): Route {
  return {
    id: spec.id,
    marketId: spec.marketId,
    name: spec.name,
    programId: spec.programId,
    modality: spec.modality ?? 'drug',
    prereq: spec.prereq ?? { kind: 'none' },
    prereqEvent: spec.prereqEvent ?? 'approval',
    prereqRecencyDays: spec.recency === undefined ? null : spec.recency,
    // most jurisdictions define their reference set over originating approvals. mexico
    // is explicit that reliance-derived, conditional and emergency approvals do not
    // qualify, which is why reliance generally cannot chain.
    prereqProvenance: spec.provenance ?? ['original'],
    satisfiesComponents: spec.satisfies ?? ['dossier'],
    grantsProvenance: spec.grants ?? 'original',
    leadTimeDays: spec.lead ?? 0,
    durationDays: spec.days,
    costUsd: spec.cost === undefined ? 150_000 : spec.cost,
    cadenceDays: spec.cadence ?? null,
    eligibility: spec.eligibility ?? {},
    confidence: spec.confidence,
    sourceUrl: spec.sourceUrl,
    note: spec.note,
  }
}

const FDA_URL = 'https://www.federalregister.gov/documents/2025/07/30/2025-14413/prescription-drug-user-fee-rates-for-fiscal-year-2026'
const CRP_URL = 'https://www.who.int/teams/regulation-prequalification/regulation-and-safety/facilitated-product-introduction/collaborative-registration-procedure'
const EAC_URL = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11442268/'

export const ROUTES: Route[] = [
  // ================= anchors, standalone =================
  r({ id: 'US-NDA', marketId: 'US', name: 'NDA/BLA standard review', days: 300, cost: 4_682_003, satisfies: ['dossier', 'gmp_audit', 'labelling'], confidence: 'high', sourceUrl: FDA_URL }),
  r({ id: 'US-NDA-PRIORITY', marketId: 'US', name: 'NDA/BLA priority review', days: 180, cost: 4_682_003, satisfies: ['dossier', 'gmp_audit', 'labelling'], eligibility: { requiresPriorityReviewGrade: true }, confidence: 'high', sourceUrl: FDA_URL }),

  r({ id: 'EU-CP', marketId: 'EU', name: 'Centralised procedure', days: 400, cost: 540_000, satisfies: ['dossier', 'gmp_audit', 'labelling', 'lot_release'], confidence: 'high', sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory-overview/marketing-authorisation/evaluation-medicines-step-step' }),
  r({ id: 'EU-CP-ACCEL', marketId: 'EU', name: 'Centralised, accelerated assessment', days: 300, cost: 540_000, satisfies: ['dossier', 'gmp_audit', 'labelling', 'lot_release'], eligibility: { requiresPriorityReviewGrade: true }, confidence: 'high', sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory-overview/marketing-authorisation/accelerated-assessment' }),

  r({ id: 'EUM4ALL-OPINION', marketId: 'EUM4ALL', name: 'EU-M4all scientific opinion', programId: 'EU_M4ALL', days: 400, lead: 210, cost: 120_000, eligibility: { requiresWhoEoi: true }, confidence: 'high', sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory-overview/marketing-authorisation/medicines-use-outside-european-union', note: 'Eligibility request is due 7-18 months before submission.' }),
  r({ id: 'EUM4ALL-ACCEL', marketId: 'EUM4ALL', name: 'EU-M4all, accelerated', programId: 'EU_M4ALL', days: 300, lead: 210, cost: 120_000, eligibility: { requiresWhoEoi: true, requiresPriorityReviewGrade: true }, confidence: 'high', sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory-overview/marketing-authorisation/medicines-use-outside-european-union' }),

  r({ id: 'JP-STD', marketId: 'JP', name: 'PMDA standard review', days: 365, cost: 400_000, confidence: 'medium', sourceUrl: 'https://www.pmda.go.jp/' }),
  r({ id: 'JP-PRIORITY', marketId: 'JP', name: 'PMDA priority review', days: 270, cost: 400_000, eligibility: { requiresPriorityReviewGrade: true }, confidence: 'medium', sourceUrl: 'https://www.pmda.go.jp/' }),

  r({ id: 'CA-NDS', marketId: 'CA', name: 'New Drug Submission', days: 300, cost: 350_000, confidence: 'high', sourceUrl: 'https://www.canada.ca/en/health-canada/services/drugs-health-products.html' }),
  r({ id: 'CA-PRIORITY', marketId: 'CA', name: 'Priority review', days: 180, cost: 350_000, eligibility: { requiresPriorityReviewGrade: true }, confidence: 'high', sourceUrl: 'https://www.canada.ca/en/health-canada/services/drugs-health-products.html' }),

  r({ id: 'CH-STD', marketId: 'CH', name: 'Swissmedic standard authorisation', days: 360, cost: 200_000, confidence: 'medium', sourceUrl: 'https://www.swissmedic.ch/' }),
  r({ id: 'CH-ART13', marketId: 'CH', name: 'Article 13 reliance procedure', days: 240, cost: 150_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'EMA'] } }, recency: 1825, confidence: 'medium', sourceUrl: 'https://www.swissmedic.ch/swissmedic/en/home/services/documents/faq-art-13.html', note: 'Requires the full unredacted foreign assessment report, no older than five years.' }),
  r({ id: 'CH-MAGHP', marketId: 'CH', name: 'MAGHP (global health products)', programId: 'MAGHP', days: 400, lead: 135, cost: 120_000, eligibility: { requiresWhoEoi: true }, confidence: 'medium', sourceUrl: 'https://www.swissmedic.ch/swissmedic/en/home/about-us/development-cooperation/marketing-authorisation-for-global-health-products.html' }),

  r({ id: 'AU-STD', marketId: 'AU', name: 'Standard prescription medicine', days: wd(220), cost: 250_000, confidence: 'high', sourceUrl: 'https://www.tga.gov.au/' }),
  r({ id: 'AU-COR-A', marketId: 'AU', name: 'Comparable Overseas Regulator route A', days: wd(120), cost: 160_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'EMA', 'HC', 'MHRA', 'SWISSMEDIC'] } }, recency: 365, confidence: 'high', sourceUrl: 'https://www.tga.gov.au/products/medicines/prescription-medicines/application-and-market-authorisation/supply-prescription-medicine/application-process-prescription-medicines/comparable-overseas-regulators/comparable-overseas-regulators-cors-timeframes-and-milestones' }),
  r({ id: 'AU-COR-B', marketId: 'AU', name: 'Comparable Overseas Regulator route B', days: wd(175), cost: 180_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'EMA', 'HC', 'MHRA', 'SWISSMEDIC'] } }, confidence: 'high', sourceUrl: 'https://www.tga.gov.au/' }),

  r({ id: 'UK-NATIONAL', marketId: 'UK', name: 'National procedure', days: 210, cost: 180_000, confidence: 'medium', sourceUrl: 'https://www.gov.uk/topic/medicines-medical-devices-blood/licensing-medicines' }),
  r({ id: 'UK-IRP-A', marketId: 'UK', name: 'International Recognition Procedure, Recognition A', days: 60, cost: 100_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['TGA', 'HC', 'EMA', 'PMDA', 'SWISSMEDIC', 'HSA', 'FDA'] } }, recency: 730, confidence: 'high', sourceUrl: 'https://www.gov.uk/government/publications/international-recognition-procedure/international-recognition-procedure-supplementary-information', note: 'No clock stop. Reference approval must be within two years.' }),
  r({ id: 'UK-IRP-B', marketId: 'UK', name: 'International Recognition Procedure, Recognition B', days: 110, cost: 120_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['TGA', 'HC', 'EMA', 'PMDA', 'SWISSMEDIC', 'HSA', 'FDA'] } }, recency: 3650, confidence: 'high', sourceUrl: 'https://www.gov.uk/government/publications/international-recognition-procedure/international-recognition-procedure-supplementary-information' }),

  r({ id: 'SG-FULL', marketId: 'SG', name: 'Full evaluation', days: wd(270), cost: 220000, confidence: 'high', sourceUrl: 'https://www.hsa.gov.sg/therapeutic-products/fees/' }),
  r({ id: 'SG-ABRIDGED', marketId: 'SG', name: 'Abridged evaluation', days: wd(180), cost: 30_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'ich' } }, confidence: 'high', sourceUrl: 'https://www.hsa.gov.sg/therapeutic-products/registration-of-therapeutic-products/register-your-therapeutic-product/registration-of-therapeutic-products/evaluation-routes/' }),
  r({ id: 'SG-VERIFICATION', marketId: 'SG', name: 'Verification evaluation', days: wd(60), cost: 45_000, prereq: { kind: 'kOf', k: 2, set: { kind: 'named', authorities: ['FDA', 'EMA', 'HC', 'MHRA', 'SWISSMEDIC', 'TGA'] } }, recency: 1095, confidence: 'high', sourceUrl: 'https://www.hsa.gov.sg/therapeutic-products/registration-of-therapeutic-products/register-your-therapeutic-product/registration-of-therapeutic-products/evaluation-routes/', note: 'Needs at least two reference agencies, each within three years.' }),

  r({ id: 'WHOPQ-FULL', marketId: 'WHOPQ', name: 'Prequalification, full assessment', programId: 'WHO_PQ', days: 270, cost: 80_000, eligibility: { requiresWhoEoi: true }, confidence: 'high', sourceUrl: 'https://extranet.who.int/prequal/vitro-diagnostics/timelines' }),
  r({ id: 'WHOPQ-ABRIDGED', marketId: 'WHOPQ', name: 'Prequalification, abridged assessment', programId: 'WHO_PQ', days: 100, cost: 60_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA] } }, eligibility: { requiresWhoEoi: true }, confidence: 'high', sourceUrl: 'https://extranet.who.int/prequal/vitro-diagnostics/timelines' }),

  // ================= project orbis =================
  ...ORBIS_PARTNERS.flatMap((marketId) => [
    r({ id: `${marketId}-ORBIS-A`, marketId, name: 'Project Orbis Type A (concurrent)', programId: 'ORBIS', days: 210, cost: 120_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA'] } }, prereqEvent: 'submission', eligibility: { indications: ['oncology'], requiresPriorityReviewGrade: true }, confidence: 'high', sourceUrl: 'https://www.fda.gov/about-fda/oncology-center-excellence/project-orbis', note: 'Filed within one month of the FDA submission; review and action run concurrently.' }),
    r({ id: `${marketId}-ORBIS-C`, marketId, name: 'Project Orbis Type C (post-FDA reliance)', programId: 'ORBIS', days: 120, cost: 90_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA'] } }, eligibility: { indications: ['oncology'] }, confidence: 'medium', sourceUrl: 'https://www.fda.gov/about-fda/oncology-center-excellence/project-orbis' }),
  ]),

  // ================= access consortium =================
  ...ACCESS_MEMBERS.map((marketId) =>
    r({ id: `${marketId}-ACCESS`, marketId, name: 'Access Consortium work-sharing', programId: 'ACCESS', days: 240, lead: 135, cost: 140_000, eligibility: { excludeAssetKinds: ['generic'] }, confidence: 'high', sourceUrl: 'https://accessconsortium.info/new-active-substance-work-sharing-assessment-procedure/', note: 'Expression of interest 3-6 months ahead; dossiers to all agencies within a two-week window.' }),
  ),

  // ================= who collaborative registration procedure =================
  ...CRP_MARKETS.flatMap((marketId) => [
    r({ id: `${marketId}-CRP-SRA`, marketId, name: 'WHO CRP (SRA-based)', programId: 'CRP_SRA', days: 90, cost: 25_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA] } }, confidence: 'medium', sourceUrl: CRP_URL, note: 'National dossier must be the same in all essential features as the reference approval.' }),
    r({ id: `${marketId}-CRP-PQ`, marketId, name: 'WHO CRP (PQ-based)', programId: 'CRP_PQ', days: 90, cost: 20_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['WHO'] } }, eligibility: { requiresWhoEoi: true }, confidence: 'high', sourceUrl: CRP_URL }),
  ]),

  // ================= zazibona =================
  ...ZAZIBONA_MARKETS.map((marketId) =>
    r({ id: `${marketId}-ZAZIBONA`, marketId, name: 'ZaZiBoNa joint assessment', programId: 'ZAZIBONA', days: 390, cadence: 90, cost: 40_000, confidence: 'medium', sourceUrl: 'https://zazibona.com/', note: 'Requires submission to at least two member states; quarterly assessment sessions.' }),
  ),

  // ================= middle east =================
  r({ id: 'SA-VERIFICATION', marketId: 'SA', name: 'SFDA verification', days: wd(30), cost: 40_000, prereq: { kind: 'kOf', k: 2, set: { kind: 'named', authorities: ['FDA', 'EMA'] } }, recency: 730, eligibility: { excludeAssetKinds: ['generic', 'atmp', 'blood_product'] }, confidence: 'high', sourceUrl: 'https://www.sfda.gov.sa/sites/default/files/2024-05/VerificationAbridgedProcess22.pdf', note: 'Requires both FDA and EMA approval. Excludes blood products, ATMPs and generics.' }),
  r({ id: 'SA-ABRIDGED', marketId: 'SA', name: 'SFDA abridged', days: wd(60), cost: 50000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'EMA'] } }, recency: 730, eligibility: { excludeAssetKinds: ['generic', 'atmp', 'blood_product'] }, confidence: 'high', sourceUrl: 'https://www.sfda.gov.sa/sites/default/files/2024-05/VerificationAbridgedProcess22.pdf' }),
  r({ id: 'SA-FULL', marketId: 'SA', name: 'SFDA full review', days: 500, cost: 260000, confidence: 'medium', sourceUrl: 'https://www.sfda.gov.sa/' }),

  r({ id: 'JO-VERIFICATION', marketId: 'JO', name: 'JFDA verification', days: 60, cost: 25_000, prereq: { kind: 'kOf', k: 2, set: { kind: 'named', authorities: ['FDA', 'EMA'] } }, confidence: 'medium', sourceUrl: 'https://www.freyrsolutions.com/what-are-jfda-verification-abridged-registration-pathways' }),
  r({ id: 'JO-ABRIDGED', marketId: 'JO', name: 'JFDA abridged', days: 90, cost: 25_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'EMA'] } }, confidence: 'medium', sourceUrl: 'https://www.freyrsolutions.com/what-are-jfda-verification-abridged-registration-pathways' }),

  r({ id: 'IL-TWO', marketId: 'IL', name: 'Two-authority recognition', days: wd(70), cost: 45_000, prereq: { kind: 'kOf', k: 2, set: { kind: 'named', authorities: ['FDA', 'EMA', 'SWISSMEDIC', 'HC', 'MHRA', 'TGA'] } }, recency: 1095, confidence: 'medium', sourceUrl: 'https://barlaw.co.il/practice_areas/regulation/healthcare-regulatory/client_updates/drug-registration-reform-in-israel-processes-are-being-streamlined-and-timeframes-shortened-to-increase-supply-and-lower-prices/', note: 'At least one reference must be FDA or EMA.' }),
  r({ id: 'IL-ONE', marketId: 'IL', name: 'Single-authority recognition', days: wd(120), cost: 45_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'EMA', 'SWISSMEDIC', 'HC', 'MHRA', 'TGA'] } }, recency: 1825, confidence: 'medium', sourceUrl: 'https://barlaw.co.il/' }),

  r({ id: 'AE-RELIANCE', marketId: 'AE', name: 'EDE reliance pathway', days: 120, cost: 40_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['EMA', 'FDA', 'MHRA', 'PMDA'] } }, confidence: 'low', sourceUrl: 'https://www.ede.gov.ae/en/home' }),
  r({ id: 'AE-STD', marketId: 'AE', name: 'EDE standard registration', days: 550, cost: 240000, confidence: 'low', sourceUrl: 'https://www.ede.gov.ae/en/home' }),

  r({ id: 'TR-STD', marketId: 'TR', name: 'TİTCK registration', days: 210, cost: 60_000, confidence: 'medium', sourceUrl: 'https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2019.01557/full', note: 'GMP inspection of foreign sites is the binding constraint, not the review clock.' }),

  r({ id: 'EG-RELIANCE-REPORT', marketId: 'EG', name: 'EDA reliance with full assessment report', days: 30, cost: 20_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'EMA'] } }, satisfies: ['dossier', 'gmp_audit'], confidence: 'high', sourceUrl: 'https://www.edaegypt.gov.eg/media/2rydqaxz/guide-line-reliance-practices-during-registration-of-medicinal-products.pdf', note: 'Products originating in reference countries are exempt from EDA manufacturer inspection.' }),
  r({ id: 'EG-RELIANCE-CTD', marketId: 'EG', name: 'EDA reliance, CTD dossier only', days: 60, cost: 20_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA, 'WHO'] } }, confidence: 'medium', sourceUrl: 'https://www.edaegypt.gov.eg/media/2rydqaxz/guide-line-reliance-practices-during-registration-of-medicinal-products.pdf' }),
  r({ id: 'EG-FULL', marketId: 'EG', name: 'EDA full review', days: 450, cost: 180000, confidence: 'medium', sourceUrl: 'https://www.edaegypt.gov.eg/' }),

  // ================= asia-pacific =================
  r({ id: 'KR-STD', marketId: 'KR', name: 'MFDS new drug application', days: 320, cost: 120_000, confidence: 'medium', sourceUrl: 'https://www.mfds.go.kr/eng/index.do', note: 'No EU-style reliance route; US sites need an MFDS GMP inspection.' }),
  r({ id: 'MY-FULL', marketId: 'MY', name: 'NPRA full evaluation', days: wd(245), cost: 170000, confidence: 'medium', sourceUrl: 'https://www.npra.gov.my/' }),
  r({ id: 'MY-ABRIDGED', marketId: 'MY', name: 'NPRA abridged evaluation', days: wd(116), cost: 25_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA] } }, confidence: 'medium', sourceUrl: 'https://www.npra.gov.my/' }),

  r({ id: 'TH-ABRIDGED', marketId: 'TH', name: 'Thai FDA abridged', days: wd(180), cost: 25_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['EMA', 'FDA', 'TGA', 'HC', 'MHRA', 'PMDA'] } }, recency: 730, confidence: 'medium', sourceUrl: 'https://www.lexology.com/library/detail.aspx?g=bb3d9be7-5b04-479d-9ecc-8d71ed45a180', note: 'Must be filed within two years of the benchmark agency approval.' }),
  r({ id: 'TH-FULL', marketId: 'TH', name: 'Thai FDA standard', days: wd(220), cost: 170000, confidence: 'medium', sourceUrl: 'https://www.fda.moph.go.th/' }),

  r({ id: 'PH-VERIFICATION', marketId: 'PH', name: 'FDA Philippines verification', days: wd(30), cost: 20_000, prereq: { kind: 'kOf', k: 2, set: { kind: 'named', authorities: [...SRA] } }, recency: 1095, confidence: 'high', sourceUrl: 'https://www.fda.gov.ph/fda-circular-no-2022-004-implementing-guidelines-on-the-abridged-and-verification-review-pathways-for-new-drug-registration-applications-in-accordance-with-administrative-order-no-2020-0045/' }),
  r({ id: 'PH-ABRIDGED', marketId: 'PH', name: 'FDA Philippines abridged', days: wd(45), cost: 20_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA] } }, recency: 1095, confidence: 'high', sourceUrl: 'https://www.fda.gov.ph/' }),
  r({ id: 'PH-FULL', marketId: 'PH', name: 'FDA Philippines standard', days: 365, cost: 160000, confidence: 'low', sourceUrl: 'https://www.fda.gov.ph/' }),

  r({ id: 'ID-RELIANCE', marketId: 'ID', name: 'BPOM reliance route', days: wd(90), cost: 25_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA] } }, confidence: 'medium', sourceUrl: 'https://www.pom.go.id/', note: 'Sources conflict between 90 and 150 working days.' }),
  r({ id: 'ID-FULL', marketId: 'ID', name: 'BPOM standard registration', days: wd(300), cost: 170000, confidence: 'medium', sourceUrl: 'https://www.pom.go.id/' }),

  r({ id: 'VN-SRA', marketId: 'VN', name: 'DAV SRA-reference route', days: 100, cost: 20_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA] } }, recency: 1825, confidence: 'medium', sourceUrl: 'https://www.tilleke.com/insights/vietnam-issues-new-regulations-on-drug-registration/' }),
  r({ id: 'VN-STD', marketId: 'VN', name: 'DAV standard registration', days: 365, cost: 160000, confidence: 'medium', sourceUrl: 'https://dav.gov.vn/' }),

  r({ id: 'IN-STD', marketId: 'IN', name: 'CDSCO with local clinical trial', days: 730, cost: 60_000, confidence: 'medium', sourceUrl: 'https://cdsco.gov.in/' }),
  r({ id: 'IN-WAIVER', marketId: 'IN', name: 'CDSCO Rule 101 local-trial waiver', days: 180, cost: 50_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'MHRA', 'PMDA', 'TGA', 'HC', 'EMA'] } }, eligibility: { orphanOnly: true }, confidence: 'medium', sourceUrl: 'https://clinregs.niaid.nih.gov/updates/full/203-india-profile-updated-with-dcgi-order-regarding-local-clinical-trial-waivers', note: 'Waiver limited to five categories including orphan, gene and cell therapy, and pandemic use.' }),

  r({ id: 'CN-STD', marketId: 'CN', name: 'NMPA new drug application', days: wd(200), cost: 200_000, confidence: 'medium', sourceUrl: 'https://www.nmpa.gov.cn/' }),
  r({ id: 'CN-PRIORITY', marketId: 'CN', name: 'NMPA priority review', days: wd(130), cost: 200_000, eligibility: { requiresPriorityReviewGrade: true }, confidence: 'medium', sourceUrl: 'https://www.nmpa.gov.cn/' }),

  r({ id: 'TW-STD', marketId: 'TW', name: 'TFDA new chemical entity', days: 360, cost: 190000, confidence: 'medium', sourceUrl: 'https://www.fda.gov.tw/ENG/index.aspx' }),

  // ================= latin america =================
  r({ id: 'BR-OPTIMIZED', marketId: 'BR', name: 'ANVISA optimized analysis (reliance)', days: 180, cost: 60_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['WHO', 'EMA', 'HC', 'SWISSMEDIC', 'MHRA', 'FDA', 'TGA'] } }, confidence: 'medium', sourceUrl: 'https://www.demarest.com.br/en/anvisa-approves-regulations-on-using-analyses-by-equivalent-foreign-regulatory-authorities-reliance/', note: 'Eight equivalent foreign authorities recognised. Disqualified if denied by any of them.' }),
  r({ id: 'BR-RDC205', marketId: 'BR', name: 'ANVISA RDC 205 rare-disease pathway', days: 246, cost: 60_000, eligibility: { orphanOnly: true }, confidence: 'medium', sourceUrl: 'https://trinitylifesciences.com/blog/how-effective-is-anvisas-rare-diseases-expedited-approval-pathway-rdc-205/' }),
  r({ id: 'BR-STD', marketId: 'BR', name: 'ANVISA standard registration', days: 500, cost: 280000, confidence: 'medium', sourceUrl: 'https://www.gov.br/anvisa/' }),

  r({ id: 'MX-ABREVIADA', marketId: 'MX', name: 'Vía Regulatoria Abreviada', days: wd(45), cost: 30_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'wla' } }, recency: 1825, provenance: ['original'], confidence: 'high', sourceUrl: 'https://sidof.segob.gob.mx/notas/docFuente/5585043', note: 'Only ordinary approvals qualify. Accelerated, conditional and reliance-derived foreign approvals are excluded.' }),
  r({ id: 'MX-STD', marketId: 'MX', name: 'COFEPRIS standard registration', days: 400, cost: 200000, confidence: 'medium', sourceUrl: 'https://www.gob.mx/cofepris' }),

  r({ id: 'PE-EXPRES', marketId: 'PE', name: 'DIGEMID registro exprés', days: 45, cost: 15_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'EMA', 'MHRA', 'TGA', 'PMDA', 'MFDS', 'SWISSMEDIC'] } }, confidence: 'medium', sourceUrl: 'https://saludconlupa.com/noticias/registro-expres-de-medicamentos-una-ley-con-silencio-positivo-que-reduce-la-capacidad-de-control-de-la-digemid/', note: 'Positive administrative silence: approved automatically if DIGEMID does not respond in 45 days.' }),
  r({ id: 'PE-STD', marketId: 'PE', name: 'DIGEMID standard registration', days: 365, cost: 150000, confidence: 'low', sourceUrl: 'https://www.digemid.minsa.gob.pe/' }),

  r({ id: 'CO-STD', marketId: 'CO', name: 'INVIMA registration', days: 420, cost: 160000, confidence: 'low', sourceUrl: 'https://www.invima.gov.co/' }),
  r({ id: 'CL-RELIANCE', marketId: 'CL', name: 'ISP reliance procedure', days: 200, cost: 20_000, prereq: { kind: 'kOf', k: 2, set: { kind: 'named', authorities: [...SRA] } }, confidence: 'low', sourceUrl: 'https://www.carey.cl/instituto-de-salud-publica-establece-procedimiento-de-reliance-para-el-registro-sanitario-de-productos-farmaceuticos-biologicos/' }),
  r({ id: 'CL-STD', marketId: 'CL', name: 'ISP standard registration', days: 400, cost: 160000, confidence: 'low', sourceUrl: 'https://www.ispch.gob.cl/' }),
  r({ id: 'AR-STD', marketId: 'AR', name: 'ANMAT registration', days: 400, cost: 160000, confidence: 'low', sourceUrl: 'http://www.anmat.gob.ar/' }),

  // ================= africa =================
  r({ id: 'ZA-ABRIDGED', marketId: 'ZA', name: 'SAHPRA abridged review', days: 97, cost: 30_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA, 'WHO'] } }, confidence: 'medium', sourceUrl: 'https://www.sahpra.org.za/wp-content/uploads/2025/08/SAHPGL-BAU-01_v5-Reliance-Guideline.pdf', note: 'Requires the full unredacted assessment report from a recognised authority.' }),
  r({ id: 'ZA-FULL', marketId: 'ZA', name: 'SAHPRA full review', days: 191, cost: 180000, confidence: 'medium', sourceUrl: 'https://www.sahpra.org.za/' }),

  r({ id: 'NG-ABRIDGED', marketId: 'NG', name: 'NAFDAC abridged review', days: 120, cost: 15_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA, 'WHO'] } }, confidence: 'low', sourceUrl: 'https://www.nafdac.gov.ng/', note: 'NAFDAC GMP inspection of the foreign site is the practical bottleneck.' }),
  r({ id: 'NG-FULL', marketId: 'NG', name: 'NAFDAC standard registration', days: 365, cost: 150000, confidence: 'low', sourceUrl: 'https://www.nafdac.gov.ng/' }),

  r({ id: 'KE-VERIFICATION', marketId: 'KE', name: 'PPB verification review', days: 90, cost: 12_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA, 'WHO'] } }, confidence: 'medium', sourceUrl: EAC_URL }),
  r({ id: 'KE-ABRIDGED', marketId: 'KE', name: 'PPB abridged review', days: 105, cost: 12_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA, 'WHO', 'TMDA', 'NAFDAC'] } }, confidence: 'medium', sourceUrl: EAC_URL, note: 'Kenya also accepts Tanzania TMDA and Ghana FDA as reference authorities.' }),
  r({ id: 'KE-FULL', marketId: 'KE', name: 'PPB full review', days: 262, cost: 150000, confidence: 'medium', sourceUrl: EAC_URL }),

  r({ id: 'UG-VERIFICATION', marketId: 'UG', name: 'NDA verification review', days: 90, cost: 10_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA, 'WHO'] } }, confidence: 'medium', sourceUrl: EAC_URL }),
  r({ id: 'UG-ABRIDGED', marketId: 'UG', name: 'NDA abridged review', days: 105, cost: 10_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA, 'WHO'] } }, confidence: 'medium', sourceUrl: EAC_URL }),
  r({ id: 'UG-FULL', marketId: 'UG', name: 'NDA full review', days: 261, cost: 140000, confidence: 'medium', sourceUrl: EAC_URL }),

  r({ id: 'TZ-ABRIDGED', marketId: 'TZ', name: 'TMDA abridged review', days: 126, cost: 10_000, prereq: { kind: 'kOf', k: 2, set: { kind: 'named', authorities: [...SRA, 'WHO'] } }, confidence: 'medium', sourceUrl: EAC_URL, note: 'Requires approval in at least two reference countries and rejection in none.' }),
  r({ id: 'TZ-FASTTRACK', marketId: 'TZ', name: 'TMDA fast-track', days: 90, cost: 12_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['WHO'] } }, eligibility: { requiresWhoEoi: true }, confidence: 'medium', sourceUrl: EAC_URL }),
  r({ id: 'TZ-FULL', marketId: 'TZ', name: 'TMDA full review', days: 180, cost: 140000, confidence: 'medium', sourceUrl: EAC_URL }),

  r({ id: 'RW-VERIFICATION', marketId: 'RW', name: 'Rwanda FDA verification', days: 90, cost: 9_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: [...SRA, 'WHO'] } }, confidence: 'medium', sourceUrl: EAC_URL }),
  r({ id: 'RW-FULL', marketId: 'RW', name: 'Rwanda FDA full review', days: 270, cost: 130000, confidence: 'medium', sourceUrl: EAC_URL }),

  // ================= eastern europe =================
  r({ id: 'UA-RECOGNITION', marketId: 'UA', name: 'Fast-track registration by recognition', days: 14, cost: 15_000, prereq: { kind: 'kOf', k: 1, set: { kind: 'named', authorities: ['FDA', 'SWISSMEDIC', 'PMDA', 'TGA', 'HC', 'EMA'] } }, satisfies: ['dossier', 'gmp_audit'], confidence: 'medium', sourceUrl: 'https://cratia.ua/en/state-registration-medicines-and-active-pharmaceutical-ingredients/abridged-registration-procedures', note: 'Ten business days with no specialised expert assessment of the dossier.' }),
  r({ id: 'UA-STD', marketId: 'UA', name: 'Ukraine national procedure', days: 300, cost: 150000, confidence: 'medium', sourceUrl: 'https://cratia.ua/' }),
]

export const ROUTES_BY_MARKET = ROUTES.reduce((acc, route) => {
  const list = acc.get(route.marketId) ?? []
  list.push(route)
  acc.set(route.marketId, list)
  return acc
}, new Map<string, Route[]>())
