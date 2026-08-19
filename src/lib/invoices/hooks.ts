import { randomBytes } from 'node:crypto'

import { addDays, formatISO } from 'date-fns'
import { APIError } from 'payload'
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'

import { allocateNextNumber } from './numbering'
import {
  assertInvoiceTransition,
  InvalidStateTransitionError,
  type InvoiceStatus,
} from './state-machine'
import { computeInvoiceTotals } from './totals'

/**
 * Derives dueDate from dueMode.
 *
 * Both real invoices print "Due: On Receipt" in the header while their terms
 * clause says 7 days (#1) or 15 days (#5). Those are two different facts, so
 * they are two different fields: `dueMode` drives the header line, and
 * `paymentTermsDays` drives both the stored dueDate and the terms text. The
 * reminder engine keys off dueDate, so "on receipt" still needs a real date.
 */
export const deriveDueDate: CollectionBeforeChangeHook = ({ data }) => {
  const issued = data.issuedDate ? new Date(data.issuedDate) : null
  if (!issued || Number.isNaN(issued.getTime())) return data

  switch (data.dueMode) {
    case 'on_receipt':
      data.dueDate = formatISO(issued)
      break
    case 'net_days':
      data.dueDate = formatISO(addDays(issued, Number(data.paymentTermsDays ?? 0)))
      break
    case 'fixed_date':
      // Left as entered, but it can never precede the issue date.
      if (data.dueDate && new Date(data.dueDate) < issued) {
        throw new APIError('Due date must be on or after the issued date.', 400)
      }
      break
  }

  return data
}

/**
 * Totals are hook-authoritative: whatever the client sent is overwritten. The
 * stored fields are readOnly in the admin, and this is what makes that true at
 * the API level too.
 */
export const recalculateTotals: CollectionBeforeChangeHook = ({ data }) => {
  const { lineTotals, subtotalCents, taxCents, totalCents } = computeInvoiceTotals({
    lineItems: data.lineItems,
    taxRateBasisPoints: data.taxRateBasisPoints,
    discountCents: data.discountCents,
  })

  if (Array.isArray(data.lineItems)) {
    data.lineItems = data.lineItems.map((item: Record<string, unknown>, index: number) => ({
      ...item,
      lineTotalCents: lineTotals[index] ?? 0,
    }))
  }

  data.subtotalCents = subtotalCents
  data.taxCents = taxCents
  data.totalCents = totalCents
  data.balanceCents = totalCents - (data.amountPaidCents ?? 0)

  return data
}

/**
 * Enforces the ported state machine and blocks line-item edits outside draft.
 *
 * Payload has no state-machine primitive, so this is where Draft -> Sent -> Paid
 * lives. `originalDoc` is absent on create, and a create always starts at draft.
 */
export const enforceInvoiceStateMachine: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation === 'create') {
    data.status = data.status ?? 'draft'
    return data
  }

  const from = originalDoc?.status as InvoiceStatus | undefined
  const to = data.status as InvoiceStatus | undefined
  if (!from || !to) return data

  if (from !== to) {
    const isAdminOverride = Boolean(data._adminOverride) && req.user?.role === 'admin'

    if (isAdminOverride && !data._overrideReason) {
      throw new APIError('A reason is required when forcing a status change.', 400)
    }

    try {
      assertInvoiceTransition(from, to, isAdminOverride)
    } catch (error) {
      if (error instanceof InvalidStateTransitionError) {
        throw new APIError(error.message, 409)
      }
      throw error
    }

    if (to === 'sent' && !data.sentAt) data.sentAt = formatISO(new Date())
    if (to === 'paid' && !data.paidAt) data.paidAt = formatISO(new Date())
  }

  // Ported invariant: items are only mutable while the invoice is a draft.
  // Once sent, the document the client received must not silently change.
  if (from !== 'draft' && lineItemsChanged(originalDoc?.lineItems, data.lineItems)) {
    throw new APIError('Line items can only be changed while the invoice is a draft.', 409)
  }

  return data
}

function lineItemsChanged(before: unknown, after: unknown): boolean {
  if (after === undefined) return false
  return JSON.stringify(normaliseLines(before)) !== JSON.stringify(normaliseLines(after))
}

function normaliseLines(lines: unknown): unknown[] {
  if (!Array.isArray(lines)) return []
  return lines.map((line: Record<string, unknown>) => ({
    description: line.description ?? null,
    quantityMilli: line.quantityMilli ?? null,
    unitPriceCents: line.unitPriceCents ?? null,
    unit: line.unit ?? null,
  }))
}

/**
 * Allocates the invoice number.
 *
 * Default policy is "on send": a draft that is edited, abandoned or deleted
 * never consumes a number, so the issued sequence has no holes in it. Set
 * business-settings.numberAllocationMode to `onCreate` for the predecessor's
 * behaviour.
 *
 * Idempotent — once invoiceNumber is set it is never reallocated.
 */
export const allocateNumberOnSend: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (data.invoiceNumber) return data

  const settings = await req.payload.findGlobal({ slug: 'business-settings', req, depth: 0 })
  const mode = settings?.numberAllocationMode ?? 'onSend'

  const becomingSent = data.status === 'sent' && originalDoc?.status !== 'sent'
  const shouldAllocate =
    mode === 'onCreate' ? operation === 'create' || becomingSent : becomingSent

  if (!shouldAllocate) return data

  const ownerId = typeof data.owner === 'object' ? data.owner?.id : data.owner
  if (!ownerId) throw new APIError('An invoice must have an owner before it can be numbered.', 500)

  data.invoiceNumber = await allocateNextNumber({ req, ownerId, kind: 'invoice' })

  // Freeze the GST posture at issue time so a future registration never
  // retroactively relabels this document as a TAX INVOICE.
  data.gstRegisteredAtIssue = Boolean(settings?.gstRegistered)

  return data
}

/**
 * Mints the share token when an invoice is first sent.
 *
 * Opaque and revocable: 128 bits of randomness, base64url, no relationship to
 * the invoice id or number. Only sent invoices get one, so a draft has no
 * reachable public URL at all rather than one guarded by status alone.
 */
export const mintShareToken: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (data.shareToken) return data
  const becomingSent = data.status === 'sent' && originalDoc?.status !== 'sent'
  if (!becomingSent) return data
  data.shareToken = randomBytes(16).toString('base64url')
  return data
}

/**
 * Keeps `displayNumber` in step with `invoiceNumber`.
 *
 * Only does work when the number actually changes — which is once, at
 * allocation — so the settings lookup is not paid on every save.
 */
export const maintainDisplayNumber: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const number = data.invoiceNumber
  if (number === undefined || number === null) {
    data.displayNumber = data.displayNumber ?? 'Draft'
    return data
  }
  if (originalDoc?.invoiceNumber === number && data.displayNumber) return data

  const settings = await req.payload.findGlobal({ slug: 'business-settings', req, depth: 0 })
  const prefix = settings?.numberPrefix ?? ''
  const padding = Number(settings?.numberPadding ?? 0)

  data.displayNumber = `${prefix}${String(number).padStart(padding, '0')}`
  return data
}

/**
 * Refuses to send an invoice that asks for nothing.
 *
 * A $0.00 invoice reaching a client is worse than an error: it looks like a
 * billing mistake and invites a confused reply. This runs AFTER totals are
 * recalculated, and because number allocation shares the same transaction, a
 * rejection here rolls the allocated number back rather than burning it.
 */
export const guardSendableInvoice: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const becomingSent = data.status === 'sent' && originalDoc?.status !== 'sent'
  if (!becomingSent) return data

  if (!Array.isArray(data.lineItems) || data.lineItems.length === 0) {
    throw new APIError('An invoice needs at least one line item before it can be sent.', 400)
  }
  if (!data.totalCents || data.totalCents <= 0) {
    throw new APIError(
      'This invoice totals $0.00, so it cannot be sent. Check the quantity and unit price on each line.',
      400,
    )
  }
  return data
}

/**
 * Writes the audit row. Passing `req` through joins the hook's transaction, so
 * the status change and its log entry commit together or not at all.
 */
export const logInvoiceTransition: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (operation !== 'update') return doc
  if (previousDoc?.status === doc.status) return doc

  await req.payload.create({
    collection: 'activity-log',
    req,
    data: {
      owner: typeof doc.owner === 'object' ? doc.owner.id : doc.owner,
      summary: `Invoice #${doc.invoiceNumber ?? 'draft'}: ${previousDoc?.status} → ${doc.status}`,
      entityType: 'invoice',
      entityId: String(doc.id),
      entityNumber: doc.invoiceNumber ?? undefined,
      fromStatus: previousDoc?.status ?? 'unknown',
      toStatus: doc.status,
      isAdminOverride: Boolean(doc._adminOverride),
      reason: doc._overrideReason ?? undefined,
      actor: req.user?.id,
      occurredAt: formatISO(new Date()),
    },
  })

  return doc
}
