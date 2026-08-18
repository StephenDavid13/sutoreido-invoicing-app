import { lineTotalCents, taxAmountCents } from '@/lib/money/money'

export type LineItemInput = {
  quantityMilli?: number | null
  unitPriceCents?: number | null
  lineTotalCents?: number | null
}

export type InvoiceTotals = {
  lineTotals: number[]
  subtotalCents: number
  taxCents: number
  totalCents: number
}

/**
 * The single authority on invoice arithmetic. Called from the invoice
 * beforeChange hook; the stored totals are readOnly in the admin so a
 * client-supplied value is always discarded.
 *
 * Rounding happens exactly once, per line. The subtotal is the plain sum of
 * already-rounded line totals and is never re-rounded — otherwise the Total
 * column on the PDF can fail to add up to AMOUNT DUE by a cent, which is the
 * error clients actually notice and email about.
 */
export function computeInvoiceTotals(args: {
  lineItems: LineItemInput[] | null | undefined
  /** 1000 = 10%. Zero while not GST-registered. */
  taxRateBasisPoints?: number | null
  discountCents?: number | null
}): InvoiceTotals {
  const { lineItems, taxRateBasisPoints, discountCents } = args

  const lineTotals = (lineItems ?? []).map((item) =>
    lineTotalCents(item.quantityMilli ?? 0, item.unitPriceCents ?? 0),
  )

  const subtotalCents = lineTotals.reduce((sum, value) => sum + value, 0)
  const discount = discountCents ?? 0

  // Tax applies to the discounted subtotal — discounting after tax would
  // overstate the GST collected.
  const taxableCents = subtotalCents - discount
  const taxCents = taxAmountCents(taxableCents, taxRateBasisPoints ?? 0)

  return {
    lineTotals,
    subtotalCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  }
}
