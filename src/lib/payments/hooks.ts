import { APIError } from 'payload'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from 'payload'

import type { Invoice } from '@/payload-types'

import { recomputeInvoicePayments } from './rollup'

const idOf = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.isFinite(Number(value)) ? Number(value) : undefined
  if (value && typeof value === 'object' && 'id' in value) return idOf((value as { id: unknown }).id)
  return undefined
}

/**
 * A payment must belong to an invoice that can receive one, in the invoice's own
 * currency, and it inherits the invoice's owner so a payment can never be filed
 * against someone else's record.
 */
export const validatePayment: CollectionBeforeChangeHook = async ({ data, req }) => {
  const invoiceId = idOf(data.invoice)
  if (!invoiceId) throw new APIError('A payment must name an invoice.', 400)

  const invoice = (await req.payload.findByID({
    collection: 'invoices',
    id: invoiceId,
    depth: 0,
    req,
    disableErrors: true,
  })) as Invoice | null

  if (!invoice) throw new APIError('That invoice does not exist.', 404)
  if (invoice.status === 'draft') {
    throw new APIError('A draft has not been issued, so it cannot be paid yet.', 409)
  }
  if (invoice.status === 'cancelled') {
    throw new APIError('This invoice was cancelled. Record the payment elsewhere.', 409)
  }

  data.owner = invoice.owner
  data.currency = invoice.currency
  return data
}

/** Recompute after the payment row is committed, so the sum includes it. */
export const rollupAfterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  const invoiceId = idOf(doc.invoice)
  if (invoiceId) await recomputeInvoicePayments({ req, invoiceId })
  return doc
}

export const rollupAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const invoiceId = idOf(doc.invoice)
  if (invoiceId) await recomputeInvoicePayments({ req, invoiceId })
  return doc
}
