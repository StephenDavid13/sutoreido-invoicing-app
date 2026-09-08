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
  mintShareToken,
  recalculateTotals,
  seedPaymentDefaults,
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
      // Early: later hooks and the PDF mapper both read terms and bankAccount.
      seedPaymentDefaults,
      allocateNumberOnSend,
      deriveDueDate,
      recalculateTotals,
      maintainDisplayNumber,
      mintShareToken,
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
      name: 'sendAction',
      type: 'ui',
      label: 'Deliver',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/admin/invoice-send-button#InvoiceSendButton' },
      },
    },
    {
      name: 'pdfLink',
      type: 'ui',
      label: 'PDF',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/admin/invoice-pdf-button#InvoicePdfButton' },
      },
    },
    {
      name: 'shareLink',
      type: 'ui',
      label: 'Client link',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/admin/invoice-share-link#InvoiceShareLink' },
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
        description:
          'The printed form, e.g. "#6" or "INV-006". Filled in from the numbering settings when the invoice is issued, and editable — type your own to override it, for a legacy series or a credit note. Once it holds anything other than "Draft" nothing overwrites it, so changing the numbering settings later cannot rewrite a document you have already sent.',
      },
      /**
       * Rejects a display number already used by another of this owner's
       * invoices. The integer `invoiceNumber` is the real sequence and stays
       * gapless on its own, but this is the number a client quotes back and the
       * ATO reads, and two invoices printing the same one is a genuine problem.
       *
       * Drafts are skipped: they all carry the literal "Draft" until issued.
       */
      validate: async (value: unknown, options: unknown) => {
        const { req, id, data } = options as {
          req?: { payload?: import('payload').Payload; user?: { id: unknown } }
          id?: unknown
          data?: { owner?: unknown }
        }
        const text = typeof value === 'string' ? value.trim() : ''
        if (!text || text === 'Draft' || !req?.payload) return true

        const ownerRaw = data?.owner ?? req.user?.id
        const owner =
          ownerRaw && typeof ownerRaw === 'object' && 'id' in ownerRaw
            ? (ownerRaw as { id: unknown }).id
            : ownerRaw
        if (owner === undefined || owner === null) return true

        const clash = await req.payload.find({
          collection: 'invoices',
          where: {
            and: [
              { owner: { equals: owner } },
              { displayNumber: { equals: text } },
              ...(id ? [{ id: { not_equals: id } }] : []),
            ],
          },
          limit: 1,
          depth: 0,
        })
        if (clash.docs.length > 0) {
          return `Invoice number "${text}" is already used by another invoice. Two invoices must not print the same number.`
        }
        return true
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
          'Filled in on save from the template in Invoice defaults, then editable per invoice. {{paymentTermsDays}} and {{bankDetails}} are substituted when the PDF renders.',
      },
    },
    {
      name: 'bankAccount',
      type: 'relationship',
      relationTo: 'bank-accounts',
      admin: {
        description:
          'Where the client sends the money. Filled in on save with your default account for this invoice currency; change it per invoice if you need to. An invoice cannot be sent without one.',
      },
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
    {
      name: 'emailedAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'When the client was actually emailed. Distinct from sentAt: an invoice can be issued but undelivered.',
      },
    },
    {
      name: 'deliveryState',
      type: 'select',
      defaultValue: 'not_sent',
      index: true,
      options: [
        { label: 'Not sent', value: 'not_sent' },
        // Composed and written to the server log because no email transport is
        // configured. Not a failure, and it must not be reported as one.
        { label: 'Composed, not sent', value: 'composed' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'deliveryNote', type: 'text', admin: { readOnly: true } },
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
