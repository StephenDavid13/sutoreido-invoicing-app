import { formatISO } from 'date-fns'
import { APIError } from 'payload'
import type { PayloadRequest } from 'payload'

import type { Invoice } from '@/payload-types'

import { prepareReceipt } from './receipt'

/**
 * Rolls the payments for one invoice back onto the invoice.
 *
 * Payments are the only thing that may write `amountPaidCents`. The invoice's own
 * beforeChange derives `balanceCents` from it, so this sets one field and lets the
 * existing arithmetic stay the single authority.
 *
 * Status follows the money, through the state machine rather than around it: a
 * fully-covered invoice transitions to paid and an audit row is written, exactly
 * as if the transition had been made by hand.
 */
export async function recomputeInvoicePayments(args: {
  req: PayloadRequest
  invoiceId: number
}): Promise<void> {
  const { req, invoiceId } = args

  const payments = await req.payload.find({
    collection: 'payments',
    where: { invoice: { equals: invoiceId } },
    limit: 1000,
    depth: 0,
    req,
  })

  const paidCents = payments.docs.reduce((sum, p) => sum + (p.amountCents ?? 0), 0)

  const invoice = (await req.payload.findByID({
    collection: 'invoices',
    id: invoiceId,
    depth: 0,
    req,
    disableErrors: true,
  })) as Invoice | null
  if (!invoice) return

  const total = invoice.totalCents ?? 0
  const covered = paidCents >= total && total > 0
  const status = invoice.status

  /*
   * Paid is a terminal state, so a reversal that would un-pay an invoice is
   * refused rather than silently reopened. Reversing a settled invoice is a real
   * event, but it needs an explicit admin override so the audit trail records a
   * reason instead of a mystery.
   */
  if (status === 'paid' && !covered) {
    throw new APIError(
      'This invoice is already settled. Removing the payment would reopen it, which needs an admin status override with a reason.',
      409,
    )
  }

  const data: Record<string, unknown> = { amountPaidCents: paidCents }

  // Only sent and overdue can become paid; draft and cancelled are left alone.
  if (covered && (status === 'sent' || status === 'overdue')) {
    data.status = 'paid'
    data.paidAt = formatISO(latestPaymentDate(payments.docs))
  }

  await req.payload.update({ collection: 'invoices', id: invoiceId, data, req })

  /*
   * Settling an invoice clears its outbox immediately.
   *
   * The send path re-checks the balance and would refuse each one individually, but
   * leaving them queued means a settled invoice still shows reminders waiting and
   * unread notifications telling you to chase it. Dismiss them at the moment the
   * money lands instead of lazily, one refusal at a time.
   */
  if (covered) {
    const outstanding = await req.payload.find({
      collection: 'invoice-reminders',
      where: { and: [{ invoice: { equals: invoiceId } }, { state: { equals: 'prepared' } }] },
      limit: 200,
      depth: 0,
      req,
    })
    for (const reminder of outstanding.docs) {
      await req.payload.update({
        collection: 'invoice-reminders',
        id: reminder.id,
        data: {
          state: 'dismissed',
          note: 'Dismissed automatically: the invoice was paid before this was sent.',
        },
        req,
      })
    }
    // The nudges that pointed at them are stale too.
    await req.payload.delete({
      collection: 'notifications',
      where: {
        and: [
          { kind: { in: ['reminder_prepared', 'invoice_overdue'] } },
          { dedupeKey: { like: `:${invoiceId}` } },
        ],
      },
      req,
    }).catch(() => {})

    // Then prepare the receipt, after the dismissal pass so it is not swept up.
    await prepareReceipt({ req, invoiceId, paidCents })
  }
}

function latestPaymentDate(docs: { receivedOn?: string | null }[]): Date {
  const times = docs
    .map((d) => (d.receivedOn ? new Date(d.receivedOn).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
  return times.length ? new Date(Math.max(...times)) : new Date()
}
