import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import type { DrizzleAdapter } from '@payloadcms/drizzle/types'

import type { CurrencyCode } from '@/lib/money/currencies'

/**
 * Archive queries.
 *
 * These bypass Payload's access control by going straight to Drizzle, because
 * Payload has no aggregation API and every figure here is a SUM or a COUNT.
 * That makes owner scoping this module's own responsibility: every statement
 * below filters on owner_id, and the id comes from the resolved session, never
 * from a request parameter.
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

const iso = (value: unknown): string | null => {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export type MatterTab = {
  clientId: number
  name: string
  currency: CurrencyCode
  /** How many invoices have been filed against this client. */
  filings: number
  invoicedCents: number
  outstandingCents: number
  lastFiled: string | null
  /** Rows matching the active query. Zero means the tab is dimmed, never hidden. */
  hits: number
}

/**
 * The tab rail: one gummed tab per client, carrying what is filed and what is owed.
 *
 * Clients with no invoices are included deliberately. An empty file is a real
 * state in an archive, and hiding it would make the rail lie about the roster.
 */
export async function getMatterIndex(args: {
  payload: Payload
  ownerId: number
  query?: string
}): Promise<MatterTab[]> {
  const { payload, ownerId, query } = args
  const q = query?.trim() ? `%${query.trim()}%` : null

  const rows = await run(
    payload,
    sql`
      select
        c.id                            as client_id,
        c.name                          as name,
        c.default_currency              as currency,
        count(i.id)                     as filings,
        coalesce(sum(i.total_cents), 0)  as invoiced_cents,
        coalesce(sum(
          case when i.status in ('sent', 'overdue') then i.balance_cents else 0 end
        ), 0)                            as outstanding_cents,
        max(i.issued_date)               as last_filed,
        coalesce(sum(
          case when ${q}::text is null then 0
               when c.name ilike ${q}
                 or coalesce(i.title, '') ilike ${q}
                 or exists (
                      select 1 from invoices_line_items li
                      where li._parent_id = i.id and li.description ilike ${q}
                    )
               then 1 else 0 end
        ), 0)                            as hits
      from clients c
      left join invoices i
        on i.client_id = c.id
       and i.owner_id = ${ownerId}
      where c.owner_id = ${ownerId}
      group by c.id, c.name, c.default_currency
      order by c.name asc
    `,
  )

  return rows.map((r) => ({
    clientId: Number(r.client_id),
    name: String(r.name),
    currency: (r.currency as CurrencyCode) ?? 'AUD',
    filings: Number(r.filings ?? 0),
    invoicedCents: cents(r.invoiced_cents),
    outstandingCents: cents(r.outstanding_cents),
    lastFiled: iso(r.last_filed),
    hits: Number(r.hits ?? 0),
  }))
}

export type DocketEntry = {
  id: number
  reference: string
  invoiceNumber: number | null
  status: string
  title: string | null
  /** The line-item descriptions joined: what the work actually was. */
  work: string | null
  clientId: number
  clientName: string
  issuedDate: string | null
  dueDate: string | null
  dueMode: string | null
  currency: CurrencyCode
  totalCents: number
  balanceCents: number
  shareToken: string | null
  daysOverdue: number
}

/**
 * The docket: every filing, newest first, optionally scoped to one matter.
 *
 * `work` is the joined line-item descriptions rather than a document title,
 * because the stated lookup behaviour is remembering what the work was.
 */
export async function getDocket(args: {
  payload: Payload
  ownerId: number
  clientId?: number | null
  query?: string
  limit?: number
}): Promise<DocketEntry[]> {
  const { payload, ownerId, clientId, query, limit = 300 } = args
  const q = query?.trim() ? `%${query.trim()}%` : null

  const rows = await run(
    payload,
    sql`
      select
        i.id, i.display_number, i.invoice_number, i.status, i.title,
        i.issued_date, i.due_date, i.due_mode, i.currency,
        i.total_cents, i.balance_cents, i.share_token,
        c.id as client_id, c.name as client_name,
        (
          select string_agg(li.description, ' · ' order by li._order)
          from invoices_line_items li
          where li._parent_id = i.id
        ) as work,
        case
          when i.due_date is null then 0
          when i.status not in ('sent', 'overdue') then 0
          else greatest(0, (current_date - i.due_date::date))
        end as days_overdue
      from invoices i
      join clients c on c.id = i.client_id
      where i.owner_id = ${ownerId}
        and (${clientId ?? null}::int is null or i.client_id = ${clientId ?? null}::int)
        and (
          ${q}::text is null
          or c.name ilike ${q}
          or coalesce(i.title, '') ilike ${q}
          or coalesce(i.display_number, '') ilike ${q}
          or exists (
               select 1 from invoices_line_items li
               where li._parent_id = i.id and li.description ilike ${q}
             )
        )
      order by i.issued_date desc nulls last, i.id desc
      limit ${limit}
    `,
  )

  return rows.map((r) => ({
    id: Number(r.id),
    reference: (r.display_number as string) || (r.invoice_number ? String(r.invoice_number) : 'Draft'),
    invoiceNumber: r.invoice_number === null ? null : Number(r.invoice_number),
    status: String(r.status),
    title: (r.title as string) ?? null,
    work: (r.work as string) ?? null,
    clientId: Number(r.client_id),
    clientName: String(r.client_name),
    issuedDate: iso(r.issued_date),
    dueDate: iso(r.due_date),
    dueMode: (r.due_mode as string) ?? null,
    currency: (r.currency as CurrencyCode) ?? 'AUD',
    totalCents: cents(r.total_cents),
    balanceCents: cents(r.balance_cents),
    shareToken: (r.share_token as string) ?? null,
    daysOverdue: Number(r.days_overdue ?? 0),
  }))
}

export type AgingBucket = { label: string; cents: number; count: number }

export type ArchiveStanding = {
  filings: number
  clients: number
  outstandingByCurrency: { currency: CurrencyCode; cents: number }[]
  /**
   * Aging of what is unpaid, grouped BY CURRENCY.
   *
   * Never one flat set of buckets: summing AUD and NZD balances into a single
   * figure and labelling it with whichever currency happened to sort first is
   * exactly the confidently-wrong number this product refuses everywhere else.
   */
  agingByCurrency: { currency: CurrencyCode; buckets: AgingBucket[] }[]
}

/**
 * The standing of the whole archive. Deliberately not a KPI row: it reads as a
 * cover-sheet sentence, and the only chart is the aging of what is unpaid.
 */
export async function getArchiveStanding(args: {
  payload: Payload
  ownerId: number
}): Promise<ArchiveStanding> {
  const { payload, ownerId } = args

  const [totals] = await run(
    payload,
    sql`
      select
        (select count(*) from invoices where owner_id = ${ownerId}) as filings,
        (select count(*) from clients  where owner_id = ${ownerId}) as clients
    `,
  )

  const outstanding = await run(
    payload,
    sql`
      select currency, coalesce(sum(balance_cents), 0) as cents
      from invoices
      where owner_id = ${ownerId} and status in ('sent', 'overdue')
      group by currency
      having coalesce(sum(balance_cents), 0) > 0
      order by cents desc
    `,
  )

  const aging = await run(
    payload,
    sql`
      select currency, bucket, coalesce(sum(balance_cents), 0) as cents, count(*) as count
      from (
        select
          currency,
          balance_cents,
          case
            -- An invoice with no due date has no age. It is counted and kept
            -- visible, but it is never asserted into a bucket it did not earn.
            when due_date is null then 'undated'
            when (current_date - due_date::date) <= 30 then '0-30'
            when (current_date - due_date::date) <= 60 then '31-60'
            when (current_date - due_date::date) <= 90 then '61-90'
            else '90+'
          end as bucket
        from invoices
        where owner_id = ${ownerId} and status in ('sent', 'overdue')
      ) buckets
      group by currency, bucket
    `,
  )

  const perCurrency = new Map<string, Map<string, { cents: number; count: number }>>()
  for (const r of aging) {
    const cur = String(r.currency ?? 'AUD')
    if (!perCurrency.has(cur)) perCurrency.set(cur, new Map())
    perCurrency
      .get(cur)!
      .set(String(r.bucket), { cents: cents(r.cents), count: Number(r.count ?? 0) })
  }

  return {
    filings: Number(totals?.filings ?? 0),
    clients: Number(totals?.clients ?? 0),
    outstandingByCurrency: outstanding.map((r) => ({
      currency: (r.currency as CurrencyCode) ?? 'AUD',
      cents: cents(r.cents),
    })),
    agingByCurrency: [...perCurrency.entries()]
      .map(([currency, buckets]) => ({
        currency: currency as CurrencyCode,
        buckets: ['0-30', '31-60', '61-90', '90+', 'undated'].map((label) => ({
          label,
          cents: buckets.get(label)?.cents ?? 0,
          count: buckets.get(label)?.count ?? 0,
        })),
      }))
      // Undated carries no age, so it is dropped unless it actually holds money.
      .map((group) => ({
        ...group,
        buckets: group.buckets.filter(
          (b) => b.label !== 'undated' || b.cents > 0,
        ),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  }
}
