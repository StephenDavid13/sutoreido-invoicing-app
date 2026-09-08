import type { GlobalConfig } from 'payload'

import { isAdmin, isAuthenticated } from '@/lib/access'

/**
 * Document layout and boilerplate.
 *
 * Real invoices from the same business often disagree about column ORDER — one
 * reads `Description | Price | Qty | Total`, another `Description | Hours |
 * Price | Total`.
 *
 * Rather than freeze one variant and regress the other, the items table is
 * driven by this descriptor array, so either layout is producible from config.
 */
export const InvoiceDefaults: GlobalConfig = {
  slug: 'invoice-defaults',
  label: 'Invoice defaults',
  admin: { group: 'Settings' },
  access: { read: isAuthenticated, update: isAdmin },
  versions: { max: 20 },
  fields: [
    {
      name: 'columnLayout',
      type: 'array',
      required: true,
      minRows: 2,
      maxRows: 4,
      admin: {
        description:
          'Order, labels and widths of the items table. Ratios are relative — the predecessor used 5:2:2:2.',
      },
      defaultValue: [
        { key: 'description', label: 'Description', ratio: 5, align: 'left' },
        { key: 'quantity', label: 'Hours', ratio: 2, align: 'right' },
        { key: 'unitPrice', label: 'Price', ratio: 2, align: 'right' },
        { key: 'lineTotal', label: 'Total', ratio: 2, align: 'right' },
      ],
      fields: [
        {
          name: 'key',
          type: 'select',
          required: true,
          options: [
            { label: 'Description', value: 'description' },
            { label: 'Quantity', value: 'quantity' },
            { label: 'Unit price', value: 'unitPrice' },
            { label: 'Line total', value: 'lineTotal' },
          ],
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          admin: { description: 'Printed header. The quantity column is overridden per invoice.' },
        },
        { name: 'ratio', type: 'number', required: true, min: 1, max: 12, defaultValue: 2 },
        {
          name: 'align',
          type: 'select',
          required: true,
          defaultValue: 'right',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
        },
      ],
    },
    {
      name: 'tableStyle',
      type: 'group',
      admin: {
        description:
          'Full grid borders and a shaded body row, matching a typical hand-made invoice template.',
      },
      fields: [
        { name: 'gridBorders', type: 'checkbox', defaultValue: true },
        { name: 'shadeBodyRows', type: 'checkbox', defaultValue: true },
        { name: 'boldDescription', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'showSubtotalWhenUntaxed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'With no GST the subtotal equals the total, so printing both is noise — go straight to AMOUNT DUE.',
      },
    },
    {
      name: 'bankDetailsPlacement',
      /**
       * "Terms" puts the account details wherever the terms text contains a
       * {{bankDetails}} placeholder — and does nothing at all if there isn't
       * one. Combined with a template that has no placeholder, that produces an
       * invoice whose account details appear NOWHERE: the most expensive kind of
       * silent failure this document can have.
       *
       * "Both" is safe either way, because PAYABLE TO carries them regardless.
       */
      validate: (value: unknown, options: unknown) => {
        const { siblingData } = options as { siblingData?: { defaultTermsTemplate?: string } }
        if (value !== 'terms') return true
        const template = siblingData?.defaultTermsTemplate ?? ''
        if (template.includes('{{bankDetails}}')) return true
        return 'Your terms template has no {{bankDetails}} placeholder, so "Terms" would leave your account details off the invoice entirely. Add {{bankDetails}} to the template, or choose "Payable to" or "Both".'
      },
      type: 'select',
      required: true,
      defaultValue: 'payable_to',
      options: [
        { label: 'Inside the terms text', value: 'terms' },
        { label: 'In the PAYABLE TO block', value: 'payable_to' },
        { label: 'Both', value: 'both' },
      ],
      admin: {
        description:
          'Where the client finds your account details. "Payable to" prints them under your name; "Terms" prints them wherever the terms text contains {{bankDetails}}; "Both" does each. Keep it consistent with the terms wording — if the terms say "the account listed above", the details belong in PAYABLE TO.',
      },
    },
    {
      name: 'defaultTermsTemplate',
      type: 'textarea',
      required: true,
      maxLength: 4000,
      defaultValue: `1. Payment Terms: Payment is due {{paymentTermsDays}} days after the date issued.
2. Payment Methods: Direct debit is preferred to the account listed above.
3. Disputes: Any disputes regarding charges must be raised within 14 days of the invoice date.`,
      admin: {
        description:
          'Copied onto each new invoice and then editable there. An invoice with no terms of its own falls back to this, so payment terms are never missing from a document. {{paymentTermsDays}} and {{bankDetails}} are substituted when the PDF renders, not when it is copied.',
      },
    },
    {
      name: 'closingLine',
      type: 'textarea',
      maxLength: 500,
      // Deliberately empty. This used to default to "Thank you for your
      // business…", which the operator asked to have removed from the document
      // — but leaving it as the default meant every fresh install and every
      // re-save of this global put it straight back. An instruction about the
      // document has to live in the default, not just in one row of data.
      admin: {
        description:
          'Optional. Sits in the content flow, left-aligned, after the terms. Empty by default — the footer below carries the business identity instead.',
      },
    },
    {
      name: 'footerLine',
      type: 'text',
      maxLength: 200,
      admin: {
        description:
          'Centred footer, repeated on every page. Leave it empty and the document composes one from Business Settings — your name, ABN and contact — so a printed page always identifies who issued it. Type something here to use that instead.',
      },
    },
    {
      name: 'reminderOffsetsDays',
      type: 'text',
      defaultValue: '-7,-3,-1,0,3,7,14',
      admin: {
        description:
          'Phase 2. Negative is before the due date, positive after. Each fires at most once per invoice.',
      },
    },
  ],
}
