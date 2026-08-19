import type { CollectionConfig } from 'payload'

import { isOwnerOrAdmin } from '@/lib/access'
import { ownerField } from '@/lib/fields/owner'

/**
 * When to prepare a reminder, relative to an invoice's due date.
 *
 * A rule PREPARES an email; it never sends one. The sweep composes the message and
 * parks it, and a person presses send. That is the operator's explicit choice, and
 * it is why there is no "auto send" switch here to be left on by accident.
 *
 * One rule set applies to every client unless a client-specific rule exists, in
 * which case the specific one wins outright rather than merging.
 */
export const ReminderRules: CollectionConfig = {
  slug: 'reminder-rules',
  labels: { singular: 'Reminder rule', plural: 'Reminder rules' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'client', 'offsetsDays', 'enabled'],
    group: 'Chasing',
    description:
      'Offsets in days from the due date: negative is before, 0 is the day itself, positive is overdue. Each offset prepares at most one reminder per invoice.',
  },
  access: {
    read: isOwnerOrAdmin,
    create: ({ req: { user } }) => Boolean(user),
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  indexes: [{ fields: ['owner', 'client'] }],
  fields: [
    ownerField,
    {
      name: 'label',
      type: 'text',
      required: true,
      defaultValue: 'Default',
      admin: { description: 'For your own reference.' },
    },
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'clients',
      index: true,
      admin: {
        description:
          'Leave empty for the fallback that covers every client. A client-specific rule replaces the fallback entirely rather than adding to it.',
      },
    },
    {
      name: 'offsetsDays',
      type: 'text',
      required: true,
      defaultValue: '-3,0,7,21',
      admin: {
        description:
          'Comma separated. The default is a courtesy note three days out, one on the due date, a follow-up a week late and a firmer one at three weeks. Terms of 7 days make anything earlier than -3 land on the issue date.',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'stopWhenPartPaid',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Stop preparing reminders once any payment has been received, even if a balance remains. Useful for clients who pay in instalments by arrangement.',
      },
    },
  ],
  timestamps: true,
}
