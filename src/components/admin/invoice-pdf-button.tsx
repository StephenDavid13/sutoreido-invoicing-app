'use client'

import { Button, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import React from 'react'

/**
 * "View PDF" button for the invoice edit view sidebar.
 *
 * Two states worth handling explicitly, because both are easy to hit and
 * confusing when unhandled:
 *
 *  - An unsaved new invoice has no id yet, so there is nothing to render. The
 *    button is disabled rather than producing a 404.
 *  - The route renders from SAVED data. With unsaved edits in the form, the PDF
 *    would silently show the previous numbers — so say so instead of letting
 *    someone trust a stale document.
 */
export function InvoicePdfButton() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()

  if (!id) {
    return (
      <div className="field-type">
        <Button buttonStyle="secondary" size="small" disabled margin={false}>
          View PDF
        </Button>
        <div className="field-description">Save the invoice first.</div>
      </div>
    )
  }

  return (
    <div className="field-type">
      <Button
        el="anchor"
        url={`/api/invoices/${id}/pdf`}
        newTab
        buttonStyle="secondary"
        size="small"
        margin={false}
      >
        View PDF
      </Button>
      <div className="field-description">
        {modified
          ? 'You have unsaved changes — the PDF shows the last saved version. Save, then reopen.'
          : 'Opens in a new tab.'}
      </div>
    </div>
  )
}
