import type { CollectionConfig } from 'payload'

import { isOwnerOrAdmin } from '@/lib/access'
import { centsField } from '@/lib/fields/money'
import { ownerField } from '@/lib/fields/owner'
import { CURRENCY_OPTIONS } from '@/lib/money/currencies'
import { rollupAfterChange, rollupAfterDelete, validatePayment } from '@/lib/payments/hooks'

/**
 * Phase 2. A collection rather than an array on the invoice, because payments
 * genuinely arrive independently of an invoice edit (bank transfer, later
 * Stripe webhooks) — the test the plan applies for array-vs-collection.
 *
 * Part payments are why the invoice carries amountPaid and balance rather than
 * a bare paid/unpaid flag.
 */
export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['invoice', 'amountCents', 'receivedOn', 'method'],
    group: 'Invoicing',
    description:
      'Recording a payment is what moves an invoice to Paid. Part payments are supported: the invoice keeps a balance until they cover the total.',
  },
  access: {
    read: isOwnerOrAdmin,
    create: ({ req: { user } }) => Boolean(user),
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  indexes: [{ fields: ['invoice', 'receivedOn'] }],
  hooks: {
    beforeChange: [validatePayment],
    afterChange: [rollupAfterChange],
    afterDelete: [rollupAfterDelete],
  },
  fields: [
    ownerField,
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', required: true, index: true },
    centsField({
      name: 'amountCents',
      label: 'Amount',
      required: true,
      min: 1,
      description: 'Part payments are fine. The invoice keeps a balance until covered.',
    }),
    {
      name: 'currency',
      type: 'select',
      options: CURRENCY_OPTIONS,
      admin: {
        readOnly: true,
        description: "Inherited from the invoice; a payment is never in another currency.",
      },
    },
    { name: 'receivedOn', type: 'date', required: true, index: true },
    {
      name: 'method',
      type: 'select',
      required: true,
      defaultValue: 'bank_transfer',
      options: [
        { label: 'Bank transfer', value: 'bank_transfer' },
        { label: 'Card', value: 'card' },
        { label: 'Cash', value: 'cash' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'reference', type: 'text', admin: { description: 'Bank reference or receipt number.' } },
    { name: 'notes', type: 'textarea' },
  ],
  timestamps: true,
}
