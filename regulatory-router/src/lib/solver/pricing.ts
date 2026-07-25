import {
  DEFAULT_MFN,
  DEFAULT_NPV,
  PRICING_MARKETS,
  PRICING_BY_ID,
  mfnBasket,
  type MfnPolicy,
  type NpvAssumptions,
  type PricingMarket,
} from '../data/pricing'

/** populations in millions, for the access objective. */
const POPULATION_M: Record<string, number> = {
  US: 335, DE: 84, FR: 68, IT: 59, ES: 48, NL: 18, BE: 12, AT: 9, PT: 10, GR: 10,
  CZ: 11, PL: 37, BG: 6, RO: 19, SE: 11, DK: 6, IE: 5, NO: 5, UK: 68, CH: 9,
  CA: 40, JP: 124, KR: 52, AU: 27, IL: 10, TR: 86, BR: 216, MX: 129, SA: 37,
  JO: 11, ZA: 60, IN: 1430, CN: 1410,
}

export interface MarketPricing {
  id: string
  name: string
  /** the price other countries observe when they reference this market. */
  listPrice: number
  /** what the manufacturer actually realises. */
  netPrice: number
  /** the unconstrained price this market would have paid. */
  freePrice: number
  /** how much price was lost to external referencing. */
  erosion: number
  launched: boolean
  launchDay: number | null
  inMfnBasket: boolean
  constrainedBy: string[]
}

export interface PricingOutcome {
  markets: MarketPricing[]
  usListPrice: number
  usErosion: number
  /** which launched market set the US MFN price, if any. */
  mfnBindingMarket: string | null
  npvUsd: number
  accessPatientYears: number
  launchedCount: number
}

function annuityFactor(years: number, rate: number): number {
  if (years <= 0) return 0
  return (1 - Math.pow(1 + rate, -years)) / rate
}

function applyFormula(formula: PricingMarket['erpFormula'], prices: number[]): number | null {
  if (prices.length === 0 || formula === 'none') return null
  const sorted = [...prices].sort((a, b) => a - b)
  switch (formula) {
    case 'lowest':
      return sorted[0]
    case 'mean':
      return sorted.reduce((a, b) => a + b, 0) / sorted.length
    case 'mean_of_3_lowest': {
      const take = sorted.slice(0, Math.min(3, sorted.length))
      return take.reduce((a, b) => a + b, 0) / take.length
    }
    case 'median':
      return sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    default:
      return null
  }
}

export interface PricingInput {
  /** approval day per regulatory market id, from the regulatory solver. */
  approvalDays: Map<string, number>
  /** pricing market ids we are willing to launch in. */
  launchSet: Set<string>
  mfn?: MfnPolicy
  npv?: NpvAssumptions
  /** hold list price up and give value away as a confidential rebate where possible. */
  useConfidentialRebates?: boolean
}

/**
 * Prices are set in descending order of the free price, which is the classical result:
 * a referencing country then never observes a lower price than it otherwise would.
 * External referencing propagates on list prices; revenue accrues on net prices, and
 * those are only the same where a confidential rebate is unavailable.
 */
export function computePricing(input: PricingInput): PricingOutcome {
  const mfn = input.mfn ?? DEFAULT_MFN
  const npv = input.npv ?? DEFAULT_NPV
  const useRebates = input.useConfidentialRebates ?? true
  const basket = new Set(mfnBasket(mfn))

  const ordered = [...PRICING_MARKETS].sort((a, b) => b.priceIndex - a.priceIndex)

  const listPrices = new Map<string, number>()
  const observedForErp = new Map<string, number>()
  const out = new Map<string, MarketPricing>()

  for (const market of ordered) {
    const launched = input.launchSet.has(market.id)
    const approvalDay = input.approvalDays.get(market.approvalVia)
    const launchDay =
      launched && approvalDay !== undefined ? approvalDay + market.htaLagDays : null

    const freePrice = market.priceIndex
    let listPrice = freePrice
    let netPrice = freePrice
    const constrainedBy: string[] = []

    if (launched && market.erpFormula !== 'none') {
      const visible: number[] = []
      for (const ref of market.erpBasket) {
        const price = observedForErp.get(ref)
        if (price === undefined) continue
        visible.push(price)
        constrainedBy.push(ref)
      }
      const referenced = applyFormula(market.erpFormula, visible)
      if (referenced !== null && referenced < freePrice) {
        if (useRebates && market.confidentialRebate) {
          // list stays up so downstream baskets are unharmed; the discount is private
          listPrice = freePrice
          netPrice = referenced
        } else {
          listPrice = referenced
          netPrice = referenced
        }
      }
    }

    if (launched) {
      listPrices.set(market.id, listPrice)
      // markets that request net prices see through the rebate — the leak points
      observedForErp.set(market.id, market.requestsNetPrice ? netPrice : listPrice)
    }

    out.set(market.id, {
      id: market.id,
      name: market.name,
      listPrice,
      netPrice,
      freePrice,
      erosion: freePrice - netPrice,
      launched,
      launchDay,
      inMfnBasket: basket.has(market.id),
      constrainedBy,
    })
  }

  // --- the MFN step: the US price is pegged to the lowest observed basket price ---
  const us = out.get('US')!
  let usPrice = us.freePrice
  let bindingMarket: string | null = null

  if (mfn.enabled) {
    for (const id of basket) {
      const entry = out.get(id)
      if (!entry || !entry.launched) continue
      const observed = observedForErp.get(id)
      if (observed === undefined) continue
      if (observed < usPrice) {
        usPrice = observed
        bindingMarket = id
      }
    }
  }

  // only part of US revenue sits in the channels MFN binds
  const usNet = us.freePrice * (1 - mfn.exposure) + usPrice * mfn.exposure
  const usEntry = out.get('US')!
  usEntry.netPrice = usEntry.launched ? usNet : usEntry.freePrice
  usEntry.erosion = usEntry.freePrice - usEntry.netPrice

  // --- NPV and access ---
  let npvUsd = 0
  let accessPatientYears = 0
  let launchedCount = 0

  for (const entry of out.values()) {
    if (!entry.launched || entry.launchDay === null) continue
    launchedCount++
    const market = PRICING_BY_ID.get(entry.id)!
    const launchYears = entry.launchDay / 365
    const yearsSelling = Math.max(0, npv.exclusivityYears - launchYears)

    const annualRevenue =
      (entry.netPrice / 100) * market.revenueWeight * npv.peakAnnualRevenueUsd
    const discountToLaunch = Math.pow(1 + npv.discountRate, -launchYears)
    npvUsd += annualRevenue * annuityFactor(yearsSelling, npv.discountRate) * discountToLaunch

    accessPatientYears += (POPULATION_M[entry.id] ?? 0) * yearsSelling
  }

  return {
    markets: [...out.values()],
    usListPrice: usPrice,
    usErosion: us.freePrice - usEntry.netPrice,
    mfnBindingMarket: bindingMarket,
    npvUsd,
    accessPatientYears,
    launchedCount,
  }
}

export interface LaunchScenario {
  label: string
  priceFloor: number
  launchSet: string[]
  npvUsd: number
  accessPatientYears: number
  launchedCount: number
  usNetPrice: number
  mfnBindingMarket: string | null
}

/**
 * The launch decision collapses to a single scalar: a price floor below which we decline
 * to launch. Sweeping every distinct market price gives the exact optimum, and the curve
 * it traces is non-monotone — adding a market can strictly destroy value once it trips
 * the MFN reference.
 */
export function sweepLaunchSets(
  approvalDays: Map<string, number>,
  candidates: string[],
  opts: { mfn?: MfnPolicy; npv?: NpvAssumptions; useConfidentialRebates?: boolean } = {},
): LaunchScenario[] {
  const available = PRICING_MARKETS.filter(
    (m) => candidates.includes(m.id) && approvalDays.has(m.approvalVia),
  ).sort((a, b) => b.priceIndex - a.priceIndex)

  const scenarios: LaunchScenario[] = []

  for (let k = 1; k <= available.length; k++) {
    const set = available.slice(0, k)
    const floor = set[set.length - 1].priceIndex
    const outcome = computePricing({
      approvalDays,
      launchSet: new Set(set.map((m) => m.id)),
      ...opts,
    })
    scenarios.push({
      label: `launch top ${k} by price`,
      priceFloor: floor,
      launchSet: set.map((m) => m.id),
      npvUsd: outcome.npvUsd,
      accessPatientYears: outcome.accessPatientYears,
      launchedCount: outcome.launchedCount,
      usNetPrice: outcome.markets.find((m) => m.id === 'US')?.netPrice ?? 0,
      mfnBindingMarket: outcome.mfnBindingMarket,
    })
  }

  return scenarios
}

export { DEFAULT_MFN, DEFAULT_NPV, mfnBasket }
export type { MfnPolicy, NpvAssumptions }
