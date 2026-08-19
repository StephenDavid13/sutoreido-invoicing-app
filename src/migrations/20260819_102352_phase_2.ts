import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_invoices_delivery_state" AS ENUM('not_sent', 'composed', 'delivered', 'failed');
  CREATE TYPE "public"."enum_payments_currency" AS ENUM('AUD', 'NZD', 'USD', 'PHP');
  CREATE TYPE "public"."enum_invoice_reminders_state" AS ENUM('prepared', 'sent', 'dismissed');
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('reminder_prepared', 'invoice_overdue', 'ready_to_bill', 'renewal_due', 'invoice_viewed', 'delivery_failed');
  CREATE TABLE "reminder_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"label" varchar DEFAULT 'Default' NOT NULL,
  	"client_id" integer,
  	"offsets_days" varchar DEFAULT '-3,0,7,21' NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"stop_when_part_paid" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invoice_reminders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"invoice_id" integer NOT NULL,
  	"kind" varchar NOT NULL,
  	"offset_days" numeric,
  	"state" "enum_invoice_reminders_state" DEFAULT 'prepared' NOT NULL,
  	"to_address" varchar,
  	"subject" varchar,
  	"body_html" varchar,
  	"balance_at_prepared" numeric,
  	"prepared_at" timestamp(3) with time zone NOT NULL,
  	"sent_at" timestamp(3) with time zone,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"kind" "enum_notifications_kind" NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"action_url" varchar,
  	"dedupe_key" varchar NOT NULL,
  	"read_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "invoices" ADD COLUMN "emailed_at" timestamp(3) with time zone;
  ALTER TABLE "invoices" ADD COLUMN "delivery_state" "enum_invoices_delivery_state" DEFAULT 'not_sent';
  ALTER TABLE "invoices" ADD COLUMN "delivery_note" varchar;
  ALTER TABLE "payments" ADD COLUMN "currency" "enum_payments_currency";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reminder_rules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invoice_reminders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notifications_id" integer;
  ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "reminder_rules_owner_idx" ON "reminder_rules" USING btree ("owner_id");
  CREATE INDEX "reminder_rules_client_idx" ON "reminder_rules" USING btree ("client_id");
  CREATE INDEX "reminder_rules_updated_at_idx" ON "reminder_rules" USING btree ("updated_at");
  CREATE INDEX "reminder_rules_created_at_idx" ON "reminder_rules" USING btree ("created_at");
  CREATE INDEX "owner_client_idx" ON "reminder_rules" USING btree ("owner_id","client_id");
  CREATE INDEX "invoice_reminders_owner_idx" ON "invoice_reminders" USING btree ("owner_id");
  CREATE INDEX "invoice_reminders_invoice_idx" ON "invoice_reminders" USING btree ("invoice_id");
  CREATE INDEX "invoice_reminders_state_idx" ON "invoice_reminders" USING btree ("state");
  CREATE INDEX "invoice_reminders_updated_at_idx" ON "invoice_reminders" USING btree ("updated_at");
  CREATE INDEX "invoice_reminders_created_at_idx" ON "invoice_reminders" USING btree ("created_at");
  CREATE UNIQUE INDEX "invoice_kind_idx" ON "invoice_reminders" USING btree ("invoice_id","kind");
  CREATE INDEX "owner_state_idx" ON "invoice_reminders" USING btree ("owner_id","state");
  CREATE INDEX "notifications_owner_idx" ON "notifications" USING btree ("owner_id");
  CREATE INDEX "notifications_kind_idx" ON "notifications" USING btree ("kind");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE UNIQUE INDEX "dedupeKey_idx" ON "notifications" USING btree ("dedupe_key");
  CREATE INDEX "owner_readAt_idx" ON "notifications" USING btree ("owner_id","read_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reminder_rules_fk" FOREIGN KEY ("reminder_rules_id") REFERENCES "public"."reminder_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoice_reminders_fk" FOREIGN KEY ("invoice_reminders_id") REFERENCES "public"."invoice_reminders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "invoices_delivery_state_idx" ON "invoices" USING btree ("delivery_state");
  CREATE INDEX "payload_locked_documents_rels_reminder_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("reminder_rules_id");
  CREATE INDEX "payload_locked_documents_rels_invoice_reminders_id_idx" ON "payload_locked_documents_rels" USING btree ("invoice_reminders_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reminder_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "invoice_reminders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "reminder_rules" CASCADE;
  DROP TABLE "invoice_reminders" CASCADE;
  DROP TABLE "notifications" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reminder_rules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invoice_reminders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notifications_fk";
  
  DROP INDEX "invoices_delivery_state_idx";
  DROP INDEX "payload_locked_documents_rels_reminder_rules_id_idx";
  DROP INDEX "payload_locked_documents_rels_invoice_reminders_id_idx";
  DROP INDEX "payload_locked_documents_rels_notifications_id_idx";
  ALTER TABLE "invoices" DROP COLUMN "emailed_at";
  ALTER TABLE "invoices" DROP COLUMN "delivery_state";
  ALTER TABLE "invoices" DROP COLUMN "delivery_note";
  ALTER TABLE "payments" DROP COLUMN "currency";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reminder_rules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invoice_reminders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notifications_id";
  DROP TYPE "public"."enum_invoices_delivery_state";
  DROP TYPE "public"."enum_payments_currency";
  DROP TYPE "public"."enum_invoice_reminders_state";
  DROP TYPE "public"."enum_notifications_kind";`)
}
