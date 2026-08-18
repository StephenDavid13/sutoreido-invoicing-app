import type { Payload } from 'payload'

import type { BankAccount, Client, Service } from '@/payload-types'
import type { CurrencyCode } from '@/lib/money/currencies'

import {
  nthPeriodStart,
  periodsDue,
  startOfDayUTC,
  type BillingPeriod,
} from './periods'

type BillingItem = {
  service: Service
  periodIndex: number
  periodStart: Date
  periodEnd: Date
}

export type BillingRunResult = {
  invoicesCreated: { id: number | string; client: string; currency: string; lines: number; totalCents: number }[]
  periodsBilled: number
  servicesSkipped: { name: string; reason: string }[]
  dryRun: boolean
}

/**
 * Normalises a Payload relationship to its numeric id, whether it arrived
 * populated (depth > 0) or as a bare id. Ids are serial integers here — that is
 * the adapter's default and what the generated types expect.
 */
function idOf(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  if (typeof value === 'object' && 'id' in value) return idOf((value as { id: unknown }).id)
  return undefined
}

/**
 * Raises invoices for every service period that has started and not yet been
 * billed.
 *
 * Safe to re-run. Periods already recorded in `service-billings` are filtered out
 * before anything is created, and the unique index on (service, periodStart) is
 * the backstop against a concurrent second run.
 *
 * Generated invoices are DRAFTS. Combined with allocating numbers on send, that
 * means a failed or duplicated run cannot burn an invoice number or put a wrong
 * document in front of a client — the worst case is a stray draft you delete.
 */
export async function runServiceBilling(args: {
  payload: Payload
  asAt?: Date
  dryRun?: boolean
}): Promise<BillingRunResult> {
  const { payload, dryRun = false } = args
  const asAt = startOfDayUTC(args.asAt ?? new Date())

  const result: BillingRunResult = {
    invoicesCreated: [],
    periodsBilled: 0,
    servicesSkipped: [],
    dryRun,
  }

  const due = await payload.find({
    collection: 'services',
    where: {
      and: [
        { status: { equals: 'active' } },
        { autoGenerate: { equals: true } },
        { nextInvoiceOn: { less_than_equal: asAt.toISOString() } },
      ],
    },
    depth: 1, // populate client + bankAccount
    limit: 500,
  })

  const [settings, defaults] = await Promise.all([
    payload.findGlobal({ slug: 'business-settings', depth: 0 }),
    payload.findGlobal({ slug: 'invoice-defaults', depth: 0 }),
  ])

  // ---------------------------------------------------------------- gather
  const items: BillingItem[] = []

  for (const service of due.docs as Service[]) {
    const period = (service.billingPeriod ?? 'monthly') as BillingPeriod
    const already = service.periodsBilled ?? 0
    const count = periodsDue(service.startDate!, already, period, asAt)

    if (count === 0) continue

    if (!idOf(service.client)) {
      result.servicesSkipped.push({ name: service.name, reason: 'no client attached' })
      continue
    }

    for (let i = 0; i < count; i++) {
      const periodIndex = already + i
      const periodStart = nthPeriodStart(service.startDate!, periodIndex, period)
      const periodEnd = new Date(nthPeriodStart(service.startDate!, periodIndex + 1, period).getTime() - 86_400_000)

      // A service with an end date stops once a period would begin past it.
      if (service.endDate && periodStart > startOfDayUTC(service.endDate)) break

      items.push({ service, periodIndex, periodStart, periodEnd })
    }
  }

  if (items.length === 0) return result

  // ------------------------------------------- drop periods already invoiced
  const existing = await payload.find({
    collection: 'service-billings',
    where: { service: { in: items.map((i) => idOf(i.service.id)).join(',') } },
    limit: 2000,
    depth: 0,
  })
  const billedKeys = new Set(
    existing.docs.map(
      (row) => `${idOf(row.service)}|${startOfDayUTC(row.periodStart as string).toISOString()}`,
    ),
  )
  const fresh = items.filter(
    (i) => !billedKeys.has(`${idOf(i.service.id)}|${i.periodStart.toISOString()}`),
  )

  if (fresh.length === 0) return result

  // -------------------- one invoice per client + currency + period start
  // Hosting and maintenance for the same client on the same day belong on one
  // invoice; separate periods stay separate so each is auditable on its own.
  const groups = new Map<string, BillingItem[]>()
  for (const item of fresh) {
    const key = [
      idOf(item.service.client),
      item.service.currency,
      item.periodStart.toISOString(),
    ].join('|')
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  for (const group of groups.values()) {
    const first = group[0]
    const client = first.service.client as Client
    const currency = first.service.currency as CurrencyCode
    const ownerId = idOf(first.service.owner)
    const clientId = idOf(client)

    // Narrowed explicitly rather than coerced: an invoice with no owner would
    // escape tenant scoping, and one with no client cannot be rendered.
    if (ownerId === undefined || clientId === undefined) {
      result.servicesSkipped.push({
        name: first.service.name,
        reason: ownerId === undefined ? 'service has no owner' : 'service has no client',
      })
      continue
    }

    const termsDays =
      first.service.paymentTermsDays ?? client?.defaultPaymentTermsDays ?? 14

    const bankAccount =
      idOf(first.service.bankAccount) ??
      (await defaultBankAccountId(payload, ownerId, currency))

    const periodLabel = first.periodStart.toISOString().slice(0, 10)
    const lines = group.map((item) => ({
      description: item.service.lineDescription || item.service.name,
      quantityMilli: item.service.quantityMilli ?? 1000,
      unitPriceCents: item.service.chargeCents ?? 0,
    }))
    const totalCents = lines.reduce(
      (sum, l) => sum + Math.round((l.quantityMilli * l.unitPriceCents) / 1000),
      0,
    )

    if (dryRun) {
      result.invoicesCreated.push({
        id: `(dry run) ${client?.name} ${periodLabel}`,
        client: client?.name ?? '?',
        currency,
        lines: lines.length,
        totalCents,
      })
      result.periodsBilled += group.length
      continue
    }

    const terms = (defaults?.defaultTermsTemplate ?? '')
      .replaceAll('{{paymentTermsDays}}', String(termsDays))
      .replaceAll('{{bankDetails}}', '')
      .trim()

    const invoice = await payload.create({
      collection: 'invoices',
      data: {
        owner: ownerId,
        client: clientId,
        // Issued today, never backdated — a catch-up run must not fabricate a
        // historical issue date on a legal document. The period is in the title.
        issuedDate: asAt.toISOString(),
        status: 'draft',
        title: invoiceTitle(group, first.periodStart),
        dueMode: client?.defaultDueMode ?? 'on_receipt',
        paymentTermsDays: termsDays,
        currency,
        qtyLabel: first.service.qtyLabel ?? 'Qty',
        taxRateBasisPoints: settings?.gstRegistered ? (settings?.taxJurisdiction === 'NZ' ? 1500 : 1000) : 0,
        taxLabel: settings?.taxLabel ?? 'GST',
        bankAccount: bankAccount ?? undefined,
        terms: terms || undefined,
        lineItems: lines,
      },
    })

    for (const item of group) {
      const serviceId = idOf(item.service.id)
      if (serviceId === undefined) continue
      await payload.create({
        collection: 'service-billings',
        data: {
          owner: ownerId,
          service: serviceId,
          invoice: invoice.id,
          periodStart: item.periodStart.toISOString(),
          periodEnd: item.periodEnd.toISOString(),
          periodLabel: `${item.periodStart.toISOString().slice(0, 10)} → ${item.periodEnd.toISOString().slice(0, 10)}`,
          chargeCents: item.service.chargeCents ?? 0,
        },
      })
    }

    result.invoicesCreated.push({
      id: invoice.id,
      client: client?.name ?? '?',
      currency,
      lines: lines.length,
      totalCents: invoice.totalCents ?? totalCents,
    })
    result.periodsBilled += group.length
  }

  // ------------------------------------------------ advance the counters
  if (!dryRun) {
    const perService = new Map<number, number>()
    for (const item of fresh) {
      const key = idOf(item.service.id)
      if (key === undefined) continue
      perService.set(key, (perService.get(key) ?? 0) + 1)
    }
    for (const [serviceId, count] of perService) {
      const service = due.docs.find((d) => idOf(d.id) === serviceId) as Service
      await payload.update({
        collection: 'services',
        id: serviceId,
        // The beforeChange hook recomputes nextInvoiceOn from this.
        data: { periodsBilled: (service.periodsBilled ?? 0) + count },
      })
    }
  }

  return result
}

function invoiceTitle(group: BillingItem[], periodStart: Date): string {
  const month = periodStart.toLocaleString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  if (group.length === 1) return `${group[0].service.name} — ${month}`
  const kinds = [...new Set(group.map((g) => g.service.kind))].join(' & ')
  return `${kinds} — ${month}`
}

async function defaultBankAccountId(
  payload: Payload,
  ownerId: number | undefined,
  currency: CurrencyCode,
): Promise<number | undefined> {
  const found = await payload.find({
    collection: 'bank-accounts',
    where: {
      and: [
        { currency: { equals: currency } },
        { isDefault: { equals: true } },
        { archived: { not_equals: true } },
        ...(ownerId ? [{ owner: { equals: ownerId } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
  })
  return idOf((found.docs[0] as BankAccount | undefined)?.id)
}

/**
 * Costs whose renewal falls inside their warning window.
 *
 * This is the half of the feature that prevents an outage rather than raising an
 * invoice: a lapsed domain takes the client's site down, and nothing else in the
 * system would notice.
 */
export async function findDueRenewals(args: { payload: Payload; asAt?: Date }) {
  const { payload } = args
  const asAt = startOfDayUTC(args.asAt ?? new Date())

  const services = await payload.find({
    collection: 'services',
    where: { status: { not_equals: 'cancelled' } },
    depth: 1,
    limit: 500,
  })

  const rows: {
    service: string
    client: string
    vendor: string
    renewsOn: string
    daysAway: number
    amountCents: number
    currency: string
  }[] = []

  for (const service of services.docs as Service[]) {
    for (const cost of service.costs ?? []) {
      if (!cost.renewsOn) continue
      const notifyDays = cost.notifyDaysBefore ?? 30
      if (notifyDays === 0) continue

      const renews = startOfDayUTC(cost.renewsOn)
      const daysAway = Math.round((renews.getTime() - asAt.getTime()) / 86_400_000)
      if (daysAway > notifyDays) continue

      rows.push({
        service: service.name,
        client: (service.client as Client)?.name ?? '?',
        vendor: cost.vendor,
        renewsOn: renews.toISOString().slice(0, 10),
        daysAway,
        amountCents: cost.amountCents ?? 0,
        currency: cost.currency ?? 'AUD',
      })
    }
  }

  // Most urgent first, overdue included (negative days).
  return rows.sort((a, b) => a.daysAway - b.daysAway)
}
