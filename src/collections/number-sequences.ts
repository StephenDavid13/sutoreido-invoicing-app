import type { CollectionConfig } from 'payload'

import { isAdmin, isOwnerOrAdmin } from '@/lib/access'
import { ownerField } from '@/lib/fields/owner'

/**
 * Per-owner, per-kind monotonic counters for invoice and quote numbers.
 *
 * This collection exists to make Payload create and migrate the table; the
 * actual allocation never goes through the Local API. It is a single atomic
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, run on the request's
 * transaction-bound Drizzle client — see @/lib/invoices/numbering.
 *
 * Why not the predecessor's `SELECT ... FOR UPDATE`: that had two real defects.
 * (1) On the first-ever allocation there is no row to lock, so two concurrent
 * creates both insert last_value = 1 and one dies on the primary key.
 * (2) It committed the number in its own transaction *before* inserting the
 * invoice, so any later failure burned the number and left a gap.
 *
 * The unique index below is the ON CONFLICT target.
 */
export const NumberSequences: CollectionConfig = {
  slug: 'number-sequences',
  admin: {
    useAsTitle: 'kind',
    defaultColumns: ['kind', 'lastValue'],
    group: 'System',
    description:
      'Invoice and quote counters. Seed these to continue an existing numbering series.',
  },
  access: {
    read: isOwnerOrAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  indexes: [{ fields: ['owner', 'kind'], unique: true }],
  fields: [
    ownerField,
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Invoice', value: 'invoice' },
        { label: 'Quote', value: 'quote' },
      ],
    },
    {
      name: 'lastValue',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description:
          'The last number handed out. The next allocation returns lastValue + 1.',
      },
    },
  ],
  timestamps: true,
}
