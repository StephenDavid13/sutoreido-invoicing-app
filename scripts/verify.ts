import { getPayload } from 'payload'
import config from '@payload-config'

import { computeInvoiceTotals } from '@/lib/invoices/totals'

/**
 * Proves the invariants actually hold at runtime rather than just in the config.
 * Run with:  npm run verify
 */

let failures = 0
function check(label: string, pass: boolean, detail = '') {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function expectRejection(label: string, fn: () => Promise<unknown>, expectIn: string) {
  try {
    await fn()
    check(label, false, 'the operation was ALLOWED but should have been rejected')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    check(label, message.includes(expectIn), message.split('\n')[0])
  }
}

async function verify() {
  const payload = await getPayload({ config })

  const invoice = (await payload.find({ collection: 'invoices', limit: 1, sort: 'id' })).docs[0]
  if (!invoice) throw new Error('No invoice found — run `npm run seed` first.')

  console.log(`\n--- invoice ${invoice.displayNumber} (status ${invoice.status}) ---`)

  // 1. Numbering continues the historical series.
  check('invoice number continues the Google Docs series at 6', invoice.invoiceNumber === 6,
    `got ${invoice.invoiceNumber}`)

  // 2. Totals are internally consistent.
  const consistent =
    (invoice.totalCents ?? 0) ===
    (invoice.subtotalCents ?? 0) - (invoice.discountCents ?? 0) + (invoice.taxCents ?? 0)
  check('subtotal - discount + tax === total', consistent,
    `${invoice.subtotalCents} - ${invoice.discountCents ?? 0} + ${invoice.taxCents} = ${invoice.totalCents}`)

  // 3. Not GST-registered => no tax, and the flag was frozen at issue.
  check('no GST charged while unregistered', invoice.taxCents === 0)
  check('GST posture frozen at issue', invoice.gstRegisteredAtIssue === false)

  // 4. The sequence row exists and matches.
  const seq = (await payload.find({ collection: 'number-sequences', limit: 10 })).docs
  check('one invoice sequence row exists', seq.length === 1,
    `kind=${seq[0]?.kind} lastValue=${seq[0]?.lastValue}`)

  // 5. The audit trail recorded the draft -> sent transition.
  const log = (await payload.find({
    collection: 'activity-log',
    where: { entityId: { equals: String(invoice.id) } },
    sort: 'occurredAt',
  })).docs
  check('activity log recorded the transition', log.length === 1,
    log[0] ? `${log[0].fromStatus} -> ${log[0].toStatus}` : 'no rows')

  // 6. The state machine rejects an un-send.
  await expectRejection(
    'sent -> draft is rejected (no un-send)',
    () => payload.update({ collection: 'invoices', id: invoice.id, data: { status: 'draft' } }),
    'cannot transition from sent to draft',
  )

  // 7. Terminal states are terminal.
  //
  // This creates a throwaway invoice, so its id is captured and deleted below —
  // an earlier version leaked one probe invoice per run into the database, which
  // then showed up as "the most recent invoice" in other tooling.
  let probeId: number | string | undefined
  await expectRejection(
    'sent -> cancelled -> paid is rejected (cancelled is terminal)',
    async () => {
      const c = await payload.create({
        collection: 'invoices',
        data: {
          owner: invoice.owner, client: invoice.client, status: 'draft',
          issuedDate: '2026-08-08T00:00:00.000Z', dueMode: 'on_receipt', currency: 'AUD',
          qtyLabel: 'Qty', taxRateBasisPoints: 0,
          lineItems: [{ description: 'probe', quantityMilli: 1000, unitPriceCents: 100 }],
        },
      })
      probeId = c.id
      await payload.update({ collection: 'invoices', id: c.id, data: { status: 'cancelled' } })
      return payload.update({ collection: 'invoices', id: c.id, data: { status: 'paid' } })
    },
    'cannot transition from cancelled to paid',
  )

  // 8. Line items are frozen once the invoice leaves draft.
  await expectRejection(
    'line items cannot change after sending',
    () => payload.update({
      collection: 'invoices',
      id: invoice.id,
      data: { lineItems: [{ description: 'tampered', quantityMilli: 9000, unitPriceCents: 99999 }] },
    }),
    'only be changed while the invoice is a draft',
  )

  // 9. Rounding happens once, per line, and the subtotal is their plain sum.
  const awkward = computeInvoiceTotals({
    lineItems: [
      { quantityMilli: 3000, unitPriceCents: 42307 }, // invoice #1: 3 x $423.07
      { quantityMilli: 333, unitPriceCents: 10 },     // 0.333 x $0.10 -> rounds
    ],
    taxRateBasisPoints: 0,
  })
  check('line rounding then plain sum', awkward.subtotalCents === 126921 + 3,
    `lines=${JSON.stringify(awkward.lineTotals)} subtotal=${awkward.subtotalCents}`)
  check('invoice #1 line total reproduces $1,269.21', awkward.lineTotals[0] === 126921,
    `got ${awkward.lineTotals[0]}`)

  if (probeId !== undefined) {
    await payload.delete({ collection: 'activity-log', where: { entityId: { equals: String(probeId) } } })
    await payload.delete({ collection: 'invoices', id: probeId })
    check('probe invoice cleaned up', true, `deleted id ${probeId}`)
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
  process.exit(failures === 0 ? 0 : 1)
}

await verify()
