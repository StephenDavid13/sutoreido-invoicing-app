import type { Payload } from 'payload'

/**
 * Creates a notification, or does nothing if the same fact is already on record.
 *
 * `dedupeKey` is uniquely indexed, so a sweep that runs twice in a day restates
 * nothing. The insert simply fails and is swallowed, which is the cheapest correct
 * behaviour: no read-then-write race, no duplicate.
 */
export async function notify(args: {
  payload: Payload
  ownerId: number
  kind:
    | 'reminder_prepared'
    | 'invoice_overdue'
    | 'ready_to_bill'
    | 'renewal_due'
    | 'invoice_viewed'
    | 'delivery_failed'
  title: string
  body?: string
  actionUrl?: string
  dedupeKey: string
}): Promise<boolean> {
  const { payload, ownerId, kind, title, body, actionUrl, dedupeKey } = args
  try {
    await payload.create({
      collection: 'notifications',
      data: { owner: ownerId, kind, title, body, actionUrl, dedupeKey },
    })
    return true
  } catch {
    // Unique violation on dedupeKey: the fact is already known.
    return false
  }
}
