import type { GlobalConfig } from 'payload'

import { isAdmin, isAuthenticated } from '@/lib/access'
import { isValidAbn, normaliseAbn } from '@/lib/validation/abn'

/**
 * Everything that prints in the PAYABLE TO block, plus the tax posture.
 *
 * Versioned, because your own ABN and bank details appearing on legal documents
 * is exactly the kind of thing you want a history of.
 */
export const BusinessSettings: GlobalConfig = {
  slug: 'business-settings',
  label: 'Business settings',
  admin: { group: 'Settings' },
  access: { read: isAuthenticated, update: isAdmin },
  versions: { max: 20 },
  fields: [
    {
      type: 'collapsible',
      label: 'Identity',
      fields: [
        { name: 'tradingName', type: 'text', required: true },
        {
          name: 'legalName',
          type: 'text',
          admin: { description: 'Only if it differs from the trading name.' },
        },
        {
          name: 'abn',
          type: 'text',
          label: 'ABN',
          required: true,
          validate: (value: string | null | undefined) => {
            if (!value) return 'An ABN is required — the ATO requires it on every invoice you issue.'
            return isValidAbn(value) || 'That is not a valid ABN (the checksum does not match).'
          },
          hooks: { beforeValidate: [({ value }) => (value ? normaliseAbn(value) : value)] },
          admin: { description: 'Stored digits-only, printed grouped — e.g. 51 824 753 556.' },
        },
        { name: 'email', type: 'email', required: true },
        { name: 'phone', type: 'text' },
        { name: 'website', type: 'text' },
        { name: 'logo', type: 'upload', relationTo: 'media' },
        {
          name: 'address',
          type: 'group',
          fields: [
            { name: 'line1', type: 'text' },
            { name: 'line2', type: 'text' },
            { name: 'city', type: 'text' },
            { name: 'state', type: 'text', defaultValue: 'VIC' },
            { name: 'postcode', type: 'text' },
            { name: 'country', type: 'text', defaultValue: 'Australia' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Tax',
      admin: {
        description:
          'The ATO is explicit: a business that is not registered for GST must not use the words "tax invoice" and must not show a GST line. Leave this off until you are registered.',
      },
      fields: [
        {
          name: 'gstRegistered',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Turn on once turnover reaches A$75,000 (NZ$60,000). This single flag flips the document title from INVOICE to TAX INVOICE, adds the tax row, and sets the rate.',
          },
        },
        {
          name: 'gstRegisteredFrom',
          type: 'date',
          admin: {
            condition: (data) => Boolean(data?.gstRegistered),
            description:
              'Invoices issued before this date keep saying INVOICE, so registering never retroactively relabels old documents.',
          },
        },
        {
          name: 'taxJurisdiction',
          type: 'select',
          required: true,
          defaultValue: 'AU',
          options: [
            { label: 'Australia — GST 10%', value: 'AU' },
            { label: 'New Zealand — GST 15%', value: 'NZ' },
          ],
        },
        {
          name: 'taxLabel',
          type: 'text',
          defaultValue: 'GST',
          admin: { description: 'Only ever printed when the rate is above zero.' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Numbering',
      fields: [
        {
          name: 'numberAllocationMode',
          type: 'select',
          required: true,
          defaultValue: 'onSend',
          options: [
            { label: 'Allocate when sent (no gaps)', value: 'onSend' },
            { label: 'Allocate when created', value: 'onCreate' },
          ],
          admin: {
            description:
              'Allocating on send means abandoned drafts never consume a number, so the issued sequence has no gaps.',
          },
        },
        {
          name: 'numberPrefix',
          type: 'text',
          admin: { description: 'Optional, e.g. "INV-". Leave empty for a bare number.' },
        },
        {
          name: 'numberPadding',
          type: 'number',
          defaultValue: 0,
          min: 0,
          max: 8,
          admin: { description: '0 prints "6"; 3 prints "006".' },
        },
      ],
    },
  ],
}
