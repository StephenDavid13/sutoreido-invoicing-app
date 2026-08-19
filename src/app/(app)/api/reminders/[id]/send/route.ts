import type { NextRequest } from 'next/server'

import { getSession } from '@/lib/auth/dal'
import { sendPreparedReminder } from '@/lib/reminders/send'

/** Sends one already-composed reminder. The button behind the prepared-outbox model. */
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return Response.json({ error: 'Not authenticated.' }, { status: 401 })

  const owned = await session.payload.findByID({
    collection: 'invoice-reminders',
    id,
    depth: 0,
    overrideAccess: false,
    user: session.user,
    disableErrors: true,
  })
  if (!owned) return Response.json({ error: 'Not found.' }, { status: 404 })

  try {
    const result = await sendPreparedReminder({ payload: session.payload, reminderId: Number(id) })
    return Response.json(result)
  } catch (error) {
    const status = (error as { status?: number })?.status ?? 500
    return Response.json(
      { error: error instanceof Error ? error.message : 'Send failed.' },
      { status },
    )
  }
}
