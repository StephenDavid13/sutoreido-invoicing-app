import type { NextRequest } from 'next/server'

import { getPayloadUnscoped_DANGEROUS } from '@/lib/auth/dal'
import { findDueRenewals, runServiceBilling } from '@/lib/services/billing-run'

/**
 * Daily billing run, invoked by Vercel Cron.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations, so
 * that header is the only thing standing between this and the open internet —
 * without the check, anyone could trigger invoice generation.
 *
 * Idempotent by design, which matters because Vercel cron is documented as
 * best-effort: it can fire the same schedule twice and it can miss a day
 * entirely. The unique index on (service, periodStart) makes a double fire a
 * no-op, and because the run queries by date window rather than "what changed
 * since yesterday", a missed day self-heals on the next run.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // One of the two legitimate unscoped callers: a cron has no request user, so
  // there is no session for access control to resolve against.
  const payload = await getPayloadUnscoped_DANGEROUS()

  const billing = await runServiceBilling({ payload })
  const renewals = await findDueRenewals({ payload })

  return Response.json({
    ranAt: new Date().toISOString(),
    invoicesCreated: billing.invoicesCreated.length,
    periodsBilled: billing.periodsBilled,
    servicesSkipped: billing.servicesSkipped,
    // Anything at or past its warning window, most urgent first.
    renewalsDue: renewals.map((r) => ({
      service: r.service,
      client: r.client,
      vendor: r.vendor,
      renewsOn: r.renewsOn,
      daysAway: r.daysAway,
    })),
  })
}
