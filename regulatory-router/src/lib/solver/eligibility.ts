import type { Asset, Authority, ProductCategory, ReferenceSet, Route } from './types'

/** which who-listed-authority scope this asset needs an agency to hold. */
export function productCategoryFor(asset: Asset): ProductCategory {
  switch (asset.kind) {
    case 'generic':
      return 'generics'
    case 'vaccine':
      return 'vaccines'
    case 'biologic':
    case 'biosimilar':
    case 'atmp':
    case 'blood_product':
      return 'biotherapeutics'
    default:
      return 'nce'
  }
}

export function isRouteEligible(route: Route, asset: Asset): boolean {
  if (route.modality !== asset.modality) return false

  const e = route.eligibility
  if (e.modalities && !e.modalities.includes(asset.modality)) return false
  if (e.assetKinds && !e.assetKinds.includes(asset.kind)) return false
  if (e.excludeAssetKinds && e.excludeAssetKinds.includes(asset.kind)) return false
  if (e.riskClasses && (!asset.riskClass || !e.riskClasses.includes(asset.riskClass))) return false
  if (e.predicate === 'required' && !asset.predicateDevice) return false
  if (e.predicate === 'absent' && asset.predicateDevice) return false
  if (e.indications && !e.indications.includes(asset.indication)) return false
  if (e.excludeIndications && e.excludeIndications.includes(asset.indication)) return false
  if (e.orphanOnly && !asset.orphan) return false
  if (e.requiresWhoEoi && !asset.whoEoiEligible) return false
  if (e.requiresPriorityReviewGrade && !asset.priorityReviewGrade) return false

  return true
}

/**
 * resolve a reference-set predicate to concrete authority ids for this asset.
 * the wla case is asset-dependent because listings are modular by product category.
 */
export function resolveReferenceSet(
  set: ReferenceSet,
  authorities: Authority[],
  asset: Asset,
): string[] {
  switch (set.kind) {
    case 'named':
      return set.authorities
    case 'ich':
      return authorities.filter((a) => a.ichMember).map((a) => a.id)
    case 'wla': {
      const cat = productCategoryFor(asset)
      return authorities.filter((a) => a.wlaCategories.includes(cat)).map((a) => a.id)
    }
    default:
      return []
  }
}

export function explainIneligibility(route: Route, asset: Asset): string | null {
  if (route.modality !== asset.modality) return `route is ${route.modality}-only`
  const e = route.eligibility
  if (e.indications && !e.indications.includes(asset.indication))
    return `restricted to ${e.indications.join(', ')}`
  if (e.excludeIndications && e.excludeIndications.includes(asset.indication))
    return `${asset.indication} is excluded`
  if (e.assetKinds && !e.assetKinds.includes(asset.kind))
    return `restricted to ${e.assetKinds.join(', ')}`
  if (e.excludeAssetKinds && e.excludeAssetKinds.includes(asset.kind))
    return `${asset.kind} is excluded`
  if (e.riskClasses && !asset.riskClass) return 'no risk class set for this device'
  if (e.riskClasses && asset.riskClass && !e.riskClasses.includes(asset.riskClass))
    return `restricted to ${e.riskClasses.join('/')} risk class`
  if (e.predicate === 'required' && !asset.predicateDevice)
    return 'needs a legally marketed predicate device'
  if (e.predicate === 'absent' && asset.predicateDevice)
    return 'only for devices with no predicate'
  if (e.orphanOnly && !asset.orphan) return 'orphan designation required'
  if (e.requiresWhoEoi && !asset.whoEoiEligible)
    return 'no active WHO expression of interest for this category'
  if (e.requiresPriorityReviewGrade && !asset.priorityReviewGrade)
    return 'requires priority-review-grade application'
  return null
}
