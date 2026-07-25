import type { Asset, AssetKind, Modality } from '../solver/types'

/**
 * Free text to a structured asset. This is deterministic rather than model-driven: the
 * indication and modality vocabularies are closed sets, so keyword matching is both
 * reliable and inspectable. An LLM is used only to enrich when a key is configured, and
 * never to invent a field the parser already resolved.
 */

interface Rule {
  value: string
  patterns: RegExp[]
}

const INDICATION_RULES: Rule[] = [
  { value: 'oncology', patterns: [/\bonco/i, /\bcancer/i, /\btumou?r/i, /carcinoma/i, /lymphoma/i, /leuk[ae]mia/i, /melanoma/i, /myeloma/i, /sarcoma/i, /glioma/i, /\bnsclc\b/i, /\bsclc\b/i, /metasta/i] },
  { value: 'hiv', patterns: [/\bhiv\b/i, /\baids\b/i, /antiretroviral/i, /\bprep\b/i, /lenacapavir/i, /dolutegravir/i] },
  { value: 'tuberculosis', patterns: [/\btb\b/i, /tuberculosis/i, /bedaquiline/i] },
  { value: 'malaria', patterns: [/malaria/i, /antimalarial/i, /artemisinin/i] },
  { value: 'maternal_newborn', patterns: [/maternal/i, /newborn/i, /neonatal/i, /obstetric/i, /postpartum/i, /oxytocin/i] },
  { value: 'rare_disease', patterns: [/rare disease/i, /ultra-?rare/i, /\borphan\b/i] },
  { value: 'diabetes', patterns: [/diabet/i, /insulin/i, /glp-?1/i, /semaglutide/i] },
  { value: 'cardiovascular', patterns: [/cardiovascular/i, /\bcardiac\b/i, /\bheart\b/i, /hypertens/i, /cholesterol/i, /statin/i, /anticoagul/i] },
  { value: 'neurology', patterns: [/neuro/i, /alzheim/i, /parkinson/i, /epilep/i, /multiple sclerosis/i, /\bms\b/i, /migraine/i] },
  { value: 'infectious_disease', patterns: [/vaccin/i, /influenza/i, /covid/i, /antibiotic/i, /pneumococcal/i, /\bsepsis\b/i, /hepatitis/i, /infection/i] },
]

const KIND_RULES: Rule[] = [
  { value: 'vaccine', patterns: [/vaccin/i, /immunisation/i, /immunization/i] },
  { value: 'atmp', patterns: [/gene therapy/i, /cell therapy/i, /car-?t/i, /\batmp\b/i, /crispr/i] },
  { value: 'blood_product', patterns: [/plasma/i, /immunoglobulin/i, /blood product/i, /clotting factor/i] },
  { value: 'biosimilar', patterns: [/biosimilar/i] },
  { value: 'generic', patterns: [/\bgeneric\b/i] },
  { value: 'biologic', patterns: [/biologic/i, /monoclonal/i, /\bmab\b/i, /antibody/i, /\w+mab\b/i, /fusion protein/i, /\badc\b/i] },
]

/** the core commercial set: large revenue markets plus the reliance hubs that unlock them. */
export const TARGET_SETS = {
  commercial: ['US', 'EU', 'JP', 'UK', 'CA', 'AU', 'CH', 'SG', 'BR', 'MX', 'SA', 'KR'],
  global: ['US', 'EU', 'JP', 'UK', 'CA', 'AU', 'CH', 'SG', 'BR', 'MX', 'SA', 'KR', 'ZA', 'IN', 'PH', 'TH', 'ID', 'EG', 'KE', 'NG'],
  lmic: ['ZA', 'KE', 'UG', 'TZ', 'RW', 'NG', 'EG', 'PH', 'VN', 'TH', 'ID', 'IN'],
}

function matchFirst(text: string, rules: Rule[]): string | null {
  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(text))) return rule.value
  }
  return null
}

export interface IntakeResult {
  asset: Asset
  targets: string[]
  targetSet: keyof typeof TARGET_SETS
  /** which fields the parser actually found evidence for. */
  detected: string[]
  assumptions: string[]
}

export function parseDrugDescription(text: string): IntakeResult {
  const detected: string[] = []
  const assumptions: string[] = []
  const t = text.trim()

  const modality: Modality = /\bdevice\b|\bimplant\b|\bcatheter\b|\bstent\b/i.test(t)
    ? 'device'
    : /\bivd\b|diagnostic|assay/i.test(t)
      ? 'ivd'
      : 'drug'
  if (modality !== 'drug') detected.push(`modality: ${modality}`)

  const indication = matchFirst(t, INDICATION_RULES)
  if (indication) detected.push(`indication: ${indication}`)
  else assumptions.push('indication not recognised — treated as "other", which limits programme eligibility')

  let kind = matchFirst(t, KIND_RULES) as AssetKind | null
  if (kind) detected.push(`type: ${kind}`)
  else {
    kind = 'nce'
    assumptions.push('assumed a small molecule (new chemical entity)')
  }

  const orphan = /\borphan\b|rare disease|ultra-?rare/i.test(t)
  if (orphan) detected.push('orphan designation')

  // WHO prequalification only opens for categories with an active expression of interest
  const whoEoiEligible =
    ['hiv', 'tuberculosis', 'malaria', 'maternal_newborn'].includes(indication ?? '') ||
    (indication === 'infectious_disease' && kind === 'vaccine') ||
    /neglected tropical|\bntd\b|global health/i.test(t)
  if (whoEoiEligible) detected.push('WHO prequalification category')

  const priorityReviewGrade =
    /breakthrough|priority review|unmet need|first-in-class|accelerated/i.test(t) ||
    indication === 'oncology' ||
    orphan
  if (priorityReviewGrade) detected.push('priority-review grade')

  let targetSet: keyof typeof TARGET_SETS = 'commercial'
  if (/africa|sub-saharan|lmic|low-income|global south|developing/i.test(t)) targetSet = 'lmic'
  else if (/global|worldwide|every market|all markets/i.test(t)) targetSet = 'global'
  else if (whoEoiEligible) targetSet = 'global'

  const asset: Asset = {
    id: 'custom',
    name: t.length > 70 ? `${t.slice(0, 67)}…` : t || 'Unnamed asset',
    modality,
    kind,
    indication: indication ?? 'other',
    orphan,
    whoEoiEligible,
    priorityReviewGrade,
  }

  return { asset, targets: TARGET_SETS[targetSet], targetSet, detected, assumptions }
}

/**
 * Optional refinement. Only runs when ANTHROPIC_API_KEY is configured, and only fills
 * fields the deterministic parser left unresolved — it never overrides a keyword match,
 * and it never touches timings or costs.
 */
export async function refineWithModel(text: string, base: IntakeResult): Promise<IntakeResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || base.assumptions.length === 0) return base

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
    const detected = [...base.detected]

    if (base.asset.indication === 'other' && parsed.indication && parsed.indication !== 'other') {
      asset.indication = parsed.indication
      detected.push(`indication inferred by model: ${parsed.indication}`)
    }

    return {
      ...base,
      asset,
      detected,
      assumptions: base.assumptions.filter((a) => !a.startsWith('indication not recognised')),
    }
  } catch {
    return base
  }
}
