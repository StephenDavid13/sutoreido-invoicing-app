import type { NextRequest } from 'next/server'

import { getPayloadUnscoped_DANGEROUS } from '@/lib/auth/dal'
import { runReminderSweep } from '@/lib/reminders/sweep'

/**
 * The daily chasing sweep: marks late invoices overdue and PREPARES reminders.
 *
 * It sends nothing. Preparation raises a notification; a person presses send. That
 * separation is why this endpoint is safe to run on a best-effort scheduler.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const payload = await getPayloadUnscoped_DANGEROUS()
  const result = await runReminderSweep({ payload })

  return Response.json({ ranAt: new Date().toISOString(), ...result })
}
