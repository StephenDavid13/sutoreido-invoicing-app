import { render } from '@react-email/render'
import { formatISO } from 'date-fns'
import type { Payload } from 'payload'
import React from 'react'

import { ReminderEmail, type ReminderEmailModel } from '@/lib/email/templates/reminder'
import { formatMoneyExplicit } from '@/lib/money/money'
import type { CurrencyCode } from '@/lib/money/currencies'
import { notify } from '@/lib/notifications/create'
import { dateDDMMYYYY } from '@/lib/pdf/format'
import { startOfDayUTC } from '@/lib/services/periods'
import type { BankAccount, BusinessSetting, Client, Invoice, ReminderRule } from '@/payload-types'

import { offsetKind, parseOffsets, resolveRule } from './rules'

export type SweepResult = {
  markedOverdue: { id: number; reference: string; daysLate: number }[]
  prepared: { id: number; invoice: string; kind: string; to: string }[]
  skipped: { invoice: string; reason: string }[]
  notified: number
}

const idOf = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : v && typeof v === 'object' && 'id' in v ? Number((v as { id: unknown }).id) : undefined

const daysBetweenUTC = (from: Date, to: Date): number =>
  Math.round((startOfDayUTC(to).getTime() - startOfDayUTC(from).getTime()) / 86_400_000)

/**
 * The daily sweep. It does two jobs and sends nothing.
 *
 *  1. Moves genuinely late invoices to `overdue`, through the state machine so each
 *     transition is audited, with per-row error isolation so one bad record cannot
 *     roll back the batch.
 *  2. PREPARES reminders: composes the email, stores it, and raises a notification
 *     that one is waiting. A person presses send.
 *
 * Idempotent by construction. Reminders are keyed (invoice, kind) with a unique
 * index and notifications are keyed by dedupeKey, so a cron that double-fires or
 * skips a day changes nothing on the second pass and self-heals on the next.
 */
export async function runReminderSweep(args: {
  payload: Payload
  asAt?: Date
}): Promise<SweepResult> {
  const { payload } = args
  const asAt = startOfDayUTC(args.asAt ?? new Date())
  const result: SweepResult = { markedOverdue: [], prepared: [], skipped: [], notified: 0 }

  const settings = (await payload.findGlobal({
    slug: 'business-settings',
    depth: 0,
  })) as BusinessSetting
  const businessName = settings?.legalName || settings?.tradingName || ''

  const open = await payload.find({
    collection: 'invoices',
    where: { status: { in: ['sent', 'overdue'] } },
    depth: 1,
    limit: 500,
  })

  const rules = (await payload.find({ collection: 'reminder-rules', limit: 200, depth: 0 }))
    .docs as ReminderRule[]

  // ---------------------------------------------------------- 1. mark overdue
  for (const invoice of open.docs as Invoice[]) {
    if (invoice.status !== 'sent' || !invoice.dueDate) continue
    const late = daysBetweenUTC(new Date(invoice.dueDate), asAt)
    if (late <= 0) continue
    try {
      await payload.update({
        collection: 'invoices',
        id: invoice.id,
        data: { status: 'overdue' },
      })
      result.markedOverdue.push({
        id: Number(invoice.id),
        reference: invoice.displayNumber ?? String(invoice.invoiceNumber ?? invoice.id),
        daysLate: late,
      })
      const ownerId = idOf(invoice.owner)
      if (ownerId) {
        if (
          await notify({
            payload,
            ownerId,
            kind: 'invoice_overdue',
            title: `Invoice #${invoice.displayNumber} went overdue`,
            body: `${(invoice.client as Client)?.name ?? 'A client'} is ${late} ${late === 1 ? 'day' : 'days'} past due.`,
            actionUrl: `/?client=${idOf(invoice.client)}`,
            dedupeKey: `overdue:${invoice.id}`,
          })
        )
          result.notified++
      }
    } catch (error) {
      // One bad row must not abort the batch.
      result.skipped.push({
        invoice: String(invoice.displayNumber ?? invoice.id),
        reason: `could not mark overdue: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  // ------------------------------------------------- 2. prepare reminders
  const refreshed = await payload.find({
    collection: 'invoices',
    where: { status: { in: ['sent', 'overdue'] } },
    depth: 1,
    limit: 500,
  })

  for (const invoice of refreshed.docs as Invoice[]) {
    const label = String(invoice.displayNumber ?? invoice.id)
    const balance = invoice.balanceCents ?? 0
    if (balance <= 0) continue
    if (!invoice.dueDate) {
      result.skipped.push({ invoice: label, reason: 'no due date to measure against' })
      continue
    }

    const client = invoice.client
    if (!client || typeof client !== 'object') {
      result.skipped.push({ invoice: label, reason: 'no client attached' })
      continue
    }
    const to = (client as Client).email
    if (!to) {
      result.skipped.push({ invoice: label, reason: `${(client as Client).name} has no email address` })
      continue
    }

    const clientId = idOf(client)!
    const rule = resolveRule(rules, clientId)
    if (!rule) {
      result.skipped.push({ invoice: label, reason: 'no enabled reminder rule applies' })
      continue
    }
    if (rule.stopWhenPartPaid && (invoice.amountPaidCents ?? 0) > 0) {
      result.skipped.push({ invoice: label, reason: 'part paid, and the rule stops there' })
      continue
    }

    const daysPastDue = daysBetweenUTC(new Date(invoice.dueDate), asAt)
    const ownerId = idOf(invoice.owner)
    if (!ownerId) continue

    // Every offset that has come due and has no reminder yet. Catching up on a
    // missed day is automatic: earlier offsets are still eligible.
    const due = parseOffsets(rule.offsetsDays).filter((offset) => daysPastDue >= offset)

    for (const offset of due) {
      const kind = offsetKind(offset)
      const currency = invoice.currency as CurrencyCode
      const bank =
        invoice.bankAccount && typeof invoice.bankAccount === 'object'
          ? (invoice.bankAccount as BankAccount)
          : null

      const model: ReminderEmailModel = {
        reference: label,
        clientName: (client as Client).name,
        businessName,
        dueLabel: dateDDMMYYYY(invoice.dueDate),
        balance: formatMoneyExplicit(balance, currency),
        documentUrl: invoice.shareToken
          ? `${process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'}/i/${invoice.shareToken}`
          : null,
        paymentLine: bank
          ? `Payment by direct transfer in ${currency} to ${bank.bsb ? `BSB ${bank.bsb}, account ${bank.accountNumber}` : `account ${bank.accountNumber}`}.`
          : null,
        offsetDays: daysPastDue,
      }

      const subject =
        offset > 0
          ? `Overdue: invoice #${label} — ${model.balance}`
          : `Invoice #${label} — ${model.balance} due ${model.dueLabel}`

      try {
        const html = await render(React.createElement(ReminderEmail, { reminder: model }))
        const created = await payload.create({
          collection: 'invoice-reminders',
          data: {
            owner: ownerId,
            invoice: Number(invoice.id),
            kind,
            offsetDays: offset,
            state: 'prepared',
            toAddress: to,
            subject,
            bodyHtml: html,
            balanceAtPrepared: balance,
            preparedAt: formatISO(asAt),
          },
        })
        result.prepared.push({ id: Number(created.id), invoice: label, kind, to })
        if (
          await notify({
            payload,
            ownerId,
            kind: 'reminder_prepared',
            title: `Reminder ready for #${label}`,
            body: `${(client as Client).name}, ${model.balance} outstanding. Composed and waiting for you to send.`,
            actionUrl: `/admin/collections/invoice-reminders/${created.id}`,
            dedupeKey: `reminder:${invoice.id}:${kind}`,
          })
        )
          result.notified++
      } catch {
        // The unique (invoice, kind) index refused it: already prepared. Not an error.
      }
    }
  }

  return result
}
