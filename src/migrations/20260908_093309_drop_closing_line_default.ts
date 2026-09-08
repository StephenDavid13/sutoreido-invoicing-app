import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "invoice_defaults" ALTER COLUMN "closing_line" DROP DEFAULT;
  ALTER TABLE "_invoice_defaults_v" ALTER COLUMN "version_closing_line" DROP DEFAULT;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "invoice_defaults" ALTER COLUMN "closing_line" SET DEFAULT 'Thank you for your business. If you have any questions, please contact me at your convenience.';
  ALTER TABLE "_invoice_defaults_v" ALTER COLUMN "version_closing_line" SET DEFAULT 'Thank you for your business. If you have any questions, please contact me at your convenience.';`)
}
