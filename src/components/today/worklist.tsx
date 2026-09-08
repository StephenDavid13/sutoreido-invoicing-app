import Link from 'next/link'
import React from 'react'

import {
  billRenewalAction,
  dismissReminderAction,
  sendInvoiceAction,
  sendReminderAction,
} from '@/app/(app)/today/actions'
import { ActionButton } from '@/components/today/action-button'
import { RecordPayment } from '@/components/today/record-payment'
import type { Obligation, ObligationKind } from '@/lib/today/queries'
import { formatMoneyExplicit } from '@/lib/money/money'

/**
 * The worklist: one strictly ordered column, ranked by consequence.
 *
 * No sections and no tabs, deliberately. The whole argument of this surface is
 * that the top row is the next thing to do — grouping by kind would put that
 * decision back on the operator, which is the job the page exists to take away.
 *
 * Ordering is set in @/lib/today/queries (see ObligationKind). Money that will
 * be lost outranks money that is late.
 */

/**
 * Which obligations get the urgency ink.
 *
 * The world's rule is that `--stamp` marks a state needing acting on, and only
 * that. Money vanishing (an unbilled period, an invoice the client never
 * received) or money already late earns it. A composed email waiting on a click
 * and a draft nobody has sent do not: they are work in hand, not damage.
 */
const URGENT: Record<ObligationKind, boolean> = {
  delivery_failed: true,
  renewal_due: true,
  overdue: true,
  reminder: false,
  draft: false,
}

/** The stamped word. Names the damage, not the database state. */
function markWord(item: Obligation): string {
  switch (item.kind) {
    case 'delivery_failed':
      return 'Never arrived'
    case 'renewal_due':
      return item.daysLate && item.daysLate > 0 ? `Unbilled ${item.daysLate}d` : 'Unbilled'
    case 'overdue':
      return `Overdue ${item.daysLate ?? 0}d`
    case 'reminder':
      return 'To send'
    case 'draft':
      return item.daysLate && item.daysLate > 0 ? `Unsent ${item.daysLate}d` : 'Unsent'
  }
}

function ObligationMark({ item }: { item: Obligation }) {
  return (
    <span
      className={`mark-stamp text-[10px] font-semibold uppercase ${
        URGENT[item.kind] ? 'text-stamp' : 'text-ink-2'
      }`}
    >
      {markWord(item)}
    </span>
  )
}

/**
 * Service names and invoice titles routinely embed the client's name — "Hosting
 * — Shooters World Gore" — and the row already opens with that name in bold. Left
 * alone the sentence stutters: "Shooters World Gore — Hosting — Shooters World
 * Gore is due to be billed". This drops the duplicate, either side of a dash.
 */
function withoutClientName(reference: string, clientName: string): string {
  const name = clientName.trim()
  if (!name) return reference
  const trimmed = reference
    .replace(new RegExp(`\\s*[—–-]\\s*${escapeForRegExp(name)}\\b`, 'i'), '')
    .replace(new RegExp(`^${escapeForRegExp(name)}\\s*[—–-]\\s*`, 'i'), '')
    .trim()
  // Never return nothing: a title that was only the client name still has to say
  // something, so fall back to the original rather than an empty subject.
  return trimmed || reference
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** What this row says, as one sentence in the product's own language. */
function Consequence({ item }: { item: Obligation }) {
  const subject = (() => {
    if (item.kind === 'renewal_due') {
      return item.reference ? withoutClientName(item.reference, item.clientName) : 'A service'
    }
    if (item.kind === 'draft') {
      return item.reference
        ? `the draft “${withoutClientName(item.reference, item.clientName)}”`
        : 'an untitled draft'
    }
    return item.reference ? `Invoice ${item.reference}` : 'A draft'
  })()

  return (
    <>
      <span className="text-ink font-semibold">{item.clientName}</span>
      <span className="text-ink-2">
        {' — '}
        {subject} {item.consequence}.
      </span>
    </>
  )
}

/**
 * The actions for one row.
 *
 * At most one is primary, because a ranked list whose rows each offer two equally
 * weighted choices has not actually decided anything.
 */
function Actions({ item }: { item: Obligation }) {
  switch (item.kind) {
    case 'delivery_failed':
      return (
        <ActionButton
          action={sendInvoiceAction.bind(null, item.invoiceId as number)}
          label="Send it again"
          pendingLabel="Sending…"
          primary
          disabledReason={item.blockedReason}
        />
      )

    case 'renewal_due':
      return (
        <ActionButton
          action={billRenewalAction.bind(null, item.serviceId as number)}
          label="Raise the invoice"
          pendingLabel="Raising…"
          primary
        />
      )

    case 'overdue':
      return (
        <RecordPayment
          invoiceId={item.invoiceId as number}
          currency={item.currency}
          balanceCents={item.cents}
        />
      )

    case 'reminder':
      return (
        <>
          <ActionButton
            action={sendReminderAction.bind(null, item.reminderId as number)}
            label="Send the chase"
            pendingLabel="Sending…"
            primary
            disabledReason={item.blockedReason}
          />
          <ActionButton
            action={dismissReminderAction.bind(null, item.reminderId as number)}
            label="Dismiss"
            pendingLabel="Dismissing…"
            confirm="It will not be composed again for this offset."
          />
        </>
      )

    case 'draft':
      return (
        <ActionButton
          action={sendInvoiceAction.bind(null, item.invoiceId as number)}
          label="Send it"
          pendingLabel="Sending…"
          primary
          disabledReason={item.blockedReason}
        />
      )
  }
}

/** Where the underlying record lives, for when the row is not the whole story. */
function recordHref(item: Obligation): string | null {
  if (item.kind === 'renewal_due' && item.serviceId) {
    return `/admin/collections/services/${item.serviceId}`
  }
  if (item.invoiceId) return `/admin/collections/invoices/${item.invoiceId}`
  return null
}

export function Worklist({ items }: { items: Obligation[] }) {
  return (
    <ol className="border-rule border-t">
      {items.map((item, index) => {
        const href = recordHref(item)
        return (
          <li
            key={item.id}
            className="border-rule hover:bg-bench-course border-b px-5 py-6 transition-colors md:px-8 md:py-7"
          >
            {/*
              The one authored motion, staggered only across the first few rows.
              Every row animating turns a settling course into a cascade, and a
              long list would still be moving when the operator starts reading.
            */}
            <div className={index < 6 ? 'course-step' : undefined}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <ObligationMark item={item} />
                <p className="min-w-0 max-w-[68ch] flex-1 text-[15px] leading-relaxed">
                  <Consequence item={item} />
                </p>
                {item.cents > 0 ? (
                  <span className="text-ink figure shrink-0 text-[15px] font-semibold tabular-nums">
                    {formatMoneyExplicit(item.cents, item.currency)}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <Actions item={item} />
                {href ? (
                  <Link
                    href={href}
                    className="text-ink-3 hover:text-ink shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors"
                  >
                    Open the record
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
