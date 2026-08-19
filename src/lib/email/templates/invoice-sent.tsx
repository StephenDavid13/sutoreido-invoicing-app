import { Link, Section, Text } from '@react-email/components'
import React from 'react'

import { EmailShell, figureRow, heading, inkSoft, paragraph } from './shell'

export type InvoiceEmailModel = {
  documentTitle: string
  reference: string
  clientName: string
  businessName: string
  issued: string
  dueLabel: string
  total: string
  documentUrl: string | null
  paymentLine: string | null
  closing: string | null
}

/** The covering note that carries an invoice. The PDF rides as an attachment. */
export function InvoiceSentEmail({ invoice }: { invoice: InvoiceEmailModel }) {
  return (
    <EmailShell
      preview={`${invoice.documentTitle} #${invoice.reference} from ${invoice.businessName} — ${invoice.total}`}
      footer={invoice.closing}
    >
      <Text style={heading}>
        {invoice.documentTitle} #{invoice.reference}
      </Text>

      <Text style={paragraph}>Hello {invoice.clientName},</Text>
      <Text style={paragraph}>
        Please find {invoice.documentTitle.toLowerCase()} #{invoice.reference} attached, for{' '}
        <strong>{invoice.total}</strong>.
      </Text>

      <Section style={{ margin: '20px 0' }}>
        <Text style={figureRow}>
          <span style={{ color: inkSoft }}>Issued</span>&nbsp;&nbsp;{invoice.issued}
        </Text>
        <Text style={figureRow}>
          <span style={{ color: inkSoft }}>Due</span>&nbsp;&nbsp;{invoice.dueLabel}
        </Text>
        <Text style={figureRow}>
          <span style={{ color: inkSoft }}>Amount</span>&nbsp;&nbsp;<strong>{invoice.total}</strong>
        </Text>
      </Section>

      {invoice.paymentLine ? <Text style={paragraph}>{invoice.paymentLine}</Text> : null}

      {invoice.documentUrl ? (
        <Text style={paragraph}>
          You can also{' '}
          <Link href={invoice.documentUrl} style={{ color: '#1d4b7e' }}>
            read it in your browser
          </Link>
          .
        </Text>
      ) : null}

      <Text style={paragraph}>{invoice.businessName}</Text>
    </EmailShell>
  )
}
