import { formatMoneyExplicit, formatQuantity } from '@/lib/money/money'
import type { CurrencyCode } from '@/lib/money/currencies'

export const money = (cents: number, currency: CurrencyCode) =>
  formatMoneyExplicit(cents, currency)

export const quantity = (quantityMilli: number) => formatQuantity(quantityMilli)

/**
 * dd/MM/yyyy, the Australian convention, built from explicit UTC date parts.
 *
 * Not Intl, and not the local timezone: an invoice date is a "day only" fact on
 * a legal document. Formatting `2026-08-08T00:00:00Z` in a UTC-running lambda
 * with a naive local conversion can print 07/08/2026 — an off-by-one day.
 */
export function dateDDMMYYYY(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}
