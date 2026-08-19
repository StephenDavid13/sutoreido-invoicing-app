import type { CollectionConfig } from 'payload'

import { isAdmin, isOwnerOrAdmin } from '@/lib/access'
import { ownerField } from '@/lib/fields/owner'

/**
 * The in-app inbox: what the app needs to tell the operator.
 *
 * Both directions of the original brief land here. Outbound chasing appears as a
 * prepared reminder waiting to be sent; inbound prompting appears as work that is
 * ready to bill or a renewal about to lapse.
 *
 * `dedupeKey` is unique so a daily sweep restates nothing: the same fact produces
 * the same key and the insert is refused rather than stacking duplicates.
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'readAt', 'createdAt'],
    group: 'Chasing',
  },
  access: {
    read: isOwnerOrAdmin,
    create: () => false,
    update: isOwnerOrAdmin,
    delete: isAdmin,
  },
  indexes: [
    { fields: ['dedupeKey'], unique: true },
    { fields: ['owner', 'readAt'] },
  ],
  fields: [
    ownerField,
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Reminder ready to send', value: 'reminder_prepared' },
        { label: 'Invoice went overdue', value: 'invoice_overdue' },
        { label: 'Ready to bill', value: 'ready_to_bill' },
        { label: 'Renewal due', value: 'renewal_due' },
        { label: 'Client opened an invoice', value: 'invoice_viewed' },
        { label: 'Delivery failed', value: 'delivery_failed' },
      ],
    },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    {
      name: 'actionUrl',
      type: 'text',
      admin: { description: 'Where acting on this takes you.' },
    },
    {
      name: 'dedupeKey',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'Unique. The same fact produces the same key, so a repeat sweep adds nothing.',
      },
    },
    { name: 'readAt', type: 'date', admin: { position: 'sidebar' } },
  ],
  timestamps: true,
}
