import type { CollectionConfig } from 'payload'

import { isOwnerOrAdmin } from '@/lib/access'
import { centsField, quantityMilliField } from '@/lib/fields/money'
import { ownerField } from '@/lib/fields/owner'
import {
  allocateNumberOnSend,
  deriveDueDate,
  enforceInvoiceStateMachine,
  guardSendableInvoice,
  logInvoiceTransition,
  maintainDisplayNumber,
  recalculateTotals,
} from '@/lib/invoices/hooks'
import { INVOICE_STATUS_OPTIONS } from '@/lib/invoices/state-machine'
import { CURRENCY_OPTIONS } from '@/lib/money/currencies'

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  admin: {
    useAsTitle: 'displayNumber',
    defaultColumns: ['displayNumber', 'client', 'status', 'issuedDate', 'totalCents'],
    group: 'Invoicing',
  },
  access: {
    read: isOwnerOrAdmin,
    create: ({ req: { user } }) => Boolean(user),
    update: isOwnerOrAdmin,
    // The public portal does NOT go through here. It is a hand-written route
    // that projects an explicit DTO — see the plan, decision D5. A public
    // access rule would expose arbitrary `where` filtering over every invoice.
    delete: isOwnerOrAdmin,
  },
  indexes: [
    { fields: ['owner', 'invoiceNumber'], unique: true },
    { fields: ['owner', 'status'] },
    { fields: ['status', 'dueDate'] },
  ],
  hooks: {
    // Order matters: validate the transition before deriving anything from it,
    // then derive dates, then totals, then the printed number.
    beforeChange: [
      enforceInvoiceStateMachine,
      allocateNumberOnSend,
      deriveDueDate,
      recalculateTotals,
      maintainDisplayNumber,
      // Last: totals must be final before we judge whether this is sendable.
      guardSendableInvoice,
    ],
    afterChange: [logInvoiceTransition],
  },
  fields: [
    ownerField,

    // A sidebar button linking to /api/invoices/[id]/pdf. A `ui` field renders
    // a component without adding a column to the table.
    {
      name: 'pdfLink',
      type: 'ui',
      label: 'PDF',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/admin/invoice-pdf-button#InvoicePdfButton' },
      },
    },

    // ---------------------------------------------------------------- identity
    {
      name: 'invoiceNumber',
      type: 'number',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Allocated atomically on the first transition to Sent, so drafts never burn a number and the ATO-visible sequence has no gaps.',
      },
    },
    {
      name: 'displayNumber',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description:
          'The printed form, e.g. "#6" or "INV-006", built from the numbering settings. Stored rather than virtual so it is searchable and sortable — Payload virtual fields are neither in Postgres.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: INVOICE_STATUS_OPTIONS,
      admin: { position: 'sidebar' },
    },
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'clients',
      required: true,
      index: true,
    },
    {
      name: 'title',
      type: 'text',
      maxLength: 300,
      admin: { description: 'Optional subject line, e.g. "Hosting — August 2026".' },
    },
    {
      name: 'reference',
      type: 'text',
      maxLength: 100,
      admin: { description: "The client's PO or job reference, if they use one." },
    },

    // ------------------------------------------------------------------- dates
    { name: 'issuedDate', type: 'date', required: true, index: true },
    {
      name: 'dueMode',
      type: 'select',
      required: true,
      defaultValue: 'on_receipt',
      options: [
        { label: 'On receipt', value: 'on_receipt' },
        { label: 'Net days', value: 'net_days' },
        { label: 'Fixed date', value: 'fixed_date' },
      ],
      admin: {
        description: 'What the "Due:" line prints.',
      },
    },
    {
      name: 'paymentTermsDays',
      type: 'number',
      min: 0,
      max: 365,
      defaultValue: 14,
      admin: { description: 'Drives the terms text and the reminder schedule.' },
    },
    {
      name: 'dueDate',
      type: 'date',
      index: true,
      admin: {
        readOnly: true,
        description: 'Derived from the issue date and the due mode. Reminders key off this.',
      },
    },

    // ------------------------------------------------------------------- money
    {
      name: 'currency',
      type: 'select',
      required: true,
      defaultValue: 'AUD',
      index: true,
      options: CURRENCY_OPTIONS,
    },
    {
      name: 'qtyLabel',
      type: 'select',
      required: true,
      defaultValue: 'Qty',
      options: [
        { label: 'Qty', value: 'Qty' },
        { label: 'Hours', value: 'Hours' },
        { label: 'Days', value: 'Days' },
        { label: 'Units', value: 'Units' },
      ],
      admin: { description: 'Column header for the quantity column on the PDF.' },
    },
    {
      name: 'lineItems',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Line item', plural: 'Line items' },
      admin: {
        description: 'Editable only while the invoice is a draft.',
        initCollapsed: false,
      },
      fields: [
        { name: 'description', type: 'text', required: true, maxLength: 500 },
        quantityMilliField({ name: 'quantityMilli', label: 'Quantity', required: true }),
        {
          name: 'unit',
          type: 'text',
          maxLength: 20,
          admin: { description: 'Optional, e.g. "hours", "days", "each".' },
        },
        centsField({ name: 'unitPriceCents', label: 'Unit price', required: true }),
        centsField({
          name: 'lineTotalCents',
          label: 'Line total',
          readOnly: true,
          description: 'Rounded once, here. The subtotal is the plain sum of these.',
        }),
      ],
    },
    centsField({
      name: 'discountCents',
      label: 'Discount',
      description: 'Applied before tax.',
    }),
    {
      name: 'taxRateBasisPoints',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      max: 10_000,
      admin: {
        description:
          'Basis points: 1000 = 10% (AU GST), 1500 = 15% (NZ GST). Stays 0 while not GST-registered.',
      },
    },
    {
      name: 'taxLabel',
      type: 'text',
      defaultValue: 'GST',
      admin: { description: 'Only printed when the rate is above zero.' },
    },
    {
      name: 'gstRegisteredAtIssue',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description:
          'Frozen copy of the GST registration flag at issue time, so a future registration never retroactively relabels an old invoice as a TAX INVOICE.',
      },
    },

    // Totals — all hook-authoritative.
    centsField({ name: 'subtotalCents', label: 'Subtotal', readOnly: true }),
    centsField({ name: 'taxCents', label: 'Tax', readOnly: true }),
    centsField({ name: 'totalCents', label: 'Total', readOnly: true }),
    centsField({ name: 'amountPaidCents', label: 'Amount paid', readOnly: true }),
    centsField({ name: 'balanceCents', label: 'Balance', readOnly: true }),

    // --------------------------------------------------------------- narrative
    {
      name: 'notes',
      type: 'textarea',
      maxLength: 2000,
      admin: { description: 'Printed under the totals, above the terms.' },
    },
    {
      name: 'terms',
      type: 'textarea',
      maxLength: 4000,
      admin: {
        description:
          'Seeded from the default template in Invoice defaults, then editable per invoice.',
      },
    },
    {
      name: 'bankAccount',
      type: 'relationship',
      relationTo: 'bank-accounts',
      admin: { description: 'Defaults to the default account for this invoice currency.' },
    },

    // -------------------------------------------------------- frozen snapshots
    {
      name: 'billToSnapshot',
      type: 'json',
      admin: {
        readOnly: true,
        description:
          'Frozen when the invoice is sent. Renaming a client in 2027 must not rewrite a 2026 document.',
      },
    },
    {
      name: 'payableToSnapshot',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Frozen business details, including the bank account actually quoted.',
      },
    },
    {
      name: 'archivedPdf',
      type: 'upload',
      relationTo: 'media',
      admin: {
        readOnly: true,
        description: 'The exact PDF the client received. Immutable once sent.',
      },
    },

    // ------------------------------------------------------------ portal/audit
    {
      name: 'shareToken',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Opaque, revocable. Grants read of this one invoice via /i/[token].',
      },
    },
    { name: 'sentAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'viewedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'paidAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'sourceQuote',
      type: 'relationship',
      relationTo: 'quotes',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
  timestamps: true,
}
