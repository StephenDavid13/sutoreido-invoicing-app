import type { Payload } from 'payload'



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

  const actualTo = redirectTo || to
  const redirected = Boolean(redirectTo) && redirectTo !== to
  const finalSubject = redirected ? `[would go to ${to}] ${subject}` : subject

  /*
   * Delivery is judged by the RESULT, never by the configuration.
   *
   * An earlier version asked the environment whether email was live. That reads
   * process.env at call time, but the transport is built once when Payload
   * initialises — so after adding a key without restarting, the env said "live"
   * while the instance still had no transport, and a message that went to the
   * console was reported as delivered. On an invoicing surface that is the worst
   * possible lie: it says a client was chased when they were not.
   *
   * A real transport returns a provider message id. Nothing else counts.
   */
  let providerId: string | undefined
  try {
    const result = (await payload.sendEmail({
      to: actualTo,
      // Copies are dropped entirely under redirect: the point is that nobody
      // except the redirect address is contacted.
      cc: redirected ? undefined : cc?.length ? cc : undefined,
      subject: finalSubject,
      html,
      attachments,
    })) as { id?: string } | undefined
    providerId = typeof result?.id === 'string' ? result.id : undefined
  } catch (error) {
    return {
      delivered: false,
      state: 'failed',
      actualTo,
      intendedTo: to,
      redirected,
      live: false,
      note: `Delivery failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (!providerId) {
    return {
      delivered: false,
      state: 'composed',
      actualTo,
      intendedTo: to,
      redirected,
      live: false,
      note:
        `Composed but NOT sent: the mail transport returned no message id, which means it went to the server log rather than to a provider. ` +
        `Intended recipient was ${to}. If a key was added recently, the server needs a restart before the transport exists.`,
    }
  }

  return {
    delivered: true,
    state: 'delivered',
    actualTo,
    intendedTo: to,
    redirected,
    live: true,
    note: redirected
      ? `Sent to the redirect address ${actualTo} instead of ${to}, because EMAIL_REDIRECT_TO is set. Provider id ${providerId}.`
      : `Emailed to ${to}${cc?.length ? ` (cc ${cc.join(', ')})` : ''}. Provider id ${providerId}.`,
  }
}
