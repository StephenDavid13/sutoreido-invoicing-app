/**
 * Ported verbatim from the predecessor's
 * Sutoredo.Domain/StateMachines/{Invoice,Quote}StateMachine.cs.
 *
 * Payload has no state-machine primitive, so this table is enforced by a
 * beforeChange hook on the collection, which also writes the activity-log row
 * inside the same transaction as the status change.
 *
 * Note what is deliberately absent: no Overdue -> Sent (you cannot un-overdue),
 * no Sent -> Draft (you cannot un-send), and no self-transitions.
 */

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
}

export const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['accepted', 'rejected', 'expired', 'cancelled'],
  accepted: [],
  rejected: [],
  expired: [],
  cancelled: [],
}

/** Terminal states accept no further transitions. */
export const isTerminalInvoiceStatus = (status: InvoiceStatus): boolean =>
  INVOICE_TRANSITIONS[status].length === 0

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly entity: string,
    public readonly from: string,
    public readonly to: string,
    public readonly allowed: readonly string[],
  ) {
    super(
      `${entity} cannot transition from ${from} to ${to}. Allowed: [${allowed.join(', ')}].`,
    )
    this.name = 'InvalidStateTransitionError'
  }
}

function assertTransition<S extends string>(
  entity: string,
  table: Record<S, readonly S[]>,
  from: S,
  to: S,
): void {
  const allowed = table[from] ?? []
  if (!allowed.includes(to)) {
    throw new InvalidStateTransitionError(entity, from, to, allowed)
  }
}

/**
 * @param isAdminOverride Skips validation entirely, exactly as the predecessor
 *   did — but the caller must supply a reason, and the override is recorded on
 *   the activity-log row so the audit trail shows it was forced.
 */
export function assertInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
  isAdminOverride = false,
): void {
  if (isAdminOverride) return
  assertTransition('Invoice', INVOICE_TRANSITIONS, from, to)
}

export function assertQuoteTransition(
  from: QuoteStatus,
  to: QuoteStatus,
  isAdminOverride = false,
): void {
  if (isAdminOverride) return
  assertTransition('Quote', QUOTE_TRANSITIONS, from, to)
}

export const INVOICE_STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Cancelled', value: 'cancelled' },
]

export const QUOTE_STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Expired', value: 'expired' },
  { label: 'Cancelled', value: 'cancelled' },
]
