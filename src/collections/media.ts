import type { CollectionConfig } from 'payload'

import { isAuthenticated } from '@/lib/access'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'System' },
  access: {
    // Rendered invoice PDFs live here. Reads are authenticated; the public
    // portal serves its PDF through a token-checked route, never by exposing
    // this collection.
    read: isAuthenticated,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'application/pdf'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      admin: { description: 'Alternative text, for images used in the app.' },
    },
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'general',
      index: true,
      options: [
        { label: 'General', value: 'general' },
        { label: 'Business logo', value: 'logo' },
        { label: 'Invoice PDF (archived)', value: 'invoice-pdf' },
        { label: 'Quote PDF (archived)', value: 'quote-pdf' },
        { label: 'Attachment', value: 'attachment' },
      ],
      admin: {
        description:
          'Archived invoice PDFs are immutable once the invoice is sent — they are the record of what the client actually received.',
      },
    },
  ],
}
