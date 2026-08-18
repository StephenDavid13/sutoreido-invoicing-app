import type { NextRequest } from 'next/server'

import { getSession } from '@/lib/auth/dal'
import { buildInvoicePdfModel } from '@/lib/pdf/build-invoice-model'
import { renderInvoicePdf } from '@/lib/pdf/render'
import type { BankAccount, BusinessSetting, Client, Invoice, InvoiceDefault } from '@/payload-types'

/**
 * On-demand invoice PDF, for previewing drafts and re-downloading.
 *
 * Note this lives at /api/... which is OURS — Payload's catch-all was moved to
 * /payload-api precisely so this route is reachable.
 *
 * The archived, immutable copy of a sent invoice is a separate concern (a job
 * that stores the rendered bytes in `media`); this route always re-renders from
 * current data and is therefore only safe for the owner's own eyes.
 */

// @react-pdf/renderer needs Node: it uses Yoga (WASM layout) and Node streams.
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Route handlers must answer, not redirect — so getSession, not requireSession.
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const { payload, user } = session

  // overrideAccess: false is the whole point — without it Payload's Local API
  // would happily hand back another owner's invoice.
  const invoice = (await payload.findByID({
    collection: 'invoices',
    id,
    depth: 1, // populates client and bankAccount
    overrideAccess: false,
    user,
    disableErrors: true,
  })) as Invoice | null

  // Deliberately 404, never 403: the response must not confirm that an invoice
  // belonging to someone else exists.
  if (!invoice) {
    return Response.json({ error: 'Not found.' }, { status: 404 })
  }

  const client = invoice.client
  if (!client || typeof client !== 'object') {
    return Response.json({ error: 'This invoice has no client attached.' }, { status: 409 })
  }

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

  const pdf = await renderInvoicePdf(model)
  const filename = `invoice-${model.numberLabel || invoice.id}.pdf`

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      // `inline` so it previews in the browser tab rather than force-downloading.
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
