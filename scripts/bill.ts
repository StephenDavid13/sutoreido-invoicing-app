import { getPayload } from 'payload'
import config from '@payload-config'

import { formatMoneyExplicit } from '@/lib/money/money'
import type { CurrencyCode } from '@/lib/money/currencies'
import { findDueRenewals, runServiceBilling } from '@/lib/services/billing-run'
import type { Client, Service } from '@/payload-types'

/**
 * The monthly billing run, plus a renewal and margin report.
 *
 *   npm run bill              raise draft invoices for every period that is due
 *   DRY_RUN=1 npm run bill    show what it would do, change nothing
 *   AS_AT=2026-09-08 npm run bill   pretend it is another date
 *
 * Idempotent: re-running never double-invoices a period.
 */

// Explicit prefix (A$ / NZ$) — this report mixes currencies.
const money = (cents: number, currency: string) =>
  formatMoneyExplicit(cents, currency as CurrencyCode)

async function main() {
  const payload = await getPayload({ config })
  const dryRun = Boolean(process.env.DRY_RUN)
  const asAt = process.env.AS_AT ? new Date(`${process.env.AS_AT}T00:00:00.000Z`) : new Date()

  console.log(`\n=== Billing run${dryRun ? ' (DRY RUN)' : ''} — as at ${asAt.toISOString().slice(0, 10)} ===`)

  const result = await runServiceBilling({ payload, asAt, dryRun })

  if (result.invoicesCreated.length === 0) {
    console.log('  nothing due')
  } else {
    for (const inv of result.invoicesCreated) {
      console.log(
        `  invoice ${inv.id}  ${inv.client}  ${inv.lines} line(s)  ${money(inv.totalCents, inv.currency)}`,
      )
    }
    console.log(`  ${result.periodsBilled} period(s) billed across ${result.invoicesCreated.length} draft invoice(s)`)
  }
  for (const skip of result.servicesSkipped) {
    console.log(`  SKIPPED  ${skip.name} — ${skip.reason}`)
  }

  // ------------------------------------------------------------- renewals
  console.log('\n=== Renewals due ===')
  const renewals = await findDueRenewals({ payload, asAt })
  if (renewals.length === 0) {
    console.log('  none inside their warning window')
  } else {
    for (const r of renewals) {
      const when =
        r.daysAway < 0 ? `OVERDUE by ${-r.daysAway}d` : r.daysAway === 0 ? 'TODAY' : `in ${r.daysAway}d`
      console.log(
        `  ${when.padEnd(16)} ${r.renewsOn}  ${r.vendor} — ${r.service} (${r.client})  ${money(r.amountCents, r.currency)}`,
      )
    }
  }

  // ------------------------------------------------- recurring revenue + margin
  console.log('\n=== Recurring revenue (monthly equivalents) ===')
  const active = await payload.find({
    collection: 'services',
    where: { status: { equals: 'active' } },
    depth: 1,
    limit: 500,
  })

  const byCurrency = new Map<string, { charge: number; cost: number; count: number; mismatch: boolean }>()
  for (const svc of active.docs as Service[]) {
    const cur = svc.currency ?? 'AUD'
    const agg = byCurrency.get(cur) ?? { charge: 0, cost: 0, count: 0, mismatch: false }
    agg.charge += svc.monthlyChargeCents ?? 0
    agg.cost += svc.monthlyCostCents ?? 0
    agg.count += 1
    agg.mismatch = agg.mismatch || Boolean(svc.costCurrencyMismatch)
    byCurrency.set(cur, agg)
  }

  if (byCurrency.size === 0) {
    console.log('  no active services')
  } else {
    for (const [cur, agg] of byCurrency) {
      const margin = agg.charge - agg.cost
      const pct = agg.charge > 0 ? Math.round((margin / agg.charge) * 100) : 0
      console.log(
        `  ${cur}  ${agg.count} service(s)   MRR ${money(agg.charge, cur)}   cost ${money(agg.cost, cur)}   margin ${money(margin, cur)} (${pct}%)`,
      )
      if (agg.mismatch) {
        console.log(
          `        note: some costs are in another currency and are EXCLUDED from margin — no FX rate is recorded, so converting would be a guess.`,
        )
      }
    }
    // Deliberately no cross-currency total: adding AUD to NZD without a recorded
    // rate would produce a confident-looking wrong number.
    if (byCurrency.size > 1) {
      console.log('  (no combined total — AUD and NZD are not summed without a recorded FX rate)')
    }
  }

  console.log('\n=== Per service ===')
  for (const svc of active.docs as Service[]) {
    const cur = svc.currency ?? 'AUD'
    console.log(
      `  ${(svc.name ?? '').padEnd(34)} ${((svc.client as Client)?.name ?? '?').padEnd(22)} ` +
        `${money(svc.chargeCents ?? 0, cur).padStart(11)}/${(svc.billingPeriod ?? '').padEnd(10)} ` +
        `next ${String(svc.nextInvoiceOn ?? '').slice(0, 10)}  margin ${money(svc.monthlyMarginCents ?? 0, cur)}/mo`,
    )
  }
  console.log()
}

await main()
process.exit(0)
