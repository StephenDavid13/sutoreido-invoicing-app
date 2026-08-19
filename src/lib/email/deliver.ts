import type { Payload } from 'payload'

import { emailIsLive } from './adapter'

export type DeliveryOutcome = {
  delivered: boolean
  /** Distinguishes a real transport error from an unconfigured transport. */
  state: 'delivered' | 'composed' | 'failed'
  /** Where it actually went, after any redirect. */
  actualTo: string
  /** Where it was addressed. */
  intendedTo: string
  redirected: boolean
  live: boolean
  note: string
}

/**
 * The single door every outbound message goes through.
 *
 * This project's database holds REAL client email addresses, and the operator is
 * testing an invoicing app against their own live records. So there is a redirect
 * guard: set EMAIL_REDIRECT_TO and every message goes there instead, with the
 * intended recipient named in the subject. Nothing can reach a client by accident
 * while the guard is on.
 *
 * Both senders route through here on purpose. A second send path would be a second
 * chance to bypass the guard.
 */
export async function deliver(args: {
  payload: Payload
  to: string
  cc?: string[]
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer }[]
}): Promise<DeliveryOutcome> {
  const { payload, to, cc, subject, html, attachments } = args

  const redirectTo = process.env.EMAIL_REDIRECT_TO?.trim()
  const live = emailIsLive()

  const actualTo = redirectTo || to
  const redirected = Boolean(redirectTo) && redirectTo !== to
  const finalSubject = redirected ? `[would go to ${to}] ${subject}` : subject

  try {
    await payload.sendEmail({
      to: actualTo,
      // Copies are dropped entirely under redirect: the point is that nobody
      // except the redirect address is contacted.
      cc: redirected ? undefined : cc?.length ? cc : undefined,
      subject: finalSubject,
      html,
      attachments,
    })
  } catch (error) {
    return {
      delivered: false,
      state: 'failed',
      actualTo,
      intendedTo: to,
      redirected,
      live,
      note: `Delivery failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (!live) {
    return {
      delivered: false,
      state: 'composed',
      actualTo,
      intendedTo: to,
      redirected,
      live,
      note: `Composed but NOT sent: no email transport is configured, so it was written to the server log. Intended recipient was ${to}.`,
    }
  }

  return {
    delivered: true,
    state: 'delivered',
    actualTo,
    intendedTo: to,
    redirected,
    live,
    note: redirected
      ? `Sent to the redirect address ${actualTo} instead of ${to}, because EMAIL_REDIRECT_TO is set.`
      : `Emailed to ${to}${cc?.length ? ` (cc ${cc.join(', ')})` : ''}.`,
  }
}
