import type { CollectionBeforeChangeHook } from 'payload'

import {
  monthlyEquivalentCents,
  MONTHS_PER_PERIOD,
  nextInvoiceDate,
  type BillingPeriod,
  type CostPeriod,
} from './periods'

type CostRow = {
  amountCents?: number | null
  currency?: string | null
  period?: CostPeriod | null
}

/**
 * Keeps `nextInvoiceOn` and the margin figures in step with everything else.
 *
 * `nextInvoiceOn` is derived, never entered: it is always the start date plus
 * `periodsBilled` whole periods, so it cannot drift and cannot disagree with what
 * the billing run will do.
 */
export const recomputeServiceDerived: CollectionBeforeChangeHook = ({ data }) => {
  const period = (data.billingPeriod ?? 'monthly') as BillingPeriod

  if (data.startDate) {
    data.nextInvoiceOn = nextInvoiceDate(data.startDate, data.periodsBilled ?? 0, period)
  }

  // Fall back to the service name so a generated invoice line is never blank.
  if (!data.lineDescription && data.name) data.lineDescription = data.name
  if (data.quantityMilli === undefined || data.quantityMilli === null) data.quantityMilli = 1000

  const monthlyCharge = Math.round((data.chargeCents ?? 0) / MONTHS_PER_PERIOD[period])

  // Only costs in the service's own currency count toward margin. Converting the
  // others would mean inventing an FX rate, and a wrong margin is worse than an
  // absent one — so they are excluded and the mismatch is flagged instead.
  const costs: CostRow[] = Array.isArray(data.costs) ? data.costs : []
  let monthlyCost = 0
  let mismatch = false

  for (const cost of costs) {
    if (!cost?.amountCents) continue
    if (cost.currency && cost.currency !== data.currency) {
      mismatch = true
      continue
    }
    monthlyCost += monthlyEquivalentCents(cost.amountCents, cost.period ?? 'monthly')
  }

  data.monthlyChargeCents = monthlyCharge
  data.monthlyCostCents = monthlyCost
  data.monthlyMarginCents = monthlyCharge - monthlyCost
  data.costCurrencyMismatch = mismatch

  return data
}
