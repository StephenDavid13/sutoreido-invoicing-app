import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { getPayloadUnscoped_DANGEROUS } from '@/lib/auth/dal'
import type { CurrencyCode } from '@/lib/money/currencies'
import { formatMoneyExplicit, formatQuantity } from '@/lib/money/money'
import { dateDDMMYYYY } from '@/lib/pdf/format'
import { formatAbn } from '@/lib/validation/abn'

/**
 * The invoice as a readable web page: the shareable link, in the same world as
 * the bench but on the material a document is made of.
 *
 * The bench is dark because it is used at night by one person. A document resting
 * on it is pale, because that is what a document is. That is material logic, not
 * a theme flip, and it means the page a client opens is a white sheet.
 *
 * Access, per the plan's decision D5: this route does NOT expose the invoices
 * collection through a public Payload access rule, which would hand out arbitrary
 * `where` filtering over every invoice. It resolves one token, then projects an
 * explicit DTO. Nothing that is not on this page leaves the server.
 */
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ token: string }> }

type PublicLine = {
  description: string
  quantity: string
  unitPrice: string
  lineTotal: string
}

type PublicInvoice = {
  documentTitle: string
  reference: string
  issued: string
  dueLabel: string
  billTo: { name: string; abn: string | null }
  payableTo: {
    name: string
    abn: string
    email: string
    bank: string | null
  }
  qtyLabel: string
  lines: PublicLine[]
  showSubtotal: boolean
  subtotal: string
  tax: { label: string; amount: string } | null
  total: string
  terms: string | null
  notes: string | null
  closing: string | null
  paid: boolean
}

async function loadByToken(token: string): Promise<PublicInvoice | null> {
  if (!token || token.length < 16) return null

  // Deliberate escape hatch: a public reader has no session for access control to
  // resolve against, so the token itself is the authorisation.
  const payload = await getPayloadUnscoped_DANGEROUS()

  const found = await payload.find({
    collection: 'invoices',
    where: { shareToken: { equals: token } },
    limit: 1,
    depth: 2,
  })

  const invoice = found.docs[0]
  if (!invoice) return null
  // A draft has no token, but belt and braces: never serve one publicly.
  if (invoice.status === 'draft') return null

  const client = typeof invoice.client === 'object' ? invoice.client : null
  const bank = typeof invoice.bankAccount === 'object' ? invoice.bankAccount : null
  const [settings, defaults] = await Promise.all([
    payload.findGlobal({ slug: 'business-settings', depth: 0 }),
    payload.findGlobal({ slug: 'invoice-defaults', depth: 0 }),
  ])

  const currency = invoice.currency as CurrencyCode
  const m = (c: number) => formatMoneyExplicit(c, currency)
  const taxRate = invoice.taxRateBasisPoints ?? 0
  const gstAtIssue = invoice.gstRegisteredAtIssue ?? false

  const bankText = bank
    ? bank.bsb
      ? `BSB ${bank.bsb} · Account ${bank.accountNumber}`
      : `Account ${bank.accountNumber}`
    : null

  return {
    // The ATO forbids the words "tax invoice" while not GST-registered, and the
    // flag frozen at issue is authoritative, not today's setting.
    documentTitle: gstAtIssue && taxRate > 0 ? 'Tax invoice' : 'Invoice',
    reference: invoice.displayNumber ?? String(invoice.invoiceNumber ?? ''),
    issued: invoice.issuedDate ? dateDDMMYYYY(invoice.issuedDate) : '',
    dueLabel:
      invoice.dueMode === 'on_receipt'
        ? 'On receipt'
        : invoice.dueDate
          ? dateDDMMYYYY(invoice.dueDate)
          : '',
    billTo: {
      name: client?.name ?? 'Client',
      abn: client?.abn ? formatAbn(client.abn) : null,
    },
    payableTo: {
      name: settings?.legalName || settings?.tradingName || '',
      abn: settings?.abn ? formatAbn(settings.abn) : '',
      email: settings?.email ?? '',
      bank: bankText,
    },
    qtyLabel: invoice.qtyLabel ?? 'Qty',
    lines: (invoice.lineItems ?? []).map((line) => ({
      description: line.description,
      quantity: formatQuantity(line.quantityMilli ?? 0),
      unitPrice: m(line.unitPriceCents ?? 0),
      lineTotal: m(line.lineTotalCents ?? 0),
    })),
    showSubtotal: taxRate > 0 || (invoice.discountCents ?? 0) > 0,
    subtotal: m(invoice.subtotalCents ?? 0),
    tax:
      taxRate > 0
        ? {
            label: `${invoice.taxLabel ?? 'GST'} (${taxRate / 100}%)`,
            amount: m(invoice.taxCents ?? 0),
          }
        : null,
    total: m(invoice.totalCents ?? 0),
    terms: invoice.terms ?? null,
    notes: invoice.notes ?? null,
    closing: defaults?.closingLine ?? null,
    paid: invoice.status === 'paid',
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params
  const invoice = await loadByToken(token)
  if (!invoice) return { title: 'Not found' }
  return {
    title: `${invoice.documentTitle} #${invoice.reference} · ${invoice.payableTo.name}`,
    robots: { index: false, follow: false },
  }
}

export default async function PublicInvoicePage({ params }: Params) {
  const { token } = await params
  const invoice = await loadByToken(token)
  if (!invoice) notFound()

  return (
    <div className="plate-surface min-h-screen py-10 md:py-16">
      <article className="mx-auto max-w-[46rem] px-6 md:px-10">
        {/* The document's own head. Right-aligned, as on the printed sheet. */}
        <header className="flex flex-col gap-6 border-b border-black/15 pb-7 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[26px] leading-none font-semibold tracking-[-0.02em] md:text-[32px]">
              {invoice.documentTitle} #{invoice.reference}
            </h1>
            {invoice.paid ? (
              <span className="mark-stamp text-plate-ink-2 mt-3 inline-block text-[10px] font-semibold uppercase">
                Paid
              </span>
            ) : null}
          </div>
          <dl className="text-[13px] sm:text-right">
            <div className="flex gap-2 sm:justify-end">
              <dt className="font-semibold">Issued</dt>
              <dd className="figure tabular-nums">{invoice.issued}</dd>
            </div>
            <div className="mt-1 flex gap-2 sm:justify-end">
              <dt className="font-semibold">Due</dt>
              <dd className="figure tabular-nums">{invoice.dueLabel}</dd>
            </div>
          </dl>
        </header>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]">Bill to</h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              {invoice.billTo.name}
              {invoice.billTo.abn ? (
                <>
                  <br />
                  ABN {invoice.billTo.abn}
                </>
              ) : null}
            </p>
          </section>
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]">Payable to</h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              {invoice.payableTo.name}
              <br />
              ABN {invoice.payableTo.abn}
              <br />
              {invoice.payableTo.email}
              {invoice.payableTo.bank ? (
                <>
                  <br />
                  {invoice.payableTo.bank}
                </>
              ) : null}
            </p>
          </section>
        </div>

        <table className="mt-10 w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-black/25 text-left">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Description
              </th>
              <th scope="col" className="py-2 px-3 text-right font-semibold">
                {invoice.qtyLabel}
              </th>
              <th scope="col" className="py-2 px-3 text-right font-semibold">
                Price
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index} className="border-b border-black/10">
                <td className="py-3 pr-3">{line.description}</td>
                <td className="py-3 px-3 text-right tabular-nums">{line.quantity}</td>
                <td className="py-3 px-3 text-right tabular-nums">{line.unitPrice}</td>
                <td className="py-3 pl-3 text-right tabular-nums">{line.lineTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex flex-col items-end gap-1 text-[14px]">
          {invoice.showSubtotal ? (
            <p>
              <span className="font-semibold">Subtotal </span>
              <span className="tabular-nums">{invoice.subtotal}</span>
            </p>
          ) : null}
          {invoice.tax ? (
            <p>
              <span className="font-semibold">{invoice.tax.label} </span>
              <span className="tabular-nums">{invoice.tax.amount}</span>
            </p>
          ) : null}
          <p className="mt-1 text-[18px] font-semibold">
            Amount due <span className="tabular-nums">{invoice.total}</span>
          </p>
        </div>

        {invoice.notes ? (
          <section className="mt-10">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]">Notes</h2>
            <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed whitespace-pre-line">
              {invoice.notes}
            </p>
          </section>
        ) : null}

        {invoice.terms ? (
          <section className="mt-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Terms &amp; conditions
            </h2>
            <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed whitespace-pre-line">
              {invoice.terms}
            </p>
          </section>
        ) : null}

        {invoice.closing ? (
          <p className="mt-10 max-w-[65ch] text-[14px] leading-relaxed">{invoice.closing}</p>
        ) : null}

        <footer className="mt-12 border-t border-black/15 pt-5">
          <a
            href={`/api/i/${token}/pdf`}
            className="text-[13px] font-semibold uppercase tracking-[0.1em] underline decoration-1"
          >
            Download PDF
          </a>
        </footer>
      </article>
    </div>
  )
}
