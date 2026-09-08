import { sql } from 'drizzle-orm'
import type { DrizzleAdapter } from '@payloadcms/drizzle/types'
import type { Payload } from 'payload'

import type { CurrencyCode } from '@/lib/money/currencies'

/**
 * The decision queries behind /today.
 *
 * Like @/lib/archive/queries these go straight to Drizzle, because Payload has
 * no aggregation API and most figures here are a SUM, a COUNT or a date
 * comparison. That makes owner scoping this module's own responsibility: every
 * statement filters on owner_id, and the id comes from the resolved session,
 * never from a request parameter.
 *
 * Everything is ordered by CONSEQUENCE, not by date — see RANK below.
 */

type Row = Record<string, unknown>

async function run(payload: Payload, statement: ReturnType<typeof sql>): Promise<Row[]> {
  const adapter = payload.db as unknown as DrizzleAdapter
  const result = (await adapter.execute({ db: adapter.drizzle, sql: statement })) as {
    rows?: Row[]
  }
  return result?.rows ?? []
}

/** Postgres `numeric` arrives as a string; every money column needs this. */
const cents = (value: unknown): number => {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const int = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const iso = (value: unknown): string | null => {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

/**
 * What kind of obligation a row is. The order of this union is the order of the
 * worklist, and it is an argument about money rather than about time:
 *
 *  1. `delivery_failed` — the invoice was issued but the client never received
 *     it. A silent failure: the operator believes they are owed money and the
 *     client has never seen a request. Nothing else can be true until it is.
 *  2. `renewal_due`  — a recurring period that has not been billed. Miss the
 *     month and that revenue is not late, it is GONE. This is the one the
 *     product exists for, so it outranks money that is merely overdue.
 *  3. `overdue`      — late, but recoverable, and it escalates on its own.
 *  4. `reminder`     — a chase email already composed, waiting on one click.
 *  5. `draft`        — revenue that has not even been asked for yet.
 *
 * Anything sent and not yet due is deliberately absent: there is no decision to
 * make about it, and that is the archive's job, not this page's.
 */
export type ObligationKind = 'delivery_failed' | 'renewal_due' | 'overdue' | 'reminder' | 'draft'

const RANK: Record<ObligationKind, number> = {
  delivery_failed: 0,
  renewal_due: 1,
  overdue: 2,
  reminder: 3,
  draft: 4,
}

export type Obligation = {
  kind: ObligationKind
  /** Stable per row, for React keys and for the action to address. */
  id: string
  /** The invoice this concerns, when there is one. */
  invoiceId: number | null
  /** The outbox row this concerns, for reminders only. */
  reminderId: number | null
  /** The service this concerns, for renewals only. */
  serviceId: number | null
  clientName: string
  clientEmail: string | null
  /** The document reference — "6", or "Draft" before a number is minted. */
  reference: string | null
  /** What the obligation is, in the product's own words. */
  consequence: string
  currency: CurrencyCode
  /** The money at stake. Never summed across currencies by any caller. */
  cents: number
  /** Days late, or days until due. Negative means still in the future. */
  daysLate: number | null
  /** Ordering within a kind: bigger is more urgent. */
  weight: number
  /** Set only when the invoice has no address to send to. */
  blockedReason: string | null
}

const byConsequence = (a: Obligation, b: Obligation): number =>
  RANK[a.kind] - RANK[b.kind] || b.weight - a.weight

/**
 * Invoices that were issued but whose email never arrived.
 *
 * `composed` counts as a failure here even though nothing errored: it means the
 * message was written but no transport was configured, so the client has still
 * never seen it. Treating that as success is the exact lie this product spent a
 * whole debugging session removing.
 */
async function deliveryFailures(payload: Payload, ownerId: number): Promise<Obligation[]> {
  const rows = await run(
    payload,
    sql`
      select
        i.id                as invoice_id,
        i.display_number    as reference,
        i.currency          as currency,
        i.balance_cents     as balance_cents,
        i.delivery_state    as delivery_state,
        i.delivery_note     as delivery_note,
        c.name              as client_name,
        c.email             as client_email
      from invoices i
      join clients c on c.id = i.client_id
      where i.owner_id = ${ownerId}
        and i.status in ('sent', 'overdue')
        and i.delivery_state in ('failed', 'composed')
      order by i.issued_date asc
      limit 100
    `,
  )

  return rows.map((r) => {
    const state = String(r.delivery_state)
    return {
      kind: 'delivery_failed' as const,
      id: `delivery-${r.invoice_id}`,
      invoiceId: int(r.invoice_id),
      reminderId: null,
      serviceId: null,
      clientName: String(r.client_name),
      clientEmail: (r.client_email as string) ?? null,
      reference: r.reference ? String(r.reference) : null,
      consequence:
        state === 'composed'
          ? 'was never actually emailed — the message was written but no mail was sent'
          : `could not be delivered${r.delivery_note ? `: ${String(r.delivery_note)}` : ''}`,
      currency: (r.currency as CurrencyCode) ?? 'AUD',
      cents: cents(r.balance_cents),
      daysLate: null,
      weight: cents(r.balance_cents),
      blockedReason: r.client_email ? null : 'This client has no email address.',
    }
  })
}

/**
 * Recurring periods that have come due and have not been billed.
 *
 * Derived the same way the billing run derives them — a service is due when
 * `next_invoice_on` has arrived — but scoped to the owner and joined against
 * `service_billings` so a period already billed never appears. The unique index
 * on (service, period_start) is what makes that join reliable.
 */
async function renewalsDue(payload: Payload, ownerId: number): Promise<Obligation[]> {
  const rows = await run(
    payload,
    sql`
      select
        s.id                        as service_id,
        s.name                      as service_name,
        s.currency                  as currency,
        s.charge_cents              as charge_cents,
        s.next_invoice_on           as next_invoice_on,
        s.auto_generate             as auto_generate,
        c.name                      as client_name,
        c.email                     as client_email,
        greatest(0, date_part('day', now() - s.next_invoice_on))::int as days_late
      from services s
      join clients c on c.id = s.client_id
      where s.owner_id = ${ownerId}
        and s.status = 'active'
        and s.next_invoice_on is not null
        and s.next_invoice_on <= now()
        and not exists (
          select 1 from service_billings sb
          where sb.service_id = s.id
            and sb.period_start = s.next_invoice_on
        )
      order by s.next_invoice_on asc
      limit 100
    `,
  )

  return rows.map((r) => ({
    kind: 'renewal_due' as const,
    id: `renewal-${r.service_id}`,
    invoiceId: null,
    reminderId: null,
    serviceId: int(r.service_id),
    clientName: String(r.client_name),
    clientEmail: (r.client_email as string) ?? null,
    reference: String(r.service_name),
    consequence: r.auto_generate
      ? 'is due to be billed and the run has not raised it yet'
      : 'is due to be billed, and it is set to be raised by hand',
    currency: (r.currency as CurrencyCode) ?? 'AUD',
    cents: cents(r.charge_cents),
    daysLate: int(r.days_late),
    // A month unbilled is worse than a large charge one day late.
    weight: int(r.days_late) * 1_000_000 + cents(r.charge_cents),
    blockedReason: null,
  }))
}

/** Issued, past due, still owing. Ordered by how much money is how late. */
async function overdue(payload: Payload, ownerId: number): Promise<Obligation[]> {
  const rows = await run(
    payload,
    sql`
      select
        i.id             as invoice_id,
        i.display_number as reference,
        i.currency       as currency,
        i.balance_cents  as balance_cents,
        i.amount_paid_cents as paid_cents,
        c.name           as client_name,
        c.email          as client_email,
        date_part('day', now() - i.due_date)::int as days_late
      from invoices i
      join clients c on c.id = i.client_id
      where i.owner_id = ${ownerId}
        and i.status in ('sent', 'overdue')
        and i.due_date is not null
        and i.due_date < now()
        and coalesce(i.balance_cents, 0) > 0
        -- A failed delivery is reported as its own, higher obligation; listing it
        -- twice would make the worklist argue with itself about what to do first.
        and coalesce(i.delivery_state, 'not_sent') not in ('failed', 'composed')
      order by days_late desc
      limit 100
    `,
  )

  return rows.map((r) => ({
    kind: 'overdue' as const,
    id: `overdue-${r.invoice_id}`,
    invoiceId: int(r.invoice_id),
    reminderId: null,
    serviceId: null,
    clientName: String(r.client_name),
    clientEmail: (r.client_email as string) ?? null,
    reference: r.reference ? String(r.reference) : null,
    consequence:
      cents(r.paid_cents) > 0
        ? `is part paid and ${int(r.days_late)} days overdue on the rest`
        : `is ${int(r.days_late)} days overdue`,
    currency: (r.currency as CurrencyCode) ?? 'AUD',
    cents: cents(r.balance_cents),
    daysLate: int(r.days_late),
    weight: int(r.days_late) * 1_000_000 + cents(r.balance_cents),
    blockedReason: null,
  }))
}

/**
 * The prepared outbox: chase emails the sweep has already composed.
 *
 * This is the shape the operator asked for — the app writes the email, a button
 * sends it — so these are obligations with a one-click resolution rather than
 * notifications about work still to do.
 */
async function preparedReminders(payload: Payload, ownerId: number): Promise<Obligation[]> {
  const rows = await run(
    payload,
    sql`
      select
        r.id                 as reminder_id,
        r.invoice_id         as invoice_id,
        r.kind               as kind,
        r.to_address         as to_address,
        r.balance_at_prepared as balance_cents,
        r.prepared_at        as prepared_at,
        i.display_number     as reference,
        i.currency           as currency,
        c.name               as client_name,
        date_part('day', now() - r.prepared_at)::int as waiting_days
      from invoice_reminders r
      join invoices i on i.id = r.invoice_id
      join clients c on c.id = i.client_id
      where r.owner_id = ${ownerId}
        and r.state = 'prepared'
      order by r.prepared_at asc
      limit 100
    `,
  )

  return rows.map((r) => {
    const kind = String(r.kind)
    return {
      kind: 'reminder' as const,
      id: `reminder-${r.reminder_id}`,
      invoiceId: int(r.invoice_id),
      reminderId: int(r.reminder_id),
      serviceId: null,
      clientName: String(r.client_name),
      clientEmail: (r.to_address as string) ?? null,
      reference: r.reference ? String(r.reference) : null,
      consequence:
        kind === 'receipt'
          ? 'has a receipt written and waiting to go out'
          : 'has a chase email written and waiting to go out',
      currency: (r.currency as CurrencyCode) ?? 'AUD',
      cents: cents(r.balance_cents),
      daysLate: int(r.waiting_days),
      weight: int(r.waiting_days) * 1_000_000 + cents(r.balance_cents),
      blockedReason: r.to_address ? null : 'No address was resolved for this reminder.',
    }
  })
}

/**
 * Drafts that have been sitting unsent.
 *
 * Anything raised today is excluded: a draft you are still writing is not a
 * problem, and a worklist that scolds you for work in progress gets ignored.
 */
async function staleDrafts(payload: Payload, ownerId: number, afterDays: number): Promise<Obligation[]> {
  const rows = await run(
    payload,
    sql`
      select
        i.id            as invoice_id,
        i.total_cents   as total_cents,
        i.currency      as currency,
        i.title         as title,
        c.name          as client_name,
        c.email         as client_email,
        date_part('day', now() - i.created_at)::int as age_days
      from invoices i
      join clients c on c.id = i.client_id
      where i.owner_id = ${ownerId}
        and i.status = 'draft'
        and i.created_at < now() - (${afterDays} || ' days')::interval
      order by i.created_at asc
      limit 100
    `,
  )

  return rows.map((r) => ({
    kind: 'draft' as const,
    id: `draft-${r.invoice_id}`,
    invoiceId: int(r.invoice_id),
    reminderId: null,
    serviceId: null,
    clientName: String(r.client_name),
    clientEmail: (r.client_email as string) ?? null,
    reference: r.title ? String(r.title) : null,
    // The stamped mark carries the day count, as it does on every other row, so
    // the sentence only has to say what is wrong.
    consequence: 'has never been sent',
    currency: (r.currency as CurrencyCode) ?? 'AUD',
    cents: cents(r.total_cents),
    daysLate: int(r.age_days),
    weight: int(r.age_days) * 1_000_000 + cents(r.total_cents),
    blockedReason: r.client_email ? null : 'This client has no email address.',
  }))
}

/**
 * Everything that needs a decision, most consequential first.
 *
 * `staleDraftAfterDays` is deliberately a parameter rather than a constant: it
 * is a judgement about this operator's rhythm, not a fact.
 */
export async function getWorklist(args: {
  payload: Payload
  ownerId: number
  staleDraftAfterDays?: number
}): Promise<Obligation[]> {
  const { payload, ownerId, staleDraftAfterDays = 3 } = args

  const [failures, renewals, late, reminders, drafts] = await Promise.all([
    deliveryFailures(payload, ownerId),
    renewalsDue(payload, ownerId),
    overdue(payload, ownerId),
    preparedReminders(payload, ownerId),
    staleDrafts(payload, ownerId, staleDraftAfterDays),
  ])

  return [...failures, ...renewals, ...late, ...reminders, ...drafts].sort(byConsequence)
}

export type StandingRow = { currency: CurrencyCode; cents: number }

/**
 * What the worklist adds up to, per currency.
 *
 * Grouped rather than totalled because an AUD and an NZD balance have no common
 * total without a recorded rate, and no rate is recorded anywhere in this app.
 */
export function totalAtStake(obligations: Obligation[]): StandingRow[] {
  const byCurrency = new Map<CurrencyCode, number>()
  for (const item of obligations) {
    // A draft's total is not money at stake in the same sense — nobody has been
    // asked for it yet — but it is the clearest number to show, so it counts.
    byCurrency.set(item.currency, (byCurrency.get(item.currency) ?? 0) + item.cents)
  }
  return [...byCurrency.entries()]
    .filter(([, value]) => value > 0)
    .map(([currency, value]) => ({ currency, cents: value }))
    .sort((a, b) => b.cents - a.cents)
}

export type NotificationRow = {
  id: number
  kind: string
  title: string
  body: string | null
  actionUrl: string | null
  createdAt: string | null
  readAt: string | null
}

/**
 * The bell's contents. Read rows are included so the panel has history rather
 * than emptying itself the moment it is opened.
 */
export async function getNotifications(args: {
  payload: Payload
  ownerId: number
  limit?: number
}): Promise<{ rows: NotificationRow[]; unread: number }> {
  const { payload, ownerId, limit = 12 } = args

  const rows = await run(
    payload,
    sql`
      select id, kind, title, body, action_url, created_at, read_at
      from notifications
      where owner_id = ${ownerId}
      order by read_at is not null asc, created_at desc
      limit ${limit}
    `,
  )

  const counted = await run(
    payload,
    sql`
      select count(*)::int as unread
      from notifications
      where owner_id = ${ownerId} and read_at is null
    `,
  )

  return {
    rows: rows.map((r) => ({
      id: int(r.id),
      kind: String(r.kind),
      title: String(r.title),
      body: (r.body as string) ?? null,
      actionUrl: (r.action_url as string) ?? null,
      createdAt: iso(r.created_at),
      readAt: iso(r.read_at),
    })),
    unread: int(counted[0]?.unread),
  }
}
