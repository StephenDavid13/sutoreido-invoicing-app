import type { CollectionConfig } from 'payload'

import { isAdmin, isOwnerOrAdmin } from '@/lib/access'
import { centsField } from '@/lib/fields/money'
import { ownerField } from '@/lib/fields/owner'

/**
 * A prepared reminder, and the record that it happened.
 *
 * The unique index on (invoice, kind) is the whole safety mechanism: `kind` is the
 * offset the rule fired at, so a given invoice can only ever have one reminder per
 * offset. A cron that fires twice, or a manual run after an automatic one, inserts
 * nothing the second time.
 *
 * Lifecycle: `prepared` -> `sent`, or `prepared` -> `dismissed`. Nothing is ever
 * sent by the sweep; a person moves it.
 */
export const InvoiceReminders: CollectionConfig = {
  slug: 'invoice-reminders',
  labels: { singular: 'Outbox item', plural: 'Outbox' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['invoice', 'kind', 'state', 'preparedAt', 'sentAt'],
    group: 'Chasing',
    description:
      'Composed and waiting. Nothing here has been sent to a client unless its state says so. Reminders are prepared by the daily sweep; a receipt is prepared when an invoice settles.',
  },
  access: {
    read: isOwnerOrAdmin,
    // Written by the sweep and moved by the send action, never hand-created.
    create: () => false,
    update: isOwnerOrAdmin,
    delete: isAdmin,
  },
  indexes: [
    { fields: ['invoice', 'kind'], unique: true },
    { fields: ['owner', 'state'] },
  ],
  fields: [
    ownerField,
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', required: true, index: true },
    {
      name: 'kind',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description:
          'What this item is: a reminder offset such as "-3" or "+7", or "receipt". Unique per invoice, which is what makes preparation idempotent.',
      },
    },
    {
      name: 'offsetDays',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Reminders only. A receipt has no offset.',
      },
    },
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'prepared',
      index: true,
      options: [
        { label: 'Prepared', value: 'prepared' },
        { label: 'Sent', value: 'sent' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'toAddress', type: 'text', admin: { readOnly: true } },
    { name: 'subject', type: 'text', admin: { readOnly: true } },
    {
      name: 'bodyHtml',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: 'The composed message, as it will be sent. Rendered when prepared.',
      },
    },
    centsField({
      name: 'balanceAtPrepared',
      label: 'Balance when prepared',
      readOnly: true,
      description: 'Re-checked at send time; a settled invoice cannot be chased.',
    }),
    { name: 'preparedAt', type: 'date', required: true, admin: { readOnly: true } },
    { name: 'sentAt', type: 'date', admin: { readOnly: true } },
    { name: 'note', type: 'text', admin: { readOnly: true } },
  ],
  timestamps: true,
}
