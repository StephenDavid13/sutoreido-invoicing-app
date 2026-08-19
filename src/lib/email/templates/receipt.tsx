import { Section, Text } from '@react-email/components'
import React from 'react'

import { EmailShell, figureRow, heading, inkSoft, paragraph } from './shell'

export type ReceiptEmailModel = {
  reference: string
  clientName: string
  businessName: string
  amount: string
  receivedOn: string
  remaining: string | null
}

/** Sent when a payment settles an invoice, or acknowledges a part payment. */
export function ReceiptEmail({ receipt }: { receipt: ReceiptEmailModel }) {
  const settled = !receipt.remaining
  return (
    <EmailShell
      preview={`Payment received for invoice #${receipt.reference} — thank you`}
      footer={null}
    >
      <Text style={heading}>Payment received</Text>
      <Text style={paragraph}>Hello {receipt.clientName},</Text>
      <Text style={paragraph}>
        {settled
          ? `Thank you — invoice #${receipt.reference} is now settled in full.`
          : `Thank you — I have recorded a payment against invoice #${receipt.reference}.`}
      </Text>

      <Section style={{ margin: '20px 0' }}>
        <Text style={figureRow}>
          <span style={{ color: inkSoft }}>Received</span>&nbsp;&nbsp;{receipt.receivedOn}
        </Text>
        <Text style={figureRow}>
          <span style={{ color: inkSoft }}>Amount</span>&nbsp;&nbsp;<strong>{receipt.amount}</strong>
        </Text>
        {receipt.remaining ? (
          <Text style={figureRow}>
            <span style={{ color: inkSoft }}>Still outstanding</span>&nbsp;&nbsp;
            <strong>{receipt.remaining}</strong>
          </Text>
        ) : null}
      </Section>

      <Text style={paragraph}>{receipt.businessName}</Text>
    </EmailShell>
  )
}
