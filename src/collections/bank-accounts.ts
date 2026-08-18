import type { CollectionConfig } from 'payload'

import { isOwnerOrAdmin } from '@/lib/access'
import { CURRENCY_OPTIONS } from '@/lib/money/currencies'
import { ownerField } from '@/lib/fields/owner'

/**
 * A single free-text bank-account string cannot represent what real invoices do:
 * an Australian account needs a BSB and an account number on separate lines,
 * while a New Zealand account is one 16-digit string — and which one applies
 * depends on the invoice currency.
 *
 * So this is a collection, with one default per currency, and each invoice
 * records which account it was issued against.
 */
export const BankAccounts: CollectionConfig = {
  slug: 'bank-accounts',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'currency', 'accountNumber', 'isDefault'],
    group: 'Settings',
  },
  access: {
    read: isOwnerOrAdmin,
    create: ({ req: { user } }) => Boolean(user),
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  fields: [
    ownerField,
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: { description: 'Internal name, e.g. "Everyday (AUD)" or "ASB (NZD)".' },
    },
    {
      name: 'currency',
      type: 'select',
      required: true,
      index: true,
      options: CURRENCY_OPTIONS,
      admin: { description: 'Invoices in this currency default to this account.' },
    },
    { name: 'accountName', type: 'text' },
    { name: 'bankName', type: 'text' },
    {
      name: 'bsb',
      type: 'text',
      label: 'BSB',
      admin: {
        description: 'Australian accounts only. Six digits, e.g. 123456.',
        condition: (_data, siblingData) => siblingData?.currency === 'AUD',
      },
    },
    {
      name: 'accountNumber',
      type: 'text',
      required: true,
      admin: {
        description:
          'AU: the account number alone. NZ: the full grouped form, e.g. 00-0000-0000000-00.',
      },
    },
    {
      name: 'swift',
      type: 'text',
      label: 'SWIFT / BIC',
      admin: { description: 'Only needed for international transfers.' },
    },
    { name: 'iban', type: 'text', label: 'IBAN' },
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'The account preselected for new invoices in this currency.',
      },
    },
    {
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Hidden from new invoices. Existing invoices keep their frozen snapshot, so archiving never rewrites a sent document.',
      },
    },
  ],
  timestamps: true,
}
