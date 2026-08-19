import type { NextRequest } from 'next/server'

import { getSession } from '@/lib/auth/dal'
import { sendInvoice } from '@/lib/invoices/send'

/** Issues and emails an invoice. Owner-scoped, and never triggered by a status edit. */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return Response.json({ error: 'Not authenticated.' }, { status: 401 })

  // Confirm ownership through access control before doing any work.
  const owned = await session.payload.findByID({
    collection: 'invoices',
    id,
    depth: 0,
    overrideAccess: false,
    user: session.user,
    disableErrors: true,
  })
  if (!owned) return Response.json({ error: 'Not found.' }, { status: 404 })

  const resend = new URL(request.url).searchParams.get('resend') === '1'

  try {
    const result = await sendInvoice({
      payload: session.payload,
      invoiceId: Number(id),
      resend,
    })
    return Response.json(result)
  } catch (error) {
    const status = (error as { status?: number })?.status ?? 500
    return Response.json(
      { error: error instanceof Error ? error.message : 'Send failed.' },
      { status },
    )
  }
}
