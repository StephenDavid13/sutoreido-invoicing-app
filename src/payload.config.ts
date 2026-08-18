import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { ActivityLog } from '@/collections/activity-log'
import { BankAccounts } from '@/collections/bank-accounts'
import { Clients } from '@/collections/clients'
import { Invoices } from '@/collections/invoices'
import { Media } from '@/collections/media'
import { NumberSequences } from '@/collections/number-sequences'
import { Payments } from '@/collections/payments'
import { Quotes } from '@/collections/quotes'
import { ServiceBillings } from '@/collections/service-billings'
import { Services } from '@/collections/services'
import { Users } from '@/collections/users'
import { BusinessSettings } from '@/globals/business-settings'
import { InvoiceDefaults } from '@/globals/invoice-defaults'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // -------------------------------------------------------------------- routes
  // Payload installs a CATCH-ALL at its api route. Left at the default `/api` it
  // would swallow our own route handlers (the invoice PDF download, and later
  // any webhook). Moving it costs nothing on day one and removes the ambiguity.
  // The folder src/app/(payload)/payload-api/ must match this value, and so must
  // `images.localPatterns` in next.config.ts.
  routes: {
    api: '/payload-api',
  },

  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— Sutoreido',
    },
  },

  collections: [
    // Phase 1
    Users,
    Clients,
    Invoices,
    BankAccounts,
    Media,
    NumberSequences,
    ActivityLog,
    // Recurring hosting and maintenance — invoice #5's shape, automated.
    Services,
    ServiceBillings,
    // Registered now, built later — one schema, one initial migration, no rework.
    Quotes,
    Payments,
  ],

  globals: [BusinessSettings, InvoiceDefaults],

  editor: lexicalEditor(),

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
      // Serverless-safe default. Each warm instance keeps its own pool, so this
      // stays low even though local dev could afford more.
      max: 10,
    },
    // `push` is Payload's default in development and syncs the schema as the
    // config changes. It must NEVER be mixed with `payload migrate` on the same
    // database: push writes a payload-migrations row with batch -1, and migrate
    // then warns that data loss will occur. Production runs migrations only.
    push: process.env.NODE_ENV !== 'production',
  }),

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  sharp,
})
