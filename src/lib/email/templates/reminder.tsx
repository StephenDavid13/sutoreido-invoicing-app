import { Link, Section, Text } from '@react-email/components'
import React from 'react'

import { EmailShell, figureRow, heading, inkSoft, paragraph } from './shell'

export type ReminderEmailModel = {
  reference: string
  clientName: string
  businessName: string
  dueLabel: string
  balance: string
  documentUrl: string | null
  paymentLine: string | null
  /** Negative = before due, 0 = due today, positive = days overdue. */
  offsetDays: number
}

function openingLine(offsetDays: number, dueLabel: string): string {
  if (offsetDays < 0) {
    const days = Math.abs(offsetDays)
    return `A quick note that this one falls due ${days === 1 ? 'tomorrow' : `in ${days} days`}, on ${dueLabel}.`
  }
  if (offsetDays === 0) return `This one falls due today.`
  if (offsetDays <= 7) {
    return `This one became due on ${dueLabel} and is now ${offsetDays} ${offsetDays === 1 ? 'day' : 'days'} past due.`
  }
  return `This one has been outstanding since ${dueLabel}, now ${offsetDays} days.`
}

function closingLine(offsetDays: number): string {
  if (offsetDays <= 0) return 'No action needed if it is already scheduled to go out.'
  if (offsetDays <= 14) return 'If it has already been paid, please ignore this and accept my apologies.'
  return 'Could you let me know when I can expect it, or tell me if something needs sorting out first?'
}

/**
 * A reminder, written to be sendable as-is.
 *
 * The tone shifts with the offset rather than the same nag repeating: a courtesy
 * note before the due date, a factual statement after it, and a direct ask once it
 * is genuinely late. It never threatens and it never guesses at a reason.
 */
export function ReminderEmail({ reminder }: { reminder: ReminderEmailModel }) {
  return (
    <EmailShell
      preview={`Invoice #${reminder.reference} — ${reminder.balance} outstanding`}
      footer={null}
    >
      <Text style={heading}>Invoice #{reminder.reference}</Text>

      <Text style={paragraph}>Hello {reminder.clientName},</Text>
      <Text style={paragraph}>{openingLine(reminder.offsetDays, reminder.dueLabel)}</Text>

      <Section style={{ margin: '20px 0' }}>
        <Text style={figureRow}>
          <span style={{ color: inkSoft }}>Due</span>&nbsp;&nbsp;{reminder.dueLabel}
        </Text>
        <Text style={figureRow}>
          <span style={{ color: inkSoft }}>Outstanding</span>&nbsp;&nbsp;
          <strong>{reminder.balance}</strong>
        </Text>
      </Section>

      {reminder.paymentLine ? <Text style={paragraph}>{reminder.paymentLine}</Text> : null}

      {reminder.documentUrl ? (
        <Text style={paragraph}>
          The invoice is{' '}
          <Link href={reminder.documentUrl} style={{ color: '#1d4b7e' }}>
            here
          </Link>{' '}
          if you need it again.
        </Text>
      ) : null}

      <Text style={paragraph}>{closingLine(reminder.offsetDays)}</Text>
      <Text style={paragraph}>{reminder.businessName}</Text>
    </EmailShell>
  )
}
