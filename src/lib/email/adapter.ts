import { resendAdapter } from '@payloadcms/email-resend'

/**
 * Email transport.
 *
 * Configured only when RESEND_API_KEY is present. With no adapter, Payload writes
 * every message to the console instead of sending it, which is exactly what this
 * project wants until a domain is verified: the whole send path can be exercised
 * end to end with zero risk of a real client receiving a test.
 *
 * Resend requires a verified domain before it will send at all, and recommends a
 * subdomain (invoices.example.com) so invoice deliverability is isolated from the
 * rest of your mail. Add DMARC yourself; it is not configured for you and it
 * materially affects whether an invoice lands in an inbox.
 */
export function buildEmailAdapter() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return undefined

  const fromAddress = process.env.EMAIL_FROM?.trim()
  const fromName = process.env.EMAIL_FROM_NAME?.trim()

  if (!fromAddress) {
    // A missing from-address must not break type generation or a build. Fall back
    // to the console transport and say so loudly instead.
    console.warn(
      '[email] RESEND_API_KEY is set but EMAIL_FROM is not, so mail is being written to the console rather than sent. Set EMAIL_FROM to an address on your verified Resend domain, e.g. invoices@invoices.stephendavid.dev.',
    )
    return undefined
  }

  return resendAdapter({
    apiKey,
    defaultFromAddress: fromAddress,
    defaultFromName: fromName || 'Invoices',
  })
}

/**
 * True only when mail actually leaves the machine. Both a key AND a from-address
 * are required, so this never claims live delivery on a half-configured setup.
 */
export const emailIsLive = (): boolean =>
  Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim())
