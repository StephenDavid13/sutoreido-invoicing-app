'use server'

import { revalidatePath } from 'next/cache'

import { findByIdScoped, requireSession } from '@/lib/auth/dal'
import { sendInvoice } from '@/lib/invoices/send'
import { roundHalfAwayFromZero } from '@/lib/money/money'
import { sendPreparedReminder } from '@/lib/reminders/send'
import { runServiceBilling } from '@/lib/services/billing-run'

/**
 * The worklist's mutations.
 *
 * Server Actions rather than route handlers: every one of these is submitted
 * from this app's own UI and needs the page to reflect the result immediately,
 * which `revalidatePath` gives for free. The existing /api routes stay — the
 * Payload admin's buttons call them, and they are the shape a webhook would
 * want later.
 *
 * ------------------------------------------------------------------------
 * OWNERSHIP. Every action re-reads its target through the DAL first, because
 * the libraries below take a bare `payload` and run with access control OFF —
 * `overrideAccess` defaults to true in Payload's Local API. An id arriving from
 * a form is attacker-controlled, so the scoped read is the only thing standing
 * between it and another owner's invoice. A foreign id reads as "not found",
 * never "forbidden", so this leaks nothing about what exists.
 * ------------------------------------------------------------------------
 */

export type ActionResult = { ok: boolean; message: string }

/** Both surfaces show the same rows, so both are stale after any mutation. */
function refresh(): void {
  revalidatePath('/today')
  revalidatePath('/')
}

function failure(error: unknown, fallback: string): ActionResult {
  return { ok: false, message: error instanceof Error ? error.message : fallback }
}

/** Issues a draft, archives its PDF, and emails it. Also re-sends an issued one. */
export async function sendInvoiceAction(invoiceId: number): Promise<ActionResult> {
  const { payload } = await requireSession()

  const invoice = await findByIdScoped<{ id: number; status: string }>({
    collection: 'invoices',
    id: invoiceId,
    depth: 0,
  })
  if (!invoice) return { ok: false, message: 'That invoice no longer exists.' }

  try {
    const result = await sendInvoice({
      payload,
      invoiceId,
      resend: invoice.status !== 'draft',
    })
    refresh()
    return {
      ok: result.delivered,
      // `note` is the honest account of what happened — including "written but
      // not sent" when no transport is configured. Never overwrite it with a
      // generic success: a tick that means "logged to the console" is a lie.
      message: result.note ?? (result.delivered ? `Sent to ${result.to}.` : 'Not delivered.'),
    }
  } catch (error) {
    return failure(error, 'Send failed.')
  }
}

/** Sends one already-composed outbox item. */
export async function sendReminderAction(reminderId: number): Promise<ActionResult> {
  const { payload } = await requireSession()

  const reminder = await findByIdScoped<{ id: number }>({
    collection: 'invoice-reminders',
    id: reminderId,
    depth: 0,
  })
  if (!reminder) return { ok: false, message: 'That reminder no longer exists.' }

  try {
    const result = (await sendPreparedReminder({ payload, reminderId })) as {
      delivered?: boolean
      note?: string
    }
    refresh()
    return {
      ok: Boolean(result?.delivered),
      message: result?.note ?? (result?.delivered ? 'Sent.' : 'Not delivered.'),
    }
  } catch (error) {
    return failure(error, 'Send failed.')
  }
}

/**
 * Drops an outbox item without sending it.
 *
 * Needed because the sweep composes on a schedule but the operator decides: a
 * client who has already promised to pay should not be chased, and without this
 * the only way to clear the row would be to send the email anyway.
 */
export async function dismissReminderAction(reminderId: number): Promise<ActionResult> {
  const { payload, user } = await requireSession()

  const reminder = await findByIdScoped<{ id: number; state: string }>({
    collection: 'invoice-reminders',
    id: reminderId,
    depth: 0,
  })
  if (!reminder) return { ok: false, message: 'That reminder no longer exists.' }
  if (reminder.state !== 'prepared') {
    return { ok: false, message: 'That reminder has already been dealt with.' }
  }

  try {
    await payload.update({
      collection: 'invoice-reminders',
      id: reminderId,
      data: { state: 'dismissed', note: 'Dismissed by hand from the worklist.' },
      overrideAccess: false,
      user,
    })
    refresh()
    return { ok: true, message: 'Dismissed. It will not be composed again for this offset.' }
  } catch (error) {
    return failure(error, 'Could not dismiss it.')
  }
}

/**
 * Raises the invoice for one due service period.
 *
 * `includeManual` is on because reaching this button IS the manual decision —
 * `autoGenerate: false` means "the cron leaves this alone", not "never bill it".
 * The result is a DRAFT, as the scheduled run produces, so nothing reaches a
 * client until it is sent deliberately.
 */
export async function billRenewalAction(serviceId: number): Promise<ActionResult> {
  const { payload } = await requireSession()

  const service = await findByIdScoped<{ id: number; name: string }>({
    collection: 'services',
    id: serviceId,
    depth: 0,
  })
  if (!service) return { ok: false, message: 'That service no longer exists.' }

  try {
    const result = await runServiceBilling({
      payload,
      serviceIds: [serviceId],
      includeManual: true,
    })
    refresh()

    if (result.invoicesCreated.length === 0) {
      const skipped = result.servicesSkipped[0]
      return {
        ok: false,
        message: skipped ? `Nothing raised: ${skipped.reason}.` : 'Nothing was due to be raised.',
      }
    }
    const periods = result.periodsBilled
    return {
      ok: true,
      message: `Draft raised for ${periods} ${periods === 1 ? 'period' : 'periods'}. Review it, then send.`,
    }
  } catch (error) {
    return failure(error, 'Could not raise the invoice.')
  }
}

/**
 * Records a payment against an invoice.
 *
 * The collection's own hooks do the real work: they sum the payments, write
 * `amountPaidCents`, move the invoice to paid once covered, clear any pending
 * outbox item, and prepare the receipt. So this only has to validate and create.
 */
export async function recordPaymentAction(input: {
  invoiceId: number
  /** As typed, in dollars. The form talks money; storage is integer cents. */
  amount: string
  receivedOn: string
  method: string
  reference?: string
}): Promise<ActionResult> {
  const { payload, user } = await requireSession()

  const invoice = await findByIdScoped<{
    id: number
    currency: string
    balanceCents?: number | null
  }>({ collection: 'invoices', id: input.invoiceId, depth: 0 })
  if (!invoice) return { ok: false, message: 'That invoice no longer exists.' }

  const dollars = Number.parseFloat(input.amount.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return { ok: false, message: 'Enter an amount greater than zero.' }
  }
  const amountCents = roundHalfAwayFromZero(dollars * 100)

  // Date-only input, pinned to UTC midnight. Parsing "2026-09-08" as local time
  // lands the previous day for anyone east of Greenwich, which is where this
  // operator is — the same class of off-by-one the PDF renderer avoids.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn)) {
    return { ok: false, message: 'Pick the date the money arrived.' }
  }
  const receivedOn = `${input.receivedOn}T00:00:00.000Z`

  try {
    await payload.create({
      collection: 'payments',
      data: {
        owner: Number(user.id),
        invoice: input.invoiceId,
        amountCents,
        currency: invoice.currency as 'AUD' | 'NZD' | 'USD' | 'PHP',
        receivedOn,
        method: input.method as 'bank_transfer' | 'card' | 'cash' | 'other',
        reference: input.reference?.trim() || undefined,
      },
      overrideAccess: false,
      user,
    })
    refresh()

    const covered = amountCents >= (invoice.balanceCents ?? 0)
    return {
      ok: true,
      message: covered
        ? 'Recorded. The invoice is settled and a receipt is waiting in the outbox.'
        : 'Recorded as a part payment. The invoice keeps a balance.',
    }
  } catch (error) {
    return failure(error, 'Could not record the payment.')
  }
}

/** Clears the bell. Read rows stay in the panel as history. */
export async function markNotificationsReadAction(): Promise<ActionResult> {
  const { payload, user } = await requireSession()

  try {
    const now = new Date().toISOString()
    const unread = await payload.find({
      collection: 'notifications',
      where: { readAt: { exists: false } },
      limit: 200,
      depth: 0,
      overrideAccess: false,
      user,
    })

    await Promise.all(
      unread.docs.map((doc) =>
        payload.update({
          collection: 'notifications',
          id: doc.id,
          data: { readAt: now },
          overrideAccess: false,
          user,
        }),
      ),
    )
    refresh()
    return { ok: true, message: `Marked ${unread.docs.length} read.` }
  } catch (error) {
    return failure(error, 'Could not mark them read.')
  }
}
