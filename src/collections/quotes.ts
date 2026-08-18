import type { CollectionConfig } from 'payload'

import { isOwnerOrAdmin } from '@/lib/access'
import { centsField, quantityMilliField } from '@/lib/fields/money'
import { ownerField } from '@/lib/fields/owner'
import { QUOTE_STATUS_OPTIONS } from '@/lib/invoices/state-machine'
import { CURRENCY_OPTIONS } from '@/lib/money/currencies'

/**
 * Phase 4. The schema is registered from day one so the invoice -> quote
 * relationship and the initial migration are complete (plan decision D8).
 *
 * Ported from the predecessor's Quote entity, keeping the fields its PDF
 * actually rendered: title, reference, service summary, scope bullets, terms
 * and acceptance.
 */
export const Quotes: CollectionConfig = {
  slug: 'quotes',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['quoteNumber', 'title', 'client', 'status', 'validUntil'],
    group: 'Invoicing',
    hidden: true, // Phase 4 — schema exists, UI does not.
  },
  access: {
    read: isOwnerOrAdmin,
    create: ({ req: { user } }) => Boolean(user),
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  indexes: [{ fields: ['owner', 'quoteNumber'], unique: true }],
  fields: [
    ownerField,
    { name: 'quoteNumber', type: 'number', index: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: QUOTE_STATUS_OPTIONS,
    },
    { name: 'client', type: 'relationship', relationTo: 'clients', required: true, index: true },
    { name: 'title', type: 'text', required: true, maxLength: 300 },
    { name: 'reference', type: 'text', maxLength: 100 },
    { name: 'serviceSummary', type: 'textarea', maxLength: 2000 },
    {
      name: 'scopeBullets',
      type: 'array',
      fields: [{ name: 'text', type: 'text', required: true, maxLength: 500 }],
    },
    { name: 'issuedDate', type: 'date', required: true },
    { name: 'validUntil', type: 'date', required: true },
    {
      name: 'currency',
      type: 'select',
      required: true,
      defaultValue: 'AUD',
      options: CURRENCY_OPTIONS,
    },
    {
      name: 'lineItems',
      type: 'array',
      fields: [
        { name: 'description', type: 'text', required: true, maxLength: 500 },
        quantityMilliField({ name: 'quantityMilli', label: 'Quantity', required: true }),
        centsField({ name: 'unitPriceCents', label: 'Unit price', required: true }),
        centsField({ name: 'lineTotalCents', label: 'Line total', readOnly: true }),
      ],
    },
    { name: 'taxRateBasisPoints', type: 'number', required: true, defaultValue: 0, min: 0, max: 10_000 },
    centsField({ name: 'subtotalCents', label: 'Subtotal', readOnly: true }),
    centsField({ name: 'taxCents', label: 'Tax', readOnly: true }),
    centsField({ name: 'totalCents', label: 'Total', readOnly: true }),
    { name: 'terms', type: 'textarea', maxLength: 4000 },
    {
      name: 'acceptedByName',
      type: 'text',
      admin: { readOnly: true, description: 'Typed name captured at acceptance.' },
    },
    { name: 'acceptedAt', type: 'date', admin: { readOnly: true } },
    { name: 'shareToken', type: 'text', index: true, admin: { readOnly: true } },
    {
      name: 'convertedToInvoice',
      type: 'relationship',
      relationTo: 'invoices',
      admin: {
        readOnly: true,
        description:
          'Set once, on conversion. The predecessor dropped terms, summary, scope and reference during conversion and clobbered the notes — this link exists so nothing is lost.',
      },
    },
  ],
  timestamps: true,
}
