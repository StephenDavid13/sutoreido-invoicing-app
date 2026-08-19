'use client'

import { Button, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import React, { useState } from 'react'

type Outcome = {
  ok: boolean
  message: string
  redirected?: boolean
}

/**
 * "Send to client" for the invoice edit view.
 *
 * Sending is a deliberate action, not a side effect of changing the status field:
 * status is editable by hand in this panel, so tying delivery to it would let a
 * mis-click put a document in front of a client with no undo.
 *
 * The button reports exactly what happened rather than a generic success. If no
 * email transport is configured, or the delivery guard redirected the message, it
 * says so — a green tick that means "written to a log" would be a lie.
 */
export function InvoiceSendButton() {
  const { id, savedDocumentData } = useDocumentInfo()
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const status = (savedDocumentData as { status?: string } | undefined)?.status
  const alreadySent = status && status !== 'draft'
  const cancelled = status === 'cancelled'

  const run = async () => {
    setBusy(true)
    setOutcome(null)
    try {
      const res = await fetch(`/api/invoices/${id}/send${alreadySent ? '?resend=1' : ''}`, {
        method: 'POST',
      })
      const body = (await res.json()) as { error?: string; note?: string; redirected?: boolean }
      if (!res.ok) {
        setOutcome({ ok: false, message: body.error ?? 'Send failed.' })
      } else {
        setOutcome({ ok: true, message: body.note ?? 'Sent.', redirected: body.redirected })
      }
    } catch (error) {
      setOutcome({ ok: false, message: error instanceof Error ? error.message : 'Send failed.' })
    } finally {
      setBusy(false)
    }
  }

  if (!id) {
    return (
      <div className="field-type">
        <Button buttonStyle="primary" size="small" disabled margin={false}>
          Send to client
        </Button>
        <div className="field-description">Save the invoice first.</div>
      </div>
    )
  }

  if (cancelled) {
    return (
      <div className="field-type">
        <Button buttonStyle="secondary" size="small" disabled margin={false}>
          Send to client
        </Button>
        <div className="field-description">This invoice was cancelled.</div>
      </div>
    )
  }

  return (
    <div className="field-type">
      <Button
        buttonStyle={alreadySent ? 'secondary' : 'primary'}
        size="small"
        margin={false}
        disabled={busy}
        onClick={run}
      >
        {busy ? 'Sending…' : alreadySent ? 'Re-send to client' : 'Send to client'}
      </Button>
      <div className="field-description">
        {outcome ? (
          <span style={{ color: outcome.ok ? undefined : 'var(--theme-error-500)' }}>
            {outcome.message}
          </span>
        ) : modified ? (
          'You have unsaved changes. Save first — this sends the saved version.'
        ) : alreadySent ? (
          'Re-sends the archived PDF. The document itself never changes.'
        ) : (
          'Issues the invoice, archives the PDF, and emails it with the PDF attached.'
        )}
      </div>
    </div>
  )
}
