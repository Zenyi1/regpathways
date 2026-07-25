import type { Authority } from '../solver/types'

/**
 * who-listed-authority designations ran swissmedic/hsa/mfds (oct 2023) -> +fda and the
 * european network (may 2024) -> +health canada, pmda, mhra (aug 2025) -> +tga, bpom
 * (jan 2026). listings are modular by product category, which is why wlaCategories is a
 * list rather than a boolean: an agency can be listed for generics but not
 * biotherapeutics, and a `wla` reference predicate then resolves differently per asset.
 */
const ALL_CATEGORIES: Authority['wlaCategories'] = [
  'generics',
  'nce',
  'biotherapeutics',
  'vaccines',
]

export const AUTHORITIES: Authority[] = [
  { id: 'FDA', name: 'US Food and Drug Administration', ichMember: true, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: true },
  { id: 'EMA', name: 'European Medicines Agency / EMRN', ichMember: true, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: false },
  { id: 'PMDA', name: 'Japan PMDA / MHLW', ichMember: true, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: true },
  { id: 'MHRA', name: 'UK Medicines and Healthcare products Regulatory Agency', ichMember: true, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: false },
  { id: 'HC', name: 'Health Canada', ichMember: true, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: true },
  { id: 'SWISSMEDIC', name: 'Swissmedic', ichMember: true, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: false },
  { id: 'TGA', name: 'Australia Therapeutic Goods Administration', ichMember: false, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: true },
  { id: 'HSA', name: 'Singapore Health Sciences Authority', ichMember: true, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: false },
  { id: 'MFDS', name: 'South Korea Ministry of Food and Drug Safety', ichMember: true, wlaCategories: ALL_CATEGORIES, imdrfMember: true, mdsapParticipant: false },
  { id: 'WHO', name: 'World Health Organization (Prequalification)', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },

  // ich regulatory members without wla listing
  { id: 'ANVISA', name: 'Brazil ANVISA', ichMember: true, wlaCategories: [], imdrfMember: true, mdsapParticipant: true },
  { id: 'COFEPRIS', name: 'Mexico COFEPRIS', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'SFDA', name: 'Saudi Food and Drug Authority', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'JFDA', name: 'Jordan Food and Drug Administration', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'EDA', name: 'Egyptian Drug Authority', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'NAFDAC', name: 'Nigeria NAFDAC', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'SAHPRA', name: 'South Africa SAHPRA', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'NMPA', name: 'China NMPA', ichMember: true, wlaCategories: [], imdrfMember: true, mdsapParticipant: false },
  { id: 'TFDA', name: 'Taiwan FDA', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'TITCK', name: 'Türkiye TİTCK', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'ANMAT', name: 'Argentina ANMAT', ichMember: true, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },

  // reliance-taking national authorities
  { id: 'BPOM', name: 'Indonesia BPOM', ichMember: false, wlaCategories: ['generics', 'nce'], imdrfMember: false, mdsapParticipant: false },
  { id: 'NPRA', name: 'Malaysia NPRA', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'THAIFDA', name: 'Thailand FDA', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'PHFDA', name: 'Philippines FDA', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'DAV', name: 'Vietnam Drug Administration', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'CDSCO', name: 'India CDSCO', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'MOHIL', name: 'Israel Ministry of Health', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'EDE', name: 'UAE Emirates Drug Establishment', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'PPB', name: 'Kenya Pharmacy and Poisons Board', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'NDA_UG', name: 'Uganda National Drug Authority', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'TMDA', name: 'Tanzania Medicines and Medical Devices Authority', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'RWANDAFDA', name: 'Rwanda FDA', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'DIGEMID', name: 'Peru DIGEMID', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'INVIMA', name: 'Colombia INVIMA', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'ISP', name: 'Chile ISP', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
  { id: 'MOHUA', name: 'Ukraine Ministry of Health', ichMember: false, wlaCategories: [], imdrfMember: false, mdsapParticipant: false },
]

export const AUTHORITY_IDS = new Set(AUTHORITIES.map((a) => a.id))
