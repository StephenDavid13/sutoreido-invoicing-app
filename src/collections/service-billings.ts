import type { CollectionConfig } from 'payload'

import { isAdmin, isOwnerOrAdmin } from '@/lib/access'
import { centsField } from '@/lib/fields/money'
import { ownerField } from '@/lib/fields/owner'

/**
 * One row per service, per billed period. This is what makes the billing run
 * safe to re-run.
 *
 * The unique index on (service, periodStart) is the guarantee: a second run on
 * the same day, a double-fired cron, or a manual run after an automatic one
 * cannot produce a duplicate invoice, because the insert simply fails. Vercel
 * cron is documented as best-effort and able to fire twice, so this is not
 * theoretical.
 *
 * It doubles as the audit trail for "when did I bill this, and on which invoice".
 */
export const ServiceBillings: CollectionConfig = {
  slug: 'service-billings',
  labels: { singular: 'Service billing', plural: 'Service billings' },
  admin: {
    useAsTitle: 'periodLabel',
    defaultColumns: ['service', 'periodLabel', 'invoice', 'chargeCents'],
    group: 'Recurring',
    description: 'Append-only record of which service periods have been invoiced.',
  },
  access: {
    read: isOwnerOrAdmin,
    create: () => false, // written by the billing run only
    update: () => false,
    delete: isAdmin,
  },
  indexes: [{ fields: ['service', 'periodStart'], unique: true }],
  fields: [
    ownerField,
    { name: 'service', type: 'relationship', relationTo: 'services', required: true, index: true },
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', index: true },
    { name: 'periodStart', type: 'date', required: true, index: true },
    { name: 'periodEnd', type: 'date', required: true },
    {
      name: 'periodLabel',
      type: 'text',
      admin: { readOnly: true, description: 'Human-readable period, for the list view.' },
    },
    centsField({ name: 'chargeCents', label: 'Charged', readOnly: true }),
  ],
  timestamps: true,
}
