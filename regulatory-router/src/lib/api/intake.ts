import type { Asset, AssetKind, Modality, RiskClass } from '../solver/types'

/**
 * Free text to a structured asset. This is deterministic rather than model-driven: the
 * indication and modality vocabularies are closed sets, so a table of published INN stems
 * and brand names is both more reliable and inspectable. An LLM is used only to enrich
 * when a key is configured, and never to invent a field the parser already resolved.
 */

interface Rule {
  value: string
  patterns: RegExp[]
}

const INDICATION_RULES: Rule[] = [
  { value: 'oncology', patterns: [/\bonco\w*/i, /\bcancers?\b/i, /\btumou?rs?\b/i, /carcinoma/i, /lymphoma/i, /leuk[ae]mia/i, /melanoma/i, /myeloma/i, /sarcoma/i, /glioma/i, /\bnsclc\b/i, /\bsclc\b/i, /\bcrc\b/i, /\btnbc\b/i, /metastatic/i, /neoplas\w*/i] },
  { value: 'hiv', patterns: [/\bhiv\b/i, /\baids\b/i, /antiretroviral/i, /\bart\b(?=\s*(regimen|therapy))/i, /pre-?exposure prophylaxis/i, /\bPrEP\b/] },
  { value: 'tuberculosis', patterns: [/\btb\b/i, /tuberculosis/i, /\bmdr-?tb\b/i] },
  { value: 'malaria', patterns: [/malaria\w*/i, /antimalarial/i, /\bp\.? falciparum\b/i] },
  { value: 'maternal_newborn', patterns: [/maternal/i, /newborn/i, /neonatal/i, /obstetric/i, /post-?partum/i, /pre-?eclampsia/i] },
  { value: 'rare_disease', patterns: [/rare disease/i, /ultra-?rare/i, /\borphan\b/i, /cystic fibrosis/i, /spinal muscular atrophy/i, /duchenne/i, /haemophilia/i, /hemophilia/i] },
  { value: 'diabetes', patterns: [/diabet\w*/i, /\binsulin\b/i, /glp-?1/i, /obesity/i, /weight loss/i] },
  { value: 'cardiovascular', patterns: [/cardiovascular/i, /\bcardiac\b/i, /coronary/i, /heart failure/i, /hypertens\w*/i, /cholesterol/i, /\bstatins?\b/i, /anticoagul\w*/i, /\bstroke\b/i, /atrial fibrillation/i] },
  { value: 'neurology', patterns: [/neurolog\w*/i, /alzheim\w*/i, /parkinson\w*/i, /epilep\w*/i, /multiple sclerosis/i, /migraine/i, /\bals\b/i, /dementia/i] },
  { value: 'infectious_disease', patterns: [/vaccin\w*/i, /influenza/i, /covid/i, /antibiotics?/i, /antivirals?/i, /pneumococcal/i, /\bsepsis\b/i, /hepatitis/i, /infections?\b/i, /\brsv\b/i, /cholera/i, /measles/i, /\bmpox\b/i] },
]

const KIND_RULES: Rule[] = [
  { value: 'biosimilar', patterns: [/biosimilar/i] },
  { value: 'generic', patterns: [/\bgenerics?\b/i, /\banda\b/i] },
  { value: 'vaccine', patterns: [/vaccin\w*/i, /immunis?ation/i, /immuniz?ation/i, /\btoxoid\b/i] },
  { value: 'atmp', patterns: [/gene therapy/i, /cell therapy/i, /car-?t\b/i, /\batmp\b/i, /crispr/i, /gene-?edit\w*/i] },
  { value: 'blood_product', patterns: [/plasma-?derived/i, /immunoglobulin/i, /blood product/i, /clotting factor/i, /\bfactor (viii|ix)\b/i] },
  { value: 'biologic', patterns: [/biologics?\b/i, /monoclonal/i, /\bmabs?\b/i, /antibod(y|ies)/i, /fusion protein/i, /\badc\b/i, /antibody-?drug conjugate/i, /recombinant/i, /\bpeptide\b/i] },
  { value: 'nce', patterns: [/small molecule/i, /\bnce\b/i, /new chemical entity/i] },
]

/**
 * WHO/USAN stems are assigned at naming time, so the tail of a generic name is a hard
 * structural fact rather than a guess: -mab is always a monoclonal, -tegravir always an
 * HIV integrase inhibitor. More specific stems must precede the ones they contain.
 */
const STEMS: { pattern: RegExp; kind?: AssetKind; indication?: string; label: string }[] = [
  { pattern: /\b\w{3,}(?:tegravir|navir|capavir)\b/i, kind: 'nce', indication: 'hiv', label: 'antiretroviral stem' },
  { pattern: /\b\w{3,}(?:citinib)\b/i, kind: 'nce', label: 'JAK inhibitor stem (-citinib)' },
  { pattern: /\b\w{3,}(?:tinib|anib|ciclib|parib|lisib|degib|zomib|tecan|rubicin|platin|taxel|arotene)\b/i, kind: 'nce', indication: 'oncology', label: 'oncology small-molecule stem' },
  { pattern: /\b\w{3,}(?:cabtagene|leucel)\b/i, kind: 'atmp', label: 'cell-therapy stem (-leucel)' },
  { pattern: /\b\w{4,}(?:vec)\b/i, kind: 'atmp', label: 'gene-therapy stem (-vec)' },
  { pattern: /\b\w{3,}(?:mab)\b/i, kind: 'biologic', label: 'monoclonal antibody stem (-mab)' },
  { pattern: /\b\w{3,}(?:bercept|nercept|tacept)\b/i, kind: 'biologic', label: 'fusion protein stem (-cept)' },
  { pattern: /\b\w{3,}(?:stim|poetin)\b/i, kind: 'biologic', label: 'recombinant protein stem' },
  { pattern: /\b\w{3,}(?:glucosidase|cerase|sulfase|galsidase)\b/i, kind: 'biologic', indication: 'rare_disease', label: 'enzyme replacement stem' },
  { pattern: /\b\w{3,}(?:glutide|gliflozin|gliptin)\b/i, kind: 'nce', indication: 'diabetes', label: 'antidiabetic stem' },
  { pattern: /\b\w{3,}(?:statin|sartan|xaban|dipine|pril)\b/i, kind: 'nce', indication: 'cardiovascular', label: 'cardiovascular stem' },
  { pattern: /\b\w{3,}(?:cillin|penem|floxacin|cycline|conazole|micin|mycin)\b/i, kind: 'nce', indication: 'infectious_disease', label: 'anti-infective stem' },
  { pattern: /\b\w{3,}(?:ciclovir|buvir|previr|asvir|amivir|trelvir|vir)\b/i, kind: 'nce', indication: 'infectious_disease', label: 'antiviral stem (-vir)' },
  { pattern: /\b\w{3,}(?:triptan|azepam|gabine)\b/i, kind: 'nce', indication: 'neurology', label: 'neurology stem' },
]

/**
 * Names a stem cannot classify: brands, and generics whose stem is uninformative.
 * Everything else is left to the stem table rather than enumerated here.
 */
const NAMED: Record<string, { inn?: string; kind: AssetKind; indication: string }> = {
  keytruda: { inn: 'pembrolizumab', kind: 'biologic', indication: 'oncology' },
  opdivo: { inn: 'nivolumab', kind: 'biologic', indication: 'oncology' },
  herceptin: { inn: 'trastuzumab', kind: 'biologic', indication: 'oncology' },
  enhertu: { inn: 'trastuzumab deruxtecan', kind: 'biologic', indication: 'oncology' },
  darzalex: { inn: 'daratumumab', kind: 'biologic', indication: 'oncology' },
  // the -mab stem fixes the kind but never the indication, so the high-volume
  // oncology antibodies are named explicitly
  pembrolizumab: { kind: 'biologic', indication: 'oncology' },
  nivolumab: { kind: 'biologic', indication: 'oncology' },
  trastuzumab: { kind: 'biologic', indication: 'oncology' },
  rituximab: { kind: 'biologic', indication: 'oncology' },
  bevacizumab: { kind: 'biologic', indication: 'oncology' },
  atezolizumab: { kind: 'biologic', indication: 'oncology' },
  durvalumab: { kind: 'biologic', indication: 'oncology' },
  daratumumab: { kind: 'biologic', indication: 'oncology' },
  revlimid: { inn: 'lenalidomide', kind: 'nce', indication: 'oncology' },
  lenalidomide: { kind: 'nce', indication: 'oncology' },
  venetoclax: { kind: 'nce', indication: 'oncology' },
  venclexta: { inn: 'venetoclax', kind: 'nce', indication: 'oncology' },
  humira: { inn: 'adalimumab', kind: 'biologic', indication: 'other' },
  dupixent: { inn: 'dupilumab', kind: 'biologic', indication: 'other' },
  biktarvy: { kind: 'nce', indication: 'hiv' },
  truvada: { kind: 'nce', indication: 'hiv' },
  descovy: { kind: 'nce', indication: 'hiv' },
  cabenuva: { kind: 'nce', indication: 'hiv' },
  sunlenca: { inn: 'lenacapavir', kind: 'nce', indication: 'hiv' },
  bedaquiline: { kind: 'nce', indication: 'tuberculosis' },
  sirturo: { inn: 'bedaquiline', kind: 'nce', indication: 'tuberculosis' },
  pretomanid: { kind: 'nce', indication: 'tuberculosis' },
  delamanid: { kind: 'nce', indication: 'tuberculosis' },
  coartem: { inn: 'artemether-lumefantrine', kind: 'nce', indication: 'malaria' },
  artemether: { kind: 'nce', indication: 'malaria' },
  artesunate: { kind: 'nce', indication: 'malaria' },
  tafenoquine: { kind: 'nce', indication: 'malaria' },
  ozempic: { inn: 'semaglutide', kind: 'nce', indication: 'diabetes' },
  wegovy: { inn: 'semaglutide', kind: 'nce', indication: 'diabetes' },
  mounjaro: { inn: 'tirzepatide', kind: 'nce', indication: 'diabetes' },
  zepbound: { inn: 'tirzepatide', kind: 'nce', indication: 'diabetes' },
  tirzepatide: { kind: 'nce', indication: 'diabetes' },
  jardiance: { inn: 'empagliflozin', kind: 'nce', indication: 'diabetes' },
  eliquis: { inn: 'apixaban', kind: 'nce', indication: 'cardiovascular' },
  xarelto: { inn: 'rivaroxaban', kind: 'nce', indication: 'cardiovascular' },
  entresto: { inn: 'sacubitril/valsartan', kind: 'nce', indication: 'cardiovascular' },
  leqvio: { inn: 'inclisiran', kind: 'nce', indication: 'cardiovascular' },
  leqembi: { inn: 'lecanemab', kind: 'biologic', indication: 'neurology' },
  spinraza: { inn: 'nusinersen', kind: 'nce', indication: 'neurology' },
  nusinersen: { kind: 'nce', indication: 'neurology' },
  risdiplam: { kind: 'nce', indication: 'rare_disease' },
  evrysdi: { inn: 'risdiplam', kind: 'nce', indication: 'rare_disease' },
  trikafta: { inn: 'elexacaftor combination', kind: 'nce', indication: 'rare_disease' },
  kaftrio: { inn: 'elexacaftor combination', kind: 'nce', indication: 'rare_disease' },
  zolgensma: { inn: 'onasemnogene abeparvovec', kind: 'atmp', indication: 'rare_disease' },
  casgevy: { inn: 'exagamglogene autotemcel', kind: 'atmp', indication: 'rare_disease' },
  luxturna: { inn: 'voretigene neparvovec', kind: 'atmp', indication: 'rare_disease' },
  hemgenix: { inn: 'etranacogene dezaparvovec', kind: 'atmp', indication: 'rare_disease' },
  kymriah: { inn: 'tisagenlecleucel', kind: 'atmp', indication: 'oncology' },
  yescarta: { inn: 'axicabtagene ciloleucel', kind: 'atmp', indication: 'oncology' },
  carvykti: { inn: 'ciltacabtagene autoleucel', kind: 'atmp', indication: 'oncology' },
  comirnaty: { kind: 'vaccine', indication: 'infectious_disease' },
  spikevax: { kind: 'vaccine', indication: 'infectious_disease' },
  shingrix: { kind: 'vaccine', indication: 'infectious_disease' },
  gardasil: { kind: 'vaccine', indication: 'infectious_disease' },
  prevnar: { kind: 'vaccine', indication: 'infectious_disease' },
  rotarix: { kind: 'vaccine', indication: 'infectious_disease' },
  bexsero: { kind: 'vaccine', indication: 'infectious_disease' },
  paxlovid: { inn: 'nirmatrelvir/ritonavir', kind: 'nce', indication: 'infectious_disease' },
  veklury: { inn: 'remdesivir', kind: 'nce', indication: 'infectious_disease' },
  sovaldi: { inn: 'sofosbuvir', kind: 'nce', indication: 'infectious_disease' },
  sofosbuvir: { kind: 'nce', indication: 'infectious_disease' },
  oxytocin: { kind: 'nce', indication: 'maternal_newborn' },
  misoprostol: { kind: 'nce', indication: 'maternal_newborn' },
}

/** the core commercial set: large revenue markets plus the reliance hubs that unlock them. */
export const TARGET_SETS = {
  commercial: ['US', 'EU', 'JP', 'UK', 'CA', 'AU', 'CH', 'SG', 'BR', 'MX', 'SA', 'KR'],
  global: ['US', 'EU', 'JP', 'UK', 'CA', 'AU', 'CH', 'SG', 'BR', 'MX', 'SA', 'KR', 'ZA', 'IN', 'PH', 'TH', 'ID', 'EG', 'KE', 'NG'],
  lmic: ['ZA', 'KE', 'UG', 'TZ', 'RW', 'NG', 'EG', 'PH', 'VN', 'TH', 'ID', 'IN'],
  /** device and ivd routes in the graph today cover these anchors reliably. */
  deviceCommercial: ['US', 'EU', 'UK', 'CH'],
  /** US/EU approval plus WHO PQ — the usual access stack for diagnostics in LMIC scope. */
  deviceAccess: ['US', 'EU', 'UK', 'WHOPQ'],
}

export type IntakeField =
  | 'modality'
  | 'kind'
  | 'indication'
  | 'orphan'
  | 'whoEoiEligible'
  | 'priorityReviewGrade'
  | 'riskClass'
  | 'predicateDevice'
  | 'targetSet'

export interface IntakeResult {
  asset: Asset
  targets: string[]
  targetSet: keyof typeof TARGET_SETS
  /** which fields the parser actually found evidence for. */
  detected: string[]
  assumptions: string[]
  /**
   * Per field, the evidence behind the value, or null where the value is a fallback the
   * caller should check. Drives the "detected / assumed" markers in the UI.
   */
  basis: Record<IntakeField, string | null>
  /** the recognised drug name, when one was matched. */
  matchedDrug: string | null
}

function matchRule(text: string, rules: Rule[]): { value: string; matched: string } | null {
  for (const rule of rules) {
    for (const p of rule.patterns) {
      const m = p.exec(text)
      if (m) return { value: rule.value, matched: m[0] }
    }
  }
  return null
}

function matchNamed(text: string) {
  for (const token of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    const hit = NAMED[token]
    if (hit) return { token, ...hit }
  }
  return null
}

function matchStem(text: string) {
  for (const s of STEMS) {
    const m = s.pattern.exec(text)
    if (m) return { ...s, matched: m[0] }
  }
  return null
}

export function parseDrugDescription(text: string): IntakeResult {
  const detected: string[] = []
  const assumptions: string[] = []
  const basis: Record<IntakeField, string | null> = {
    modality: null,
    kind: null,
    indication: null,
    orphan: null,
    whoEoiEligible: null,
    priorityReviewGrade: null,
    riskClass: null,
    predicateDevice: null,
    targetSet: null,
  }
  const t = text.trim()

  // an ivd is also a device, so the diagnostic test has to run first
  const ivdMatch =
    /\bivds?\b|in-?vitro diagnostic|companion diagnostic|\bassays?\b|diagnostic test|rapid test|lateral flow|\btest kit\b|\bpcr\b|serolog\w*|point-of-care test|\bpoct\b/i.exec(
      t,
    )
  const deviceMatch =
    /\bdevices?\b|\bimplants?\b|implantable|\bcatheters?\b|\bstents?\b|pacemakers?|defibrillators?|infusion pump|insulin pump|\bpumps?\b|\bprosthes[ei]s\b|surgical instrument|glucose monitor|continuous glucose|\bcgm\b|wearable monitor/i.exec(
      t,
    )
  const modality: Modality = ivdMatch ? 'ivd' : deviceMatch ? 'device' : 'drug'
  if (modality !== 'drug') {
    basis.modality = `matched "${(ivdMatch ?? deviceMatch)?.[0]}"`
    detected.push(`modality: ${modality}`)
  } else {
    basis.modality = 'no device or diagnostic wording, so read as a medicinal product'
  }

  const named = matchNamed(t)
  const stem = named ? null : matchStem(t)
  const keywordKind = matchRule(t, KIND_RULES)
  const keywordIndication = matchRule(t, INDICATION_RULES)

  // a stated indication is direct evidence and outranks whatever the molecule usually treats
  let indication: string
  if (keywordIndication) {
    indication = keywordIndication.value
    basis.indication = `matched "${keywordIndication.matched}"`
  } else if (named && named.indication !== 'other') {
    indication = named.indication
    basis.indication = `${named.token} is a ${named.indication.replace('_', ' ')} product`
  } else if (stem?.indication) {
    indication = stem.indication
    basis.indication = `${stem.label} in "${stem.matched}"`
  } else {
    indication = 'other'
    assumptions.push('indication not recognised, so it is treated as "other", which closes disease-specific programmes such as Project Orbis')
  }
  if (basis.indication) detected.push(`indication: ${indication}`)

  // "biosimilar" and "generic" describe the application, not the molecule, so they win
  const implantMatch = /\bimplants?\b|implantable|pacemakers?|defibrillators?|\bprosthes[ei]s\b|heart valve|\bstents?\b/i.exec(t)
  let kind: AssetKind
  if (modality === 'ivd') {
    kind = 'ivd'
    basis.kind = 'in-vitro diagnostic'
  } else if (modality === 'device') {
    kind = implantMatch ? 'implantable' : 'device'
    basis.kind = implantMatch ? `matched "${implantMatch[0]}"` : 'non-implantable device assumed'
  } else if (keywordKind && (keywordKind.value === 'biosimilar' || keywordKind.value === 'generic')) {
    kind = keywordKind.value as AssetKind
    basis.kind = `matched "${keywordKind.matched}"`
  } else if (named) {
    kind = named.kind
    basis.kind = named.inn ? `${named.token} is ${named.inn}` : `${named.token} is a known product`
  } else if (stem) {
    kind = stem.kind ?? 'nce'
    basis.kind = `${stem.label} in "${stem.matched}"`
  } else if (keywordKind) {
    kind = keywordKind.value as AssetKind
    basis.kind = `matched "${keywordKind.matched}"`
  } else {
    kind = 'nce'
    assumptions.push('assumed a small molecule (new chemical entity)')
  }
  if (basis.kind) detected.push(`type: ${kind}`)

  const orphanMatch = /\borphan\b|rare disease|ultra-?rare/i.exec(t)
  const orphan = Boolean(orphanMatch)
  if (orphanMatch) {
    basis.orphan = `matched "${orphanMatch[0]}"`
    detected.push('orphan designation')
  }

  // WHO prequalification only opens for categories with an active expression of interest
  const ntdMatch = /neglected tropical|\bntds?\b|global health/i.exec(t)
  const eoiIndication = ['hiv', 'tuberculosis', 'malaria', 'maternal_newborn'].includes(indication)
  const whoEoiEligible = eoiIndication || kind === 'vaccine' || Boolean(ntdMatch)
  if (whoEoiEligible) {
    basis.whoEoiEligible = eoiIndication
      ? `WHO PQ has a standing invitation for ${indication.replace('_', ' ')} products`
      : kind === 'vaccine'
        ? 'WHO PQ covers priority vaccines'
        : `matched "${ntdMatch?.[0]}"`
    detected.push('WHO prequalification category')
  }

  const priorityMatch = /breakthrough|priority review|unmet need|first-in-class|accelerated approval|regenerative medicine advanced/i.exec(t)
  const priorityReviewGrade = Boolean(priorityMatch) || orphan || indication === 'oncology'
  if (priorityMatch) {
    basis.priorityReviewGrade = `matched "${priorityMatch[0]}"`
    detected.push('priority-review grade')
  } else if (priorityReviewGrade) {
    assumptions.push(
      orphan
        ? 'assumed priority-review grade because the asset is an orphan drug'
        : 'assumed priority-review grade because most oncology new actives qualify, so uncheck it if yours would not',
    )
  }

  // every device and ivd route is cut by risk class, so leaving it unset returns an empty
  // frontier rather than a wrong answer. an explicit local class wins; otherwise the
  // product itself usually says enough.
  let riskClass: RiskClass | undefined
  let predicateDevice: boolean | undefined
  if (modality !== 'drug') {
    const statedClass = /\bclass\s*(iii|iib|iia|ii|i|[1-3]|[a-d])\b/i.exec(t)
    const stated = statedClass?.[1].toLowerCase()
    if (stated && statedClass) {
      riskClass =
        stated === 'iii' || stated === '3' || stated === 'd'
          ? 'critical'
          : stated === 'iib' || stated === 'c'
            ? 'high'
            : stated === 'i' || stated === '1' || stated === 'a'
              ? 'low'
              : 'moderate'
      basis.riskClass = `matched "${statedClass[0]}"`
    } else {
      const criticalMatch =
        modality === 'ivd'
          ? /\bhiv\b|hepatitis|blood screening|transfusion|transmissible/i.exec(t)
          : /life-?sustaining|life-?supporting|pacemakers?|defibrillators?|heart valve|\bcoronary\b|\bcardiac\b|\bstents?\b/i.exec(t)
      const highMatch =
        modality === 'ivd'
          ? /companion diagnostic|\bcancer\b|oncolog\w*/i.exec(t)
          : implantMatch
      if (criticalMatch) {
        riskClass = 'critical'
        basis.riskClass = `matched "${criticalMatch[0]}"`
      } else if (highMatch) {
        riskClass = 'high'
        basis.riskClass = `matched "${highMatch[0]}"`
      } else {
        riskClass = 'moderate'
        assumptions.push('assumed moderate risk class (FDA class II, MDR class IIa, IVDR class B) — this drives the whole device pathway, so set it explicitly')
      }
    }
    if (basis.riskClass) detected.push(`risk class: ${riskClass}`)

    const noPredicate = /\bde novo\b|no predicate|novel|first-of-its-kind|first of its kind|breakthrough device/i.exec(t)
    const hasPredicate = /\bpredicate\b|substantially equivalent|\b510\(?k\)?\b|\bme-?too\b/i.exec(t)
    predicateDevice = hasPredicate ? true : noPredicate ? false : true
    if (hasPredicate || noPredicate) {
      basis.predicateDevice = `matched "${(hasPredicate ?? noPredicate)?.[0]}"`
      detected.push(`predicate device: ${predicateDevice}`)
    } else {
      assumptions.push('assumed a predicate device exists, which is what opens the 510(k) route — clear it for a de novo or a genuinely novel device')
    }
  }

  const lmicMatch = /africa|sub-saharan|\blmics?\b|low-?income|middle-?income|global south|developing (countries|markets|world)/i.exec(t)
  const globalMatch = /\bglobal\b|worldwide|every market|all markets/i.exec(t)
  const usEuMatch =
    /\b(united states|u\.?s\.?a?\.?)\b.*\b(e\.?u\.?|europe|european union)\b|\b(e\.?u\.?|europe)\b.*\b(united states|u\.?s\.?)\b/i.exec(
      t,
    )
  let targetSet: keyof typeof TARGET_SETS = modality === 'drug' ? 'commercial' : 'deviceCommercial'
  if (modality !== 'drug') {
    if (lmicMatch || whoEoiEligible) {
      targetSet = 'deviceAccess'
      basis.targetSet = lmicMatch
        ? `matched "${lmicMatch[0]}" — device/IVD LMIC scope uses US, EU, UK and WHO PQ`
        : 'WHO prequalification category, so US/EU/UK plus WHO PQ are in scope'
    } else if (globalMatch) {
      targetSet = 'deviceCommercial'
      basis.targetSet = `matched "${globalMatch[0]}" — full global device coverage is not modelled; using major device anchors`
      assumptions.push(
        'device and IVD routes are curated for US, EU, UK and Switzerland — target markets were narrowed accordingly',
      )
    } else if (usEuMatch) {
      targetSet = 'deviceCommercial'
      basis.targetSet = `matched US and EU in the description`
    }
  } else if (lmicMatch) {
    targetSet = 'lmic'
    basis.targetSet = `matched "${lmicMatch[0]}"`
  } else if (globalMatch) {
    targetSet = 'global'
    basis.targetSet = `matched "${globalMatch[0]}"`
  } else if (whoEoiEligible) {
    targetSet = 'global'
    basis.targetSet = 'WHO prequalification category, so LMIC markets are in scope'
  }

  const asset: Asset = {
    id: 'custom',
    name: t.length > 70 ? `${t.slice(0, 67)}…` : t || 'Unnamed asset',
    modality,
    kind,
    indication,
    orphan,
    whoEoiEligible,
    priorityReviewGrade,
    riskClass,
    predicateDevice,
  }

  return {
    asset,
    targets: TARGET_SETS[targetSet],
    targetSet,
    detected,
    assumptions,
    basis,
    matchedDrug: named ? (named.inn ?? named.token) : null,
  }
}

/**
 * Optional refinement. Only runs when ANTHROPIC_API_KEY is configured, and only fills
 * fields the deterministic parser left unresolved — it never overrides a table match,
 * and it never touches timings or costs.
 */
export async function refineWithModel(text: string, base: IntakeResult): Promise<IntakeResult> {
  const key = process.env.ANTHROPIC_API_KEY
  const needsIndication = base.basis.indication === null
  const needsKind = base.basis.kind === null
  if (!key || (!needsIndication && !needsKind)) return base

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Classify this pharmaceutical asset description. Reply with JSON only, no prose.

Description: "${text}"

Fields:
- indication: one of oncology, hiv, tuberculosis, malaria, maternal_newborn, rare_disease, diabetes, cardiovascular, neurology, infectious_disease, other
- kind: one of nce, biologic, vaccine, generic, biosimilar, atmp, blood_product

Reply as {"indication": "...", "kind": "..."}`,
          },
        ],
      }),
    })

    if (!res.ok) return base
    const body = (await res.json()) as { content?: { text?: string }[] }
    const raw = body.content?.[0]?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return base

    const parsed = JSON.parse(match[0]) as { indication?: string; kind?: string }
    const asset = { ...base.asset }
    const basis = { ...base.basis }
    const detected = [...base.detected]
    let assumptions = [...base.assumptions]

    if (needsIndication && parsed.indication && parsed.indication !== 'other') {
      asset.indication = parsed.indication
      basis.indication = 'inferred by model, not by a table match'
      detected.push(`indication inferred by model: ${parsed.indication}`)
      assumptions = assumptions.filter((a) => !a.startsWith('indication not recognised'))
    }

    if (needsKind && parsed.kind) {
      asset.kind = parsed.kind as AssetKind
      basis.kind = 'inferred by model, not by a table match'
      detected.push(`type inferred by model: ${parsed.kind}`)
      assumptions = assumptions.filter((a) => !a.startsWith('assumed a small molecule'))
    }

    return { ...base, asset, basis, detected, assumptions }
  } catch {
    return base
  }
}
