/**
 * Single source of truth for currency. The whitelist is ported from the
 * predecessor's FluentValidation boundary (Sutoredo.Application/Validators).
 */

export const SUPPORTED_CURRENCIES = ['AUD', 'NZD', 'USD', 'PHP'] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

type CurrencyMeta = {
  label: string
  locale: string
  /**
   * Disambiguating prefix used on PDFs.
   *
   * The predecessor formatted AUD/NZD/USD with .NET's "C" specifier under
   * en-AU/en-NZ/en-US, which renders all three as a bare "$" — so an Australian
   * and a New Zealand invoice looked identical. Stephen bills in both, so the
   * document must say which dollar it means.
   */
  pdfPrefix: string
  /** ISO 4217 minor unit exponent. All four supported currencies are 2. */
  minorUnitExponent: number
}

export const CURRENCY_META: Record<CurrencyCode, CurrencyMeta> = {
  AUD: { label: 'Australian dollar', locale: 'en-AU', pdfPrefix: 'A$', minorUnitExponent: 2 },
  NZD: { label: 'New Zealand dollar', locale: 'en-NZ', pdfPrefix: 'NZ$', minorUnitExponent: 2 },
  USD: { label: 'US dollar', locale: 'en-US', pdfPrefix: 'US$', minorUnitExponent: 2 },
  PHP: { label: 'Philippine peso', locale: 'en-PH', pdfPrefix: '₱', minorUnitExponent: 2 },
}

export const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((code) => ({
  label: `${code} — ${CURRENCY_META[code].label}`,
  value: code,
}))

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}
