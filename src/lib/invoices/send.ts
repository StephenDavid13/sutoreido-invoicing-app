import 'server-only'

import { render } from '@react-email/render'
import { formatISO } from 'date-fns'
import { APIError } from 'payload'
import type { Payload, PayloadRequest } from 'payload'
import React from 'react'

import { deliver } from '@/lib/email/deliver'
import { InvoiceSentEmail, type InvoiceEmailModel } from '@/lib/email/templates/invoice-sent'
import { formatMoneyExplicit } from '@/lib/money/money'
import type { CurrencyCode } from '@/lib/money/currencies'
import { buildInvoicePdfModel } from '@/lib/pdf/build-invoice-model'
import { dateDDMMYYYY } from '@/lib/pdf/format'
import { renderInvoicePdf } from '@/lib/pdf/render'
import type { BankAccount, BusinessSetting, Client, Invoice, InvoiceDefault } from '@/payload-types'

export type SendResult = {
  invoiceId: number
  reference: string
  to: string
  cc: string[]
  delivered: boolean
  note: string
  archivedPdfId: number | null
}

const idOf = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : v && typeof v === 'object' && 'id' in v ? Number((v as { id: unknown }).id) : undefined

/** Primary billing address plus any contact flagged to be copied. */
function recipients(client: Client): { to: string | null; cc: string[] } {
  const cc = (client.contacts ?? [])
    .filter((c) => c.ccOnInvoices && c.email)
    .map((c) => c.email as string)
  return { to: client.email ?? null, cc }
}

function paymentLine(bank: BankAccount | null, currency: CurrencyCode): string | null {
  if (!bank) return null
  const detail = bank.bsb
    ? `BSB ${bank.bsb}, account ${bank.accountNumber}`
    : `account ${bank.accountNumber}`
  return `Payment by direct transfer in ${currency} to ${detail}.`
}

/**
 * Sends an invoice to its client.
 *
 * Order matters and is deliberate:
 *
 *  1. Transition to `sent` FIRST, because that is what mints the invoice number
 *     and the share token, and the number has to appear in the PDF.
 *  2. Render and ARCHIVE the PDF. The archived bytes are what the client received
 *     and are never re-rendered: react-pdf embeds a creation timestamp, so a later
 *     render would not be the same document.
 *  3. Email it, with those exact archived bytes attached.
 *
 * If the email fails after step 1, the invoice stays `sent` and the failure is
 * recorded on `deliveryState` for retry. Rolling the status back would burn an
 * invoice number and put a hole in the issued sequence, which is worse than a
 * document that is issued but not yet delivered.
 */
export async function sendInvoice(args: {
  payload: Payload
  req?: PayloadRequest
  invoiceId: number
  /** Re-send an already-sent invoice using its archived PDF. */
  resend?: boolean
}): Promise<SendResult> {
  const { payload, invoiceId, resend = false } = args

  let invoice = (await payload.findByID({
    collection: 'invoices',
    id: invoiceId,
    depth: 1,
    disableErrors: true,
  })) as Invoice | null
  if (!invoice) throw new APIError('That invoice does not exist.', 404)

  if (invoice.status === 'cancelled') {
    throw new APIError('This invoice was cancelled and cannot be sent.', 409)
  }
  if (invoice.status !== 'draft' && !resend) {
    throw new APIError(
      'This invoice has already been issued. Use re-send if you need to deliver it again.',
      409,
    )
  }

  const client = invoice.client
  if (!client || typeof client !== 'object') {
    throw new APIError('This invoice has no client attached.', 409)
  }
  const { to, cc } = recipients(client as Client)
  if (!to) {
    throw new APIError(
      `${(client as Client).name} has no email address. Add one before sending.`,
      409,
    )
  }

  // 1. Issue it. The hooks mint the number, the share token and the GST posture.
  if (invoice.status === 'draft') {
    invoice = (await payload.update({
      collection: 'invoices',
      id: invoiceId,
      data: { status: 'sent' },
      depth: 1,
    })) as Invoice
  }

  const [settings, defaults] = await Promise.all([
    payload.findGlobal({ slug: 'business-settings', depth: 0 }) as Promise<BusinessSetting>,
    payload.findGlobal({ slug: 'invoice-defaults', depth: 0 }) as Promise<InvoiceDefault>,
  ])

  const bank =
    invoice.bankAccount && typeof invoice.bankAccount === 'object'
      ? (invoice.bankAccount as BankAccount)
      : null

  const model = buildInvoicePdfModel({
    invoice,
    client: client as Client,
    bankAccount: bank,
    settings,
    defaults,
  })

  // 2. Archive once. An existing archive is the record and is never replaced.
  let archivedPdfId = idOf(invoice.archivedPdf) ?? null
  let pdf: Buffer

  if (archivedPdfId) {
    const existing = await payload.findByID({ collection: 'media', id: archivedPdfId, depth: 0 })
    const url = existing?.url
    pdf = url
      ? Buffer.from(await (await fetch(new URL(url, process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'))).arrayBuffer())
      : await renderInvoicePdf(model)
  } else {
    pdf = await renderInvoicePdf(model)
    const filename = `invoice-${model.numberLabel}.pdf`
    const media = await payload.create({
      collection: 'media',
      data: {
        alt: `${model.documentTitle} ${model.numberLabel} for ${(client as Client).name}`,
        kind: 'invoice-pdf',
      },
      file: { data: pdf, mimetype: 'application/pdf', name: filename, size: pdf.length },
    })
    archivedPdfId = Number(media.id)
    await payload.update({
      collection: 'invoices',
      id: invoiceId,
      data: { archivedPdf: archivedPdfId },
    })
  }

  // 3. Deliver.
  const origin = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const documentUrl = invoice.shareToken ? `${origin}/i/${invoice.shareToken}` : null
  const currency = invoice.currency as CurrencyCode

  const emailModel: InvoiceEmailModel = {
    documentTitle: model.documentTitle === 'TAX INVOICE' ? 'Tax invoice' : 'Invoice',
    reference: model.numberLabel,
    clientName: (client as Client).name,
    businessName: settings?.legalName || settings?.tradingName || '',
    issued: invoice.issuedDate ? dateDDMMYYYY(invoice.issuedDate) : '',
    dueLabel: model.dueLabel,
    total: formatMoneyExplicit(invoice.totalCents ?? 0, currency),
    documentUrl,
    paymentLine: paymentLine(bank, currency),
    closing: defaults?.closingLine ?? null,
  }

  const subject = `${emailModel.documentTitle} #${emailModel.reference} from ${emailModel.businessName}`
  const html = await render(React.createElement(InvoiceSentEmail, { invoice: emailModel }))

  const outcome = await deliver({
    payload,
    to,
    cc,
    subject,
    html,
    attachments: [{ filename: `invoice-${model.numberLabel}.pdf`, content: pdf }],
  })
  const { delivered, note, state } = outcome

  await payload.update({
    collection: 'invoices',
    id: invoiceId,
    data: {
      emailedAt: delivered ? formatISO(new Date()) : undefined,
      deliveryState: state,
      deliveryNote: note,
    },
  })

  return {
    invoiceId,
    reference: model.numberLabel,
    to,
    cc,
    delivered,
    note,
    archivedPdfId,
  }
}
