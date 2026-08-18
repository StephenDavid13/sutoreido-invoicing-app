import type { CollectionConfig } from 'payload'

import { isOwnerOrAdmin } from '@/lib/access'
import { centsField, quantityMilliField } from '@/lib/fields/money'
import { ownerField } from '@/lib/fields/owner'
import { CURRENCY_OPTIONS } from '@/lib/money/currencies'
import { recomputeServiceDerived } from '@/lib/services/hooks'
import { BILLING_PERIOD_OPTIONS, COST_PERIOD_OPTIONS } from '@/lib/services/periods'

/**
 * Recurring hosting, maintenance and retainer commitments.
 *
 * A flat monthly hosting fee, turned into something the app understands, so the
 * invoice raises itself and the renewal cannot be forgotten.
 *
 * Costs live here too, because the number that actually matters for a hosting
 * business is not what you charge, it is what you keep.
 */
export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: 'Service', plural: 'Services & renewals' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'client', 'billingPeriod', 'chargeCents', 'nextInvoiceOn', 'status'],
    group: 'Recurring',
    description:
      'Monthly hosting and maintenance. The billing run raises a draft invoice for each period that has started.',
  },
  access: {
    read: isOwnerOrAdmin,
    create: ({ req: { user } }) => Boolean(user),
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  indexes: [
    { fields: ['owner', 'status'] },
    // The billing run's hot query.
    { fields: ['status', 'nextInvoiceOn'] },
  ],
  hooks: { beforeChange: [recomputeServiceDerived] },
  fields: [
    ownerField,
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 200,
      admin: { description: 'Internal name, e.g. "Hosting — example.com".' },
    },
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'clients',
      required: true,
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'hosting',
      index: true,
      options: [
        { label: 'Hosting', value: 'hosting' },
        { label: 'Maintenance', value: 'maintenance' },
        { label: 'Domain', value: 'domain' },
        { label: 'SSL certificate', value: 'ssl' },
        { label: 'Support retainer', value: 'retainer' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'domain',
      type: 'text',
      admin: { description: 'The site this covers, if applicable. Handy for renewal reminders.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Only Active services are billed. Paused keeps the history without invoicing.',
      },
    },

    // ------------------------------------------------------------------ billing
    {
      type: 'collapsible',
      label: 'Billing',
      fields: [
        {
          name: 'currency',
          type: 'select',
          required: true,
          defaultValue: 'AUD',
          index: true,
          options: CURRENCY_OPTIONS,
        },
        centsField({
          name: 'chargeCents',
          label: 'Charge per period',
          required: true,
          min: 1,
          description: 'What the client pays each period.',
        }),
        {
          name: 'billingPeriod',
          type: 'select',
          required: true,
          defaultValue: 'monthly',
          options: BILLING_PERIOD_OPTIONS,
        },
        {
          name: 'startDate',
          type: 'date',
          required: true,
          admin: {
            description:
              'The billing anchor. Every future date is measured from here, so a service starting on the 31st keeps billing on the 31st instead of drifting back after February.',
          },
        },
        {
          name: 'endDate',
          type: 'date',
          admin: { description: 'Optional. Billing stops once a period would start after this.' },
        },
        {
          name: 'periodsBilled',
          type: 'number',
          required: true,
          defaultValue: 0,
          min: 0,
          admin: {
            readOnly: true,
            description: 'How many periods have been invoiced. Advanced by the billing run.',
          },
        },
        {
          name: 'nextInvoiceOn',
          type: 'date',
          index: true,
          admin: {
            readOnly: true,
            description: 'Derived from the start date and periods billed. Never edited directly.',
          },
        },
        {
          name: 'autoGenerate',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Include this service in the billing run.' },
        },
        {
          name: 'autoSend',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Off by default, deliberately. Generated invoices land as drafts so you see them before a client does.',
          },
        },
      ],
    },

    // -------------------------------------------------- how it prints on the invoice
    {
      type: 'collapsible',
      label: 'Invoice line',
      admin: { description: 'How this service appears on the generated invoice.' },
      fields: [
        {
          name: 'lineDescription',
          type: 'text',
          maxLength: 500,
          admin: {
            description: 'Defaults to the service name.',
          },
        },
        quantityMilliField({
          name: 'quantityMilli',
          label: 'Quantity',
          description: 'Usually 1 for a flat monthly fee.',
        }),
        {
          name: 'qtyLabel',
          type: 'select',
          defaultValue: 'Qty',
          options: [
            { label: 'Qty', value: 'Qty' },
            { label: 'Hours', value: 'Hours' },
            { label: 'Days', value: 'Days' },
            { label: 'Units', value: 'Units' },
          ],
        },
        {
          name: 'paymentTermsDays',
          type: 'number',
          min: 0,
          max: 365,
          admin: { description: 'Overrides the client default for invoices from this service.' },
        },
        { name: 'bankAccount', type: 'relationship', relationTo: 'bank-accounts' },
      ],
    },

    // -------------------------------------------------------------------- costs
    {
      name: 'costs',
      type: 'array',
      label: 'Costs you carry',
      labels: { singular: 'Cost', plural: 'Costs' },
      admin: {
        description:
          'What this service costs you — hosting plan, registrar, CDN. Drives the margin figures below, and `Renews on` drives renewal reminders.',
      },
      fields: [
        { name: 'vendor', type: 'text', required: true, admin: { description: 'e.g. Vercel, Cloudflare.' } },
        { name: 'description', type: 'text' },
        centsField({ name: 'amountCents', label: 'Amount', required: true }),
        {
          name: 'currency',
          type: 'select',
          required: true,
          defaultValue: 'AUD',
          options: CURRENCY_OPTIONS,
          admin: {
            description:
              'If this differs from the service currency it is excluded from margin rather than converted at a guessed rate.',
          },
        },
        {
          name: 'period',
          type: 'select',
          required: true,
          defaultValue: 'monthly',
          options: COST_PERIOD_OPTIONS,
        },
        {
          name: 'renewsOn',
          type: 'date',
          index: true,
          admin: {
            description:
              'When this expires. A lapsed domain takes the client’s site down, so this is the field that earns its keep.',
          },
        },
        {
          name: 'notifyDaysBefore',
          type: 'number',
          defaultValue: 30,
          min: 0,
          max: 365,
          admin: { description: 'How far ahead to warn you. 0 disables the reminder.' },
        },
      ],
    },

    // --------------------------------------------------------- derived margin
    {
      type: 'collapsible',
      label: 'Margin (derived)',
      admin: {
        description:
          'Recalculated on every save. Monthly equivalents are for comparison only — invoices always use the charge above.',
      },
      fields: [
        centsField({ name: 'monthlyChargeCents', label: 'Monthly charge', readOnly: true }),
        centsField({ name: 'monthlyCostCents', label: 'Monthly cost', readOnly: true }),
        centsField({
          name: 'monthlyMarginCents',
          label: 'Monthly margin',
          readOnly: true,
          min: -100_000_000,
        }),
        {
          name: 'costCurrencyMismatch',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
            description:
              'Set when a cost is in another currency. Those costs are left out of margin instead of being converted at a rate nobody recorded.',
          },
        },
      ],
    },
    { name: 'notes', type: 'textarea', maxLength: 2000 },
  ],
  timestamps: true,
}
