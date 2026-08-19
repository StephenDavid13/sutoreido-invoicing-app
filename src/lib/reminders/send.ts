import { formatISO } from 'date-fns'
import { APIError } from 'payload'
import type { Payload } from 'payload'

import { deliver } from '@/lib/email/deliver'
import type { Invoice, InvoiceReminder } from '@/payload-types'

const idOf = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : v && typeof v === 'object' && 'id' in v ? Number((v as { id: unknown }).id) : undefined

/**
 * Sends a reminder that was already composed.
 *
 * The balance is re-checked here, not trusted from preparation time: a reminder
 * prepared last night must not chase an invoice that was paid this morning. That is
 * the one thing a prepared-outbox model has to get right.
 */
export async function sendPreparedReminder(args: {
  payload: Payload
  reminderId: number
}): Promise<{ delivered: boolean; note: string; to: string }> {
  const { payload, reminderId } = args

  const reminder = (await payload.findByID({
    collection: 'invoice-reminders',
    id: reminderId,
    depth: 1,
    disableErrors: true,
  })) as InvoiceReminder | null
  if (!reminder) throw new APIError('That reminder does not exist.', 404)

  if (reminder.state === 'sent') {
    throw new APIError('This reminder has already been sent.', 409)
  }
  if (reminder.state === 'dismissed') {
    throw new APIError('This reminder was dismissed. Undismiss it first if you want to send it.', 409)
  }

  const invoiceId = idOf(reminder.invoice)
  const invoice = invoiceId
    ? ((await payload.findByID({
        collection: 'invoices',
        id: invoiceId,
        depth: 0,
        disableErrors: true,
      })) as Invoice | null)
    : null
  if (!invoice) throw new APIError('The invoice this reminder belongs to is gone.', 409)

  const isReceipt = reminder.kind === 'receipt'

  // Re-check against the invoice as it stands NOW. A receipt is exempt: it exists
  // precisely because the balance reached zero.
  if (!isReceipt && (invoice.status === 'paid' || (invoice.balanceCents ?? 0) <= 0)) {
    await payload.update({
      collection: 'invoice-reminders',
      id: reminderId,
      data: {
        state: 'dismissed',
        note: 'Dismissed automatically: the invoice was settled before this was sent.',
      },
    })
    throw new APIError(
      'That invoice has been paid since this reminder was prepared, so it was dismissed instead of sent.',
      409,
    )
  }
  if (!isReceipt && invoice.status === 'cancelled') {
    await payload.update({
      collection: 'invoice-reminders',
      id: reminderId,
      data: { state: 'dismissed', note: 'Dismissed automatically: the invoice was cancelled.' },
    })
    throw new APIError('That invoice was cancelled, so the reminder was dismissed.', 409)
  }

  const to = reminder.toAddress
  if (!to) throw new APIError('This reminder has no recipient address.', 409)

  const outcome = await deliver({
    payload,
    to,
    subject: reminder.subject ?? `Invoice #${invoice.displayNumber}`,
    html: reminder.bodyHtml ?? '',
  })

  await payload.update({
    collection: 'invoice-reminders',
    id: reminderId,
    data: {
      state: outcome.delivered ? 'sent' : 'prepared',
      sentAt: outcome.delivered ? formatISO(new Date()) : undefined,
      note: outcome.note,
    },
  })

  return { delivered: outcome.delivered, note: outcome.note, to: outcome.intendedTo }
}
