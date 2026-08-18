/**
 * Billing period arithmetic for recurring services.
 *
 * Two decisions, both load-bearing.
 *
 * 1. ALL arithmetic is UTC. A billing date is a "day only" fact, and date-fns
 *    operates in the local timezone by design — `startOfDay(new Date('2026-01-31'))`
 *    in Melbourne (UTC+11) yields 30 January in UTC terms. Invoice dates are
 *    stored as UTC midnight, so mixing the two silently shifts billing dates by a
 *    day, which on a legal document is not acceptable.
 *
 * 2. The next billing date is always `startDate + (periodsBilled x months)`,
 *    never the previous date plus a month. Incremental addition drifts: a service
 *    starting 31 January goes 31 Jan -> 28 Feb (clamped) -> 28 Mar -> 28 Apr and
 *    the billing day has moved permanently. Anchoring to the start date means
 *    February clamps once and March returns to the 31st.
 */

export const BILLING_PERIODS = ['monthly', 'quarterly', 'annually'] as const
export type BillingPeriod = (typeof BILLING_PERIODS)[number]

export const MONTHS_PER_PERIOD: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  annually: 12,
}

export const BILLING_PERIOD_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annually', value: 'annually' },
]

/** Cost periods add 'one_off', which never contributes to a monthly figure. */
export const COST_PERIODS = ['one_off', 'monthly', 'quarterly', 'annually'] as const
export type CostPeriod = (typeof COST_PERIODS)[number]

export const COST_PERIOD_OPTIONS = [
  { label: 'One-off', value: 'one_off' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annually', value: 'annually' },
]

const asDate = (value: string | Date): Date =>
  typeof value === 'string' ? new Date(value) : value

/** UTC midnight of the given instant's calendar date. */
export function startOfDayUTC(value: string | Date): Date {
  const d = asDate(value)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function daysInMonthUTC(year: number, monthIndex: number): number {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/** Adds whole months in UTC, clamping the day to the target month's length. */
export function addMonthsUTC(value: string | Date, months: number): Date {
  const d = startOfDayUTC(value)
  const day = d.getUTCDate()
  const shifted = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const year = shifted.getUTCFullYear()
  const monthIndex = shifted.getUTCMonth()
  return new Date(Date.UTC(year, monthIndex, Math.min(day, daysInMonthUTC(year, monthIndex))))
}

/** Drift-free: always measured from the anchor, never from the last result. */
export function nthPeriodStart(
  startDate: string | Date,
  periodsBilled: number,
  period: BillingPeriod,
): Date {
  return addMonthsUTC(startDate, periodsBilled * MONTHS_PER_PERIOD[period])
}

export function nextInvoiceDate(
  startDate: string | Date,
  periodsBilled: number,
  period: BillingPeriod,
): string {
  return nthPeriodStart(startDate, periodsBilled, period).toISOString()
}

/**
 * A cost's monthly equivalent, for margin display only.
 *
 * Deliberately rounded: a $25/year domain is $2.0833/month and there is no exact
 * answer in cents. This figure is for comparison on a dashboard and never lands
 * on an invoice — invoices only ever use `chargeCents`.
 */
export function monthlyEquivalentCents(amountCents: number, period: CostPeriod): number {
  if (period === 'one_off') return 0
  return Math.round(amountCents / MONTHS_PER_PERIOD[period])
}

/** How many whole periods have started, and are therefore billable, by `asAt`. */
export function periodsDue(
  startDate: string | Date,
  periodsBilled: number,
  period: BillingPeriod,
  asAt: string | Date,
): number {
  const cutoff = startOfDayUTC(asAt)
  let due = 0
  // Bounded so a long-dormant service cannot spin here; 240 monthly periods is
  // 20 years, and the caller decides whether to catch up or skip.
  while (due < 240) {
    if (nthPeriodStart(startDate, periodsBilled + due, period) > cutoff) break
    due++
  }
  return due
}
