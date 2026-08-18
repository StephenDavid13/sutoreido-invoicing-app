import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'

import { InvoiceDocument } from './documents/invoice-document'
import type { InvoicePdfModel } from './model'

/**
 * The actual render. Deliberately carries NO `server-only` guard so CLI tooling
 * (scripts/render-pdf.ts) can drive it outside Next's bundler — `server-only`
 * throws there, and forcing the `react-server` condition to silence it breaks
 * @react-pdf/reconciler's React internals.
 *
 * Application code must import ./render instead, which adds the guard.
 */
export async function renderInvoicePdf(model: InvoicePdfModel): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument model={model} />)
}
