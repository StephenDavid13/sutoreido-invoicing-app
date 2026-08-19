import { render } from '@react-email/render'
import { formatISO } from 'date-fns'
import type { PayloadRequest } from 'payload'
import React from 'react'

import { ReceiptEmail, type ReceiptEmailModel } from '@/lib/email/templates/receipt'
import type { CurrencyCode } from '@/lib/money/currencies'
import { formatMoneyExplicit } from '@/lib/money/money'
import { notify } from '@/lib/notifications/create'
import { dateDDMMYYYY } from '@/lib/pdf/format'
import type { BusinessSetting, Client, Invoice } from '@/payload-types'

const idOf = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : v && typeof v === 'object' && 'id' in v ? Number((v as { id: unknown }).id) : undefined

/**
 * Composes a receipt when an invoice settles, and parks it in the outbox.
 *
 * Prepared, not sent. The operator's stated preference is that outbound mail is
 * triggered by a person, and a receipt is outbound mail — the fact that it carries
 * good news does not make it an exception. It lands in the same outbox as a
 * reminder and is sent by the same button.
 *
 * Keyed as kind `receipt`, so the unique (invoice, kind) index means an invoice can
 * only ever have one, however many times the rollup runs.
 */
export async function prepareReceipt(args: {
  req: PayloadRequest
  invoiceId: number
  paidCents: number
}): Promise<void> {
  const { req, invoiceId, paidCents } = args

  const invoice = (await req.payload.findByID({
    collection: 'invoices',
    id: invoiceId,
    depth: 1,
    req,
    disableErrors: true,
  })) as Invoice | null
  if (!invoice) return

  const client = invoice.client
  if (!client || typeof client !== 'object') return
  const to = (client as Client).email
  if (!to) return

  const ownerId = idOf(invoice.owner)
  if (!ownerId) return

  const settings = (await req.payload.findGlobal({
    slug: 'business-settings',
    depth: 0,
    req,
  })) as BusinessSetting

  const currency = invoice.currency as CurrencyCode
  const label = String(invoice.displayNumber ?? invoice.invoiceNumber ?? invoiceId)

  const model: ReceiptEmailModel = {
    reference: label,
    clientName: (client as Client).name,
    businessName: settings?.legalName || settings?.tradingName || '',
    amount: formatMoneyExplicit(paidCents, currency),
    receivedOn: invoice.paidAt ? dateDDMMYYYY(invoice.paidAt) : dateDDMMYYYY(new Date()),
    remaining: null,
  }

  try {
    const created = await req.payload.create({
      collection: 'invoice-reminders',
      data: {
        owner: ownerId,
        invoice: invoiceId,
        kind: 'receipt',
        state: 'prepared',
        toAddress: to,
        subject: `Payment received for invoice #${label}`,
        bodyHtml: await render(React.createElement(ReceiptEmail, { receipt: model })),
        balanceAtPrepared: 0,
        preparedAt: formatISO(new Date()),
      },
      req,
    })
    await notify({
      payload: req.payload,
      ownerId,
      kind: 'reminder_prepared',
      title: `Receipt ready for #${label}`,
      body: `${(client as Client).name} settled ${model.amount}. A receipt is composed and waiting.`,
      actionUrl: `/admin/collections/invoice-reminders/${created.id}`,
      dedupeKey: `receipt:${invoiceId}`,
    })
  } catch {
    // Unique (invoice, kind): a receipt already exists. Nothing to do.
  }
}
