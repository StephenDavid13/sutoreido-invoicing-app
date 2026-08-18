import { CURRENCY_META, type CurrencyCode } from './currencies'

/**
 * Money is stored as integer minor units ("cents") everywhere — in the database,
 * in job payloads and in the PDF render model. Never floats.
 *
 * Payload `number` fields compile to unconstrained Postgres `numeric`, which is
 * exact arbitrary-precision decimal, so an integer round-trips exactly. We do not
 * force `bigint`: it would desynchronise drizzle-kit's push/snapshot diffing from
 * Payload's rawTables model, and node-postgres returns bigint as a *string*.
 * 2^53 cents is about A$90 trillion, which is enough.
 */

/** Quantities are stored as integer thousandths so 7.5 hours is exact. */
export const QUANTITY_SCALE = 1000

/**
 * Round half away from zero, matching the predecessor's
 * `Math.Round(x, 2, MidpointRounding.AwayFromZero)`.
 *
 * JS `Math.round` is half-UP (toward +Infinity), which differs for negatives:
 * Math.round(-0.5) is -0, but away-from-zero gives -1. Credit notes and
 * discounts make negative line totals reachable, so the distinction is real.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/**
 * A single line's total, in cents.
 *
 * Rounding happens exactly ONCE, here, at the line level. The subtotal is then
 * the plain sum of already-rounded line totals and is never re-rounded. This is
 * the ATO's "taxable sale rule", and it is also what makes the Total column on
 * the PDF actually add up to AMOUNT DUE — the thing clients notice.
 */
export function lineTotalCents(quantityMilli: number, unitPriceCents: number): number {
  return roundHalfAwayFromZero((quantityMilli * unitPriceCents) / QUANTITY_SCALE)
}

/** Tax on an already-summed subtotal. `rateBasisPoints` of 1000 means 10%. */
export function taxAmountCents(subtotalCents: number, rateBasisPoints: number): number {
  return roundHalfAwayFromZero((subtotalCents * rateBasisPoints) / 10_000)
}

export function formatMoney(cents: number, currency: CurrencyCode): string {
  const { locale } = CURRENCY_META[currency]
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Disambiguates AUD/NZD/USD, which all render as a bare "$" under their own
 * locales — so an Australian and a New Zealand figure look identical. Use this
 * anywhere both currencies can appear: invoices, reports, dashboards.
 */
export function formatMoneyExplicit(cents: number, currency: CurrencyCode): string {
  const { locale, pdfPrefix } = CURRENCY_META[currency]
  const negative = cents < 0
  const body = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100)
  return `${negative ? '-' : ''}${pdfPrefix}${body}`
}

/**
 * Quantity display: up to 3 decimal places, trailing zeros dropped — the
 * predecessor's "0.###". 2 renders as "2", 1.5 as "1.5", 7.25 as "7.25".
 */
export function formatQuantity(quantityMilli: number): string {
  const value = quantityMilli / QUANTITY_SCALE
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(value)
}

/** 1000 -> "10", 825 -> "8.25". Matches the predecessor's "0.##" on tax rates. */
export function formatPercentFromBasisPoints(basisPoints: number): string {
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(basisPoints / 100)
}
