import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { ActivityLog } from '@/collections/activity-log'
import { BankAccounts } from '@/collections/bank-accounts'
import { Clients } from '@/collections/clients'
import { Invoices } from '@/collections/invoices'
import { Media } from '@/collections/media'
import { NumberSequences } from '@/collections/number-sequences'
import { InvoiceReminders } from '@/collections/invoice-reminders'
import { Notifications } from '@/collections/notifications'
import { Payments } from '@/collections/payments'
import { ReminderRules } from '@/collections/reminder-rules'
import { Quotes } from '@/collections/quotes'
import { ServiceBillings } from '@/collections/service-billings'
import { Services } from '@/collections/services'
import { Users } from '@/collections/users'
import { requireConnectionString } from '@/lib/db/connection-string'
import { vercelBlobPrivateAdapter } from '@/lib/storage/vercel-blob-private'
import { buildEmailAdapter } from '@/lib/email/adapter'
import { BusinessSettings } from '@/globals/business-settings'
import { InvoiceDefaults } from '@/globals/invoice-defaults'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Uploads fall back to local disk without a token, so a fresh clone and offline
 * dev both work untouched. Setting this locally means dev uploads land in the
 * same store as production.
 */
const blobIsConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

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
    Payments,
    ReminderRules,
    InvoiceReminders,
    Notifications,
    // Registered now, built later — one schema, one initial migration, no rework.
    Quotes,
  ],

  globals: [BusinessSettings, InvoiceDefaults],

  plugins: [
    // ---------------------------------------------------------------- uploads
    // Vercel's filesystem is read-only, so `upload.staticDir` cannot work in
    // production: archiving the rendered PDF is part of sending an invoice, so
    // without object storage the send fails on deploy while working locally.
    //
    // A PRIVATE Vercel Blob store, via our own adapter. Payload's first-party
    // `storage-vercel-blob` supports public stores only and cannot read a
    // private one — see src/lib/storage/vercel-blob-private.ts for exactly
    // where and why. The store refuses anonymous reads, and Payload's access
    // control on the media collection is the only way to the bytes.
    cloudStoragePlugin({
      enabled: blobIsConfigured,
      collections: {
        media: {
          adapter: blobIsConfigured
            ? vercelBlobPrivateAdapter({ token: process.env.BLOB_READ_WRITE_TOKEN as string })
            : null,
          disableLocalStorage: blobIsConfigured,
        },
      },

      // Keeps the adapter's `prefix` field out of the "only present when
      // configured" trap, which would give local and production different
      // schemas and fail a deploy on a column no migration created. Verified
      // that migrate:create reports no schema change either way; set because
      // the failure it prevents is silent, and v4 makes it the default.
      alwaysInsertFields: true,
    }),
  ],

  editor: lexicalEditor(),

  // Undefined when RESEND_API_KEY is absent, which makes Payload log mail to the
  // console instead of sending it. Nothing reaches a client until a key is set.
  email: buildEmailAdapter(),

  db: postgresAdapter({
    pool: {
      // Accepts DATABASE_URI, DATABASE_URL or POSTGRES_URL, and fails with a
      // readable message rather than ECONNREFUSED 127.0.0.1:5432.
      connectionString: requireConnectionString(),
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
