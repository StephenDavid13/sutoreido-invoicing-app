import type { CollectionConfig } from 'payload'

import { isOwnerOrAdmin } from '@/lib/access'
import { centsField } from '@/lib/fields/money'
import { ownerField } from '@/lib/fields/owner'

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
    hidden: true, // Phase 2.
  },
  access: {
    read: isOwnerOrAdmin,
    create: ({ req: { user } }) => Boolean(user),
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  indexes: [{ fields: ['invoice', 'receivedOn'] }],
  fields: [
    ownerField,
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', required: true, index: true },
    centsField({ name: 'amountCents', label: 'Amount', required: true, min: 1 }),
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
