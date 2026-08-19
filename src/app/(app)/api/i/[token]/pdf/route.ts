import type { NextRequest } from 'next/server'

import { getPayloadUnscoped_DANGEROUS } from '@/lib/auth/dal'
import { buildInvoicePdfModel } from '@/lib/pdf/build-invoice-model'
import { renderInvoicePdf } from '@/lib/pdf/render'
import type { BankAccount, BusinessSetting, Client, Invoice, InvoiceDefault } from '@/payload-types'

/**
 * The PDF behind a share token.
 *
 * The authenticated route at /api/invoices/[id]/pdf is for the operator and 401s
 * anonymous callers, so a client following a share link needs this: the token is
 * the authorisation, and it resolves exactly one invoice.
 *
 * Drafts are refused even if a token somehow exists, so an unsent document can
 * never be fetched publicly.
 */
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!token || token.length < 16) {
    return Response.json({ error: 'Not found.' }, { status: 404 })
  }

  const payload = await getPayloadUnscoped_DANGEROUS()

  const found = await payload.find({
    collection: 'invoices',
    where: { shareToken: { equals: token } },
    limit: 1,
    depth: 1,
  })

  const invoice = found.docs[0] as Invoice | undefined
  if (!invoice || invoice.status === 'draft') {
    return Response.json({ error: 'Not found.' }, { status: 404 })
  }

  const client = invoice.client
  if (!client || typeof client !== 'object') {
    return Response.json({ error: 'Not found.' }, { status: 404 })
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

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${model.numberLabel}.pdf"`,
      // A share link is not indexable and must not be cached by intermediaries.
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
