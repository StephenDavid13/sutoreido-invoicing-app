import type { CurrencyCode } from '@/lib/money/currencies'

/**
 * The render contract.
 *
 * Must stay JSON-serialisable: it is persisted verbatim alongside the archived
 * PDF as the record of what was rendered, and later becomes a job payload.
 * So no Date, no bigint, no class instances.
 */

export type PdfPartyInfo = {
  name: string
  email?: string | null
  address?: string | null // may contain newlines
  abn?: string | null // rendered for BOTH parties; the predecessor dropped the client's
  bankDetails?: string | null // may contain newlines
}

export type PdfLineItem = {
  description: string
  quantityLabel: string // pre-formatted, trailing zeros dropped
  unitPriceLabel: string
  lineTotalLabel: string
}

/** `null` is how GST-absence is expressed. The components know nothing about registration. */
export type PdfTaxLine = null | { label: string; amountLabel: string }

export type PdfColumn = {
  key: 'description' | 'quantity' | 'unitPrice' | 'lineTotal'
  label: string
  ratio: number
  align: 'left' | 'right'
}

export type InvoicePdfModel = {
  schemaVersion: 1
  rendererVersion: string
  /** ATO: must be INVOICE, never TAX INVOICE, while not GST-registered. */
  documentTitle: 'INVOICE' | 'TAX INVOICE'
  /** Pre-composed page heading, e.g. "INVOICE #6" or "INVOICE (DRAFT)". */
  headingLabel: string
  /** Bare number for the filename. "Draft" when none has been allocated. */
  numberLabel: string
  issuedLabel: string // pre-formatted dd/MM/yyyy
  dueLabel: string // 'On Receipt' or dd/MM/yyyy
  currency: CurrencyCode
  billTo: PdfPartyInfo
  payableTo: PdfPartyInfo
  columns: PdfColumn[]
  items: PdfLineItem[]
  showSubtotal: boolean
  subtotalLabel: string
  taxLine: PdfTaxLine
  discountLabel?: string | null
  totalLabel: string
  notes?: string | null
  terms?: string | null
  closingLine?: string | null
  footerLine?: string | null
  tableStyle: {
    gridBorders: boolean
    shadeBodyRows: boolean
    boldDescription: boolean
  }
}
