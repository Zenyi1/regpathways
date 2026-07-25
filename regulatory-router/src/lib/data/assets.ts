import type { Asset } from '../solver/types'

/**
 * archetypes exist because there is no single optimal route. project orbis is oncology
 * only, who prequalification needs an active expression of interest, and saudi's fast
 * routes exclude generics — so the reachable graph differs per asset, not just the
 * ranking within it.
 */
export const ASSET_PRESETS: Asset[] = [
  {
    id: 'onc-biologic',
    name: 'Oncology biologic (new active substance)',
    modality: 'drug',
    kind: 'biologic',
    indication: 'oncology',
    orphan: false,
    whoEoiEligible: false,
    priorityReviewGrade: true,
  },
  {
    id: 'hiv-small-molecule',
    name: 'HIV small molecule for LMIC access',
    modality: 'drug',
    kind: 'nce',
    indication: 'hiv',
    orphan: false,
    whoEoiEligible: true,
    priorityReviewGrade: true,
  },
  {
    id: 'tb-paediatric',
    name: 'Paediatric TB formulation',
    modality: 'drug',
    kind: 'nce',
    indication: 'tuberculosis',
    orphan: false,
    whoEoiEligible: true,
    priorityReviewGrade: false,
  },
  {
    id: 'rare-disease',
    name: 'Rare-disease orphan drug',
    modality: 'drug',
    kind: 'nce',
    indication: 'rare_disease',
    orphan: true,
    whoEoiEligible: false,
    priorityReviewGrade: true,
  },
  {
    id: 'generic',
    name: 'Generic small molecule',
    modality: 'drug',
    kind: 'generic',
    indication: 'cardiovascular',
    orphan: false,
    whoEoiEligible: false,
    priorityReviewGrade: false,
  },
  {
    id: 'vaccine',
    name: 'Routine immunisation vaccine',
    modality: 'drug',
    kind: 'vaccine',
    indication: 'infectious_disease',
    orphan: false,
    whoEoiEligible: true,
    priorityReviewGrade: false,
  },
  {
    id: 'cardio-nce',
    name: 'Cardiovascular new chemical entity',
    modality: 'drug',
    kind: 'nce',
    indication: 'cardiovascular',
    orphan: false,
    whoEoiEligible: false,
    priorityReviewGrade: false,
  },
]

export const INDICATIONS = [
  'oncology',
  'hiv',
  'tuberculosis',
  'malaria',
  'rare_disease',
  'cardiovascular',
  'infectious_disease',
  'maternal_newborn',
  'diabetes',
  'neurology',
] as const

export const ASSET_KINDS = [
  'nce',
  'biologic',
  'vaccine',
  'generic',
  'biosimilar',
  'atmp',
  'blood_product',
  'device',
] as const
