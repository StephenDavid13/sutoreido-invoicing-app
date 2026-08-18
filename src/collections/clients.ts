import type { CollectionConfig } from 'payload'

import { isOwnerOrAdmin } from '@/lib/access'
import { CURRENCY_OPTIONS } from '@/lib/money/currencies'
import { centsField } from '@/lib/fields/money'
import { ownerField } from '@/lib/fields/owner'
import { isValidAbn, normaliseAbn } from '@/lib/validation/abn'

export const Clients: CollectionConfig = {
  slug: 'clients',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'defaultCurrency', 'status'],
    group: 'Invoicing',
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
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 200,
      admin: { description: 'Exactly as it should appear in the BILL TO block.' },
    },
    {
      name: 'abn',
      type: 'text',
      label: 'ABN',
      // Printed directly under the client name in the BILL TO block. Required on
      // an Australian tax invoice once the sale is $1,000 or more.
      validate: (value: string | null | undefined) => {
        if (!value) return true
        return isValidAbn(value) || 'That is not a valid ABN (the checksum does not match).'
      },
      hooks: {
        beforeValidate: [({ value }) => (value ? normaliseAbn(value) : value)],
      },
      admin: {
        description: 'Optional. Stored digits-only, printed grouped.',
      },
    },
    {
      name: 'email',
      type: 'email',
      index: true,
      admin: { description: 'Primary billing contact. Invoices and reminders go here.' },
    },
    {
      name: 'contacts',
      type: 'array',
      label: 'Additional contacts',
      labels: { singular: 'Contact', plural: 'Contacts' },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'text' },
        { name: 'role', type: 'text', admin: { description: 'e.g. Accounts payable' } },
        {
          name: 'ccOnInvoices',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Copy this person on invoice and reminder emails.' },
        },
      ],
    },
    { name: 'phone', type: 'text' },
    {
      name: 'address',
      type: 'group',
      fields: [
        { name: 'line1', type: 'text' },
        { name: 'line2', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'postcode', type: 'text' },
        { name: 'country', type: 'text', defaultValue: 'Australia' },
      ],
    },
    {
      type: 'collapsible',
      label: 'Billing defaults',
      admin: {
        description: 'Prefilled onto new invoices for this client, and overridable per invoice.',
      },
      fields: [
        {
          name: 'defaultCurrency',
          type: 'select',
          required: true,
          defaultValue: 'AUD',
          index: true,
          options: CURRENCY_OPTIONS,
        },
        {
          name: 'defaultDueMode',
          type: 'select',
          required: true,
          defaultValue: 'on_receipt',
          options: [
            { label: 'On receipt', value: 'on_receipt' },
            { label: 'Net days', value: 'net_days' },
            { label: 'Fixed date', value: 'fixed_date' },
          ],
          admin: {
            description:
              'Invoices commonly print "Due: On Receipt" in the header while the terms text states a number of days. This field is what the header prints; paymentTermsDays is what the terms text says.',
          },
        },
        {
          name: 'defaultPaymentTermsDays',
          type: 'number',
          min: 0,
          max: 365,
          defaultValue: 14,
          admin: {
            description:
              'Per-client, because payment terms genuinely differ between clients.',
          },
        },
        {
          name: 'defaultQtyLabel',
          type: 'select',
          required: true,
          defaultValue: 'Qty',
          options: [
            { label: 'Qty', value: 'Qty' },
            { label: 'Hours', value: 'Hours' },
            { label: 'Days', value: 'Days' },
            { label: 'Units', value: 'Units' },
          ],
          admin: {
            description: 'Fixed-fee work reads "Qty"; time-based work reads "Hours".',
          },
        },
        centsField({
          name: 'defaultHourlyRateCents',
          label: 'Default hourly rate',
          description: 'Used when generating invoice lines from tracked time.',
        }),
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'notes',
      type: 'richText',
      admin: { description: 'Internal only. Never printed on an invoice.' },
    },
  ],
  timestamps: true,
}
