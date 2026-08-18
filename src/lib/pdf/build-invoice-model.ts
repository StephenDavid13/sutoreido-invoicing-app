import type { BankAccount, BusinessSetting, Client, Invoice, InvoiceDefault } from '@/payload-types'
import type { CurrencyCode } from '@/lib/money/currencies'
import { formatAbn } from '@/lib/validation/abn'

import { dateDDMMYYYY, money, quantity } from './format'
import type { InvoicePdfModel, PdfColumn } from './model'

export const RENDERER_VERSION = '@react-pdf/renderer@4.5.1+tmpl1'

/**
 * The ONLY place that knows about both Payload documents and the PDF model.
 *
 * The document components take the model and nothing else — the predecessor's
 * rule that "the renderer never touches a database entity". That is what makes
 * the renderer testable and the archived model meaningful.
 */

function bankDetailsText(account: BankAccount | null | undefined): string | null {
  if (!account) return null
  // Invoice #1 (AU) needed two lines; invoice #5 (NZ) needed one.
  if (account.bsb) {
    return [
      'Account Details:',
      `BSB: ${account.bsb}`,
      `Account number: ${account.accountNumber}`,
    ].join('\n')
  }
  return `Account Number: ${account.accountNumber}`
}

function addressText(address: Client['address'] | BusinessSetting['address']): string | null {
  if (!address) return null

  // Require a real locating line before printing anything. `state` and `country`
  // carry defaults ('VIC', 'Australia'), so without this a client with no address
  // at all still printed "Australia" — and printed it on a New Zealand invoice.
  const hasSubstance = Boolean(
    address.line1?.trim() || address.line2?.trim() || address.city?.trim() || address.postcode?.trim(),
  )
  if (!hasSubstance) return null

  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state, address.postcode].filter(Boolean).join(' '),
    address.country,
  ].filter((p): p is string => Boolean(p && p.trim()))
  return parts.length ? parts.join('\n') : null
}

export function buildInvoicePdfModel(args: {
  invoice: Invoice
  client: Client
  bankAccount?: BankAccount | null
  settings: BusinessSetting
  defaults: InvoiceDefault
}): InvoicePdfModel {
  const { invoice, client, bankAccount, settings, defaults } = args
  const currency = invoice.currency as CurrencyCode
  const m = (cents: number) => money(cents, currency)

  const bankDetails = bankDetailsText(bankAccount)
  const placement = defaults.bankDetailsPlacement ?? 'terms'

  // ATO: the words "tax invoice" are only permitted when GST-registered. The
  // frozen per-invoice flag is authoritative, not today's setting — registering
  // later must not retroactively relabel a document already sent.
  const gstAtIssue = invoice.gstRegisteredAtIssue ?? false
  const taxRate = invoice.taxRateBasisPoints ?? 0
  const documentTitle: 'INVOICE' | 'TAX INVOICE' =
    gstAtIssue && taxRate > 0 ? 'TAX INVOICE' : 'INVOICE'

  const terms = (invoice.terms ?? '')
    .replaceAll('{{paymentTermsDays}}', String(invoice.paymentTermsDays ?? 0))
    .replaceAll(
      '{{bankDetails}}',
      placement === 'payable_to' ? '' : (bankDetails ?? ''),
    )
    .trim()

  // The quantity column's label is per-invoice ("Qty" on #1, "Hours" on #5);
  // every other label comes from settings.
  const columns: PdfColumn[] = defaults.columnLayout.map((col) => ({
    key: col.key,
    label: col.key === 'quantity' ? (invoice.qtyLabel ?? col.label) : col.label,
    ratio: col.ratio,
    align: col.align,
  }))

  const subtotal = invoice.subtotalCents ?? 0
  const total = invoice.totalCents ?? 0
  const discount = invoice.discountCents ?? 0

  return {
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    documentTitle,
    // Composed here rather than in the component: whether a document has a
    // number is a policy question (numbers are allocated on send), and drafts
    // must not print "#Draft" as though that were an invoice number.
    headingLabel: invoice.invoiceNumber
      ? `${documentTitle} #${invoice.displayNumber ?? invoice.invoiceNumber}`
      : `${documentTitle} (DRAFT)`,
    numberLabel: invoice.invoiceNumber
      ? (invoice.displayNumber ?? String(invoice.invoiceNumber))
      : 'Draft',
    issuedLabel: invoice.issuedDate ? dateDDMMYYYY(invoice.issuedDate) : '',
    dueLabel:
      invoice.dueMode === 'on_receipt'
        ? 'On Receipt'
        : invoice.dueDate
          ? dateDDMMYYYY(invoice.dueDate)
          : '',
    currency,
    billTo: {
      name: client.name,
      // Printed directly under the client name, which is where an ABN belongs on
      // an Australian invoice.
      abn: client.abn ? formatAbn(client.abn) : null,
      email: client.email ?? null,
      address: addressText(client.address),
    },
    payableTo: {
      name: settings.legalName || settings.tradingName,
      abn: formatAbn(settings.abn),
      email: settings.email,
      address: addressText(settings.address),
      bankDetails: placement === 'terms' ? null : bankDetails,
    },
    columns,
    items: (invoice.lineItems ?? []).map((item) => ({
      description: item.description,
      quantityLabel: quantity(item.quantityMilli ?? 0),
      unitPriceLabel: m(item.unitPriceCents ?? 0),
      lineTotalLabel: m(item.lineTotalCents ?? 0),
    })),
    // With no GST the subtotal equals the total, so printing both is noise —
    // the real invoice jumps straight to AMOUNT DUE.
    showSubtotal: Boolean(defaults.showSubtotalWhenUntaxed) || taxRate > 0 || discount > 0,
    subtotalLabel: m(subtotal),
    taxLine:
      taxRate > 0
        ? {
            label: `${invoice.taxLabel ?? 'GST'} (${taxRate / 100}%)`,
            amountLabel: m(invoice.taxCents ?? 0),
          }
        : null,
    discountLabel: discount > 0 ? `-${m(discount)}` : null,
    totalLabel: m(total),
    notes: invoice.notes ?? null,
    terms: terms || null,
    closingLine: defaults.closingLine ?? null,
    footerLine: defaults.footerLine ?? null,
    tableStyle: {
      gridBorders: defaults.tableStyle?.gridBorders ?? true,
      shadeBodyRows: defaults.tableStyle?.shadeBodyRows ?? true,
      boldDescription: defaults.tableStyle?.boldDescription ?? true,
    },
  }
}
