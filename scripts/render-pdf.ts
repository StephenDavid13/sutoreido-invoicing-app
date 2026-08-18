import { mkdirSync, writeFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildInvoicePdfModel } from '@/lib/pdf/build-invoice-model'
import { renderInvoicePdf } from '@/lib/pdf/render-core'
import type { BankAccount, BusinessSetting, Client, Invoice, InvoiceDefault } from '@/payload-types'

/**
 * Renders an invoice PDF straight to disk, bypassing HTTP and auth.
 *
 * This is the fast loop for checking the document itself. Pass an invoice id, or
 * omit it to render the most recent invoice:
 *   npm run render:pdf -- 7
 */

const OUT_DIR = 'tmp/pdf'

async function main() {
  const payload = await getPayload({ config })
  const idArg = process.argv.slice(2).find((a) => /^\d+$/.test(a))

  const invoice = (idArg
    ? await payload.findByID({ collection: 'invoices', id: Number(idArg), depth: 1 })
    : (await payload.find({ collection: 'invoices', limit: 1, sort: '-createdAt', depth: 1 }))
        .docs[0]) as Invoice | undefined

  if (!invoice) throw new Error('No invoice found. Create one in /admin first.')

  const client = invoice.client
  if (!client || typeof client !== 'object') throw new Error('Invoice has no client attached.')

  const [settings, defaults] = await Promise.all([
    payload.findGlobal({ slug: 'business-settings', depth: 0 }) as Promise<BusinessSetting>,
    payload.findGlobal({ slug: 'invoice-defaults', depth: 0 }) as Promise<InvoiceDefault>,
  ])

  const model = buildInvoicePdfModel({
    invoice,
    client: client as Client,
    bankAccount:
      invoice.bankAccount && typeof invoice.bankAccount === 'object'
        ? (invoice.bankAccount as BankAccount)
        : null,
    settings,
    defaults,
  })

  // render-core, not render: the latter adds a `server-only` guard that throws
  // outside Next's bundler.
  const pdf = await renderInvoicePdf(model)
  mkdirSync(OUT_DIR, { recursive: true })
  const path = `${OUT_DIR}/invoice-${model.numberLabel || invoice.id}.pdf`
  writeFileSync(path, pdf)

  console.log(`heading     ${model.headingLabel}`)
  console.log(`issued/due  ${model.issuedLabel} / ${model.dueLabel}`)
  console.log(`columns     ${model.columns.map((c) => c.label).join(' | ')}`)
  console.log(`tax line    ${model.taxLine ? JSON.stringify(model.taxLine) : 'none (not GST-registered)'}`)
  console.log(`subtotal    ${model.showSubtotal ? model.subtotalLabel : 'hidden (equals total)'}`)
  console.log(`amount due  ${model.totalLabel}`)
  console.log(`\nwrote ${path} (${pdf.length} bytes)`)
}

await main()
process.exit(0)
