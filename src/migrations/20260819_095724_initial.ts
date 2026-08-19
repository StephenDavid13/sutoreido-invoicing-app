import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'admin');
  CREATE TYPE "public"."enum_users_timezone" AS ENUM('Australia/Melbourne', 'Australia/Sydney', 'Australia/Brisbane', 'Australia/Perth', 'Pacific/Auckland');
  CREATE TYPE "public"."enum_users_locale" AS ENUM('en-AU', 'en-NZ');
  CREATE TYPE "public"."enum_clients_default_currency" AS ENUM('AUD', 'NZD', 'USD', 'PHP');
  CREATE TYPE "public"."enum_clients_default_due_mode" AS ENUM('on_receipt', 'net_days', 'fixed_date');
  CREATE TYPE "public"."enum_clients_default_qty_label" AS ENUM('Qty', 'Hours', 'Days', 'Units');
  CREATE TYPE "public"."enum_clients_status" AS ENUM('active', 'archived');
  CREATE TYPE "public"."enum_invoices_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled');
  CREATE TYPE "public"."enum_invoices_due_mode" AS ENUM('on_receipt', 'net_days', 'fixed_date');
  CREATE TYPE "public"."enum_invoices_currency" AS ENUM('AUD', 'NZD', 'USD', 'PHP');
  CREATE TYPE "public"."enum_invoices_qty_label" AS ENUM('Qty', 'Hours', 'Days', 'Units');
  CREATE TYPE "public"."enum_invoices_delivery_state" AS ENUM('not_sent', 'composed', 'delivered', 'failed');
  CREATE TYPE "public"."enum_bank_accounts_currency" AS ENUM('AUD', 'NZD', 'USD', 'PHP');
  CREATE TYPE "public"."enum_media_kind" AS ENUM('general', 'logo', 'invoice-pdf', 'quote-pdf', 'attachment');
  CREATE TYPE "public"."enum_number_sequences_kind" AS ENUM('invoice', 'quote');
  CREATE TYPE "public"."enum_activity_log_entity_type" AS ENUM('invoice', 'quote');
  CREATE TYPE "public"."enum_services_costs_currency" AS ENUM('AUD', 'NZD', 'USD', 'PHP');
  CREATE TYPE "public"."enum_services_costs_period" AS ENUM('one_off', 'monthly', 'quarterly', 'annually');
  CREATE TYPE "public"."enum_services_kind" AS ENUM('hosting', 'maintenance', 'domain', 'ssl', 'retainer', 'other');
  CREATE TYPE "public"."enum_services_status" AS ENUM('active', 'paused', 'cancelled');
  CREATE TYPE "public"."enum_services_currency" AS ENUM('AUD', 'NZD', 'USD', 'PHP');
  CREATE TYPE "public"."enum_services_billing_period" AS ENUM('monthly', 'quarterly', 'annually');
  CREATE TYPE "public"."enum_services_qty_label" AS ENUM('Qty', 'Hours', 'Days', 'Units');
  CREATE TYPE "public"."enum_payments_currency" AS ENUM('AUD', 'NZD', 'USD', 'PHP');
  CREATE TYPE "public"."enum_payments_method" AS ENUM('bank_transfer', 'card', 'cash', 'other');
  CREATE TYPE "public"."enum_invoice_reminders_state" AS ENUM('prepared', 'sent', 'dismissed');
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('reminder_prepared', 'invoice_overdue', 'ready_to_bill', 'renewal_due', 'invoice_viewed', 'delivery_failed');
  CREATE TYPE "public"."enum_quotes_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');
  CREATE TYPE "public"."enum_quotes_currency" AS ENUM('AUD', 'NZD', 'USD', 'PHP');
  CREATE TYPE "public"."enum_business_settings_tax_jurisdiction" AS ENUM('AU', 'NZ');
  CREATE TYPE "public"."enum_business_settings_number_allocation_mode" AS ENUM('onSend', 'onCreate');
  CREATE TYPE "public"."enum__business_settings_v_version_tax_jurisdiction" AS ENUM('AU', 'NZ');
  CREATE TYPE "public"."enum__business_settings_v_version_number_allocation_mode" AS ENUM('onSend', 'onCreate');
  CREATE TYPE "public"."enum_invoice_defaults_column_layout_key" AS ENUM('description', 'quantity', 'unitPrice', 'lineTotal');
  CREATE TYPE "public"."enum_invoice_defaults_column_layout_align" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_invoice_defaults_bank_details_placement" AS ENUM('terms', 'payable_to', 'both');
  CREATE TYPE "public"."enum__invoice_defaults_v_version_column_layout_key" AS ENUM('description', 'quantity', 'unitPrice', 'lineTotal');
  CREATE TYPE "public"."enum__invoice_defaults_v_version_column_layout_align" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__invoice_defaults_v_version_bank_details_placement" AS ENUM('terms', 'payable_to', 'both');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'user' NOT NULL,
  	"timezone" "enum_users_timezone" DEFAULT 'Australia/Melbourne' NOT NULL,
  	"locale" "enum_users_locale" DEFAULT 'en-AU' NOT NULL,
  	"notification_prefs_email_on_invoice_paid" boolean DEFAULT true,
  	"notification_prefs_email_on_invoice_viewed" boolean DEFAULT true,
  	"notification_prefs_email_on_quote_accepted" boolean DEFAULT true,
  	"notification_prefs_daily_ready_to_bill_digest" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "clients_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"phone" varchar,
  	"role" varchar,
  	"cc_on_invoices" boolean DEFAULT false
  );
  
  CREATE TABLE "clients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"name" varchar NOT NULL,
  	"abn" varchar,
  	"email" varchar,
  	"phone" varchar,
  	"address_line1" varchar,
  	"address_line2" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_postcode" varchar,
  	"address_country" varchar DEFAULT 'Australia',
  	"default_currency" "enum_clients_default_currency" DEFAULT 'AUD' NOT NULL,
  	"default_due_mode" "enum_clients_default_due_mode" DEFAULT 'on_receipt' NOT NULL,
  	"default_payment_terms_days" numeric DEFAULT 14,
  	"default_qty_label" "enum_clients_default_qty_label" DEFAULT 'Qty' NOT NULL,
  	"default_hourly_rate_cents" numeric,
  	"status" "enum_clients_status" DEFAULT 'active' NOT NULL,
  	"notes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "clients_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "invoices_line_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"quantity_milli" numeric NOT NULL,
  	"unit" varchar,
  	"unit_price_cents" numeric NOT NULL,
  	"line_total_cents" numeric
  );
  
  CREATE TABLE "invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"invoice_number" numeric,
  	"display_number" varchar,
  	"status" "enum_invoices_status" DEFAULT 'draft' NOT NULL,
  	"client_id" integer NOT NULL,
  	"title" varchar,
  	"reference" varchar,
  	"issued_date" timestamp(3) with time zone NOT NULL,
  	"due_mode" "enum_invoices_due_mode" DEFAULT 'on_receipt' NOT NULL,
  	"payment_terms_days" numeric DEFAULT 14,
  	"due_date" timestamp(3) with time zone,
  	"currency" "enum_invoices_currency" DEFAULT 'AUD' NOT NULL,
  	"qty_label" "enum_invoices_qty_label" DEFAULT 'Qty' NOT NULL,
  	"discount_cents" numeric,
  	"tax_rate_basis_points" numeric DEFAULT 0 NOT NULL,
  	"tax_label" varchar DEFAULT 'GST',
  	"gst_registered_at_issue" boolean DEFAULT false,
  	"subtotal_cents" numeric,
  	"tax_cents" numeric,
  	"total_cents" numeric,
  	"amount_paid_cents" numeric,
  	"balance_cents" numeric,
  	"notes" varchar,
  	"terms" varchar,
  	"bank_account_id" integer,
  	"bill_to_snapshot" jsonb,
  	"payable_to_snapshot" jsonb,
  	"archived_pdf_id" integer,
  	"share_token" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"emailed_at" timestamp(3) with time zone,
  	"delivery_state" "enum_invoices_delivery_state" DEFAULT 'not_sent',
  	"delivery_note" varchar,
  	"viewed_at" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"source_quote_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bank_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"label" varchar NOT NULL,
  	"currency" "enum_bank_accounts_currency" NOT NULL,
  	"account_name" varchar,
  	"bank_name" varchar,
  	"bsb" varchar,
  	"account_number" varchar NOT NULL,
  	"swift" varchar,
  	"iban" varchar,
  	"is_default" boolean DEFAULT false,
  	"archived" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"kind" "enum_media_kind" DEFAULT 'general',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "number_sequences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"kind" "enum_number_sequences_kind" NOT NULL,
  	"last_value" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activity_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"summary" varchar,
  	"entity_type" "enum_activity_log_entity_type" NOT NULL,
  	"entity_id" varchar NOT NULL,
  	"entity_number" numeric,
  	"from_status" varchar NOT NULL,
  	"to_status" varchar NOT NULL,
  	"is_admin_override" boolean DEFAULT false,
  	"reason" varchar,
  	"actor_id" integer,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "services_costs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"vendor" varchar NOT NULL,
  	"description" varchar,
  	"amount_cents" numeric NOT NULL,
  	"currency" "enum_services_costs_currency" DEFAULT 'AUD' NOT NULL,
  	"period" "enum_services_costs_period" DEFAULT 'monthly' NOT NULL,
  	"renews_on" timestamp(3) with time zone,
  	"notify_days_before" numeric DEFAULT 30
  );
  
  CREATE TABLE "services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"name" varchar NOT NULL,
  	"client_id" integer NOT NULL,
  	"kind" "enum_services_kind" DEFAULT 'hosting' NOT NULL,
  	"domain" varchar,
  	"status" "enum_services_status" DEFAULT 'active' NOT NULL,
  	"currency" "enum_services_currency" DEFAULT 'AUD' NOT NULL,
  	"charge_cents" numeric NOT NULL,
  	"billing_period" "enum_services_billing_period" DEFAULT 'monthly' NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone,
  	"periods_billed" numeric DEFAULT 0 NOT NULL,
  	"next_invoice_on" timestamp(3) with time zone,
  	"auto_generate" boolean DEFAULT true,
  	"auto_send" boolean DEFAULT false,
  	"line_description" varchar,
  	"quantity_milli" numeric,
  	"qty_label" "enum_services_qty_label" DEFAULT 'Qty',
  	"payment_terms_days" numeric,
  	"bank_account_id" integer,
  	"monthly_charge_cents" numeric,
  	"monthly_cost_cents" numeric,
  	"monthly_margin_cents" numeric,
  	"cost_currency_mismatch" boolean DEFAULT false,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "service_billings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"service_id" integer NOT NULL,
  	"invoice_id" integer,
  	"period_start" timestamp(3) with time zone NOT NULL,
  	"period_end" timestamp(3) with time zone NOT NULL,
  	"period_label" varchar,
  	"charge_cents" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"invoice_id" integer NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"currency" "enum_payments_currency",
  	"received_on" timestamp(3) with time zone NOT NULL,
  	"method" "enum_payments_method" DEFAULT 'bank_transfer' NOT NULL,
  	"reference" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
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
  	"offset_days" numeric NOT NULL,
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
  
  CREATE TABLE "quotes_scope_bullets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "quotes_line_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"quantity_milli" numeric NOT NULL,
  	"unit_price_cents" numeric NOT NULL,
  	"line_total_cents" numeric
  );
  
  CREATE TABLE "quotes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer,
  	"quote_number" numeric,
  	"status" "enum_quotes_status" DEFAULT 'draft' NOT NULL,
  	"client_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"reference" varchar,
  	"service_summary" varchar,
  	"issued_date" timestamp(3) with time zone NOT NULL,
  	"valid_until" timestamp(3) with time zone NOT NULL,
  	"currency" "enum_quotes_currency" DEFAULT 'AUD' NOT NULL,
  	"tax_rate_basis_points" numeric DEFAULT 0 NOT NULL,
  	"subtotal_cents" numeric,
  	"tax_cents" numeric,
  	"total_cents" numeric,
  	"terms" varchar,
  	"accepted_by_name" varchar,
  	"accepted_at" timestamp(3) with time zone,
  	"share_token" varchar,
  	"converted_to_invoice_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"clients_id" integer,
  	"invoices_id" integer,
  	"bank_accounts_id" integer,
  	"media_id" integer,
  	"number_sequences_id" integer,
  	"activity_log_id" integer,
  	"services_id" integer,
  	"service_billings_id" integer,
  	"payments_id" integer,
  	"reminder_rules_id" integer,
  	"invoice_reminders_id" integer,
  	"notifications_id" integer,
  	"quotes_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "business_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"trading_name" varchar NOT NULL,
  	"legal_name" varchar,
  	"abn" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"website" varchar,
  	"logo_id" integer,
  	"address_line1" varchar,
  	"address_line2" varchar,
  	"address_city" varchar,
  	"address_state" varchar DEFAULT 'VIC',
  	"address_postcode" varchar,
  	"address_country" varchar DEFAULT 'Australia',
  	"gst_registered" boolean DEFAULT false,
  	"gst_registered_from" timestamp(3) with time zone,
  	"tax_jurisdiction" "enum_business_settings_tax_jurisdiction" DEFAULT 'AU' NOT NULL,
  	"tax_label" varchar DEFAULT 'GST',
  	"number_allocation_mode" "enum_business_settings_number_allocation_mode" DEFAULT 'onSend' NOT NULL,
  	"number_prefix" varchar,
  	"number_padding" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_business_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_trading_name" varchar NOT NULL,
  	"version_legal_name" varchar,
  	"version_abn" varchar NOT NULL,
  	"version_email" varchar NOT NULL,
  	"version_phone" varchar,
  	"version_website" varchar,
  	"version_logo_id" integer,
  	"version_address_line1" varchar,
  	"version_address_line2" varchar,
  	"version_address_city" varchar,
  	"version_address_state" varchar DEFAULT 'VIC',
  	"version_address_postcode" varchar,
  	"version_address_country" varchar DEFAULT 'Australia',
  	"version_gst_registered" boolean DEFAULT false,
  	"version_gst_registered_from" timestamp(3) with time zone,
  	"version_tax_jurisdiction" "enum__business_settings_v_version_tax_jurisdiction" DEFAULT 'AU' NOT NULL,
  	"version_tax_label" varchar DEFAULT 'GST',
  	"version_number_allocation_mode" "enum__business_settings_v_version_number_allocation_mode" DEFAULT 'onSend' NOT NULL,
  	"version_number_prefix" varchar,
  	"version_number_padding" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invoice_defaults_column_layout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" "enum_invoice_defaults_column_layout_key" NOT NULL,
  	"label" varchar NOT NULL,
  	"ratio" numeric DEFAULT 2 NOT NULL,
  	"align" "enum_invoice_defaults_column_layout_align" DEFAULT 'right' NOT NULL
  );
  
  CREATE TABLE "invoice_defaults" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"table_style_grid_borders" boolean DEFAULT true,
  	"table_style_shade_body_rows" boolean DEFAULT true,
  	"table_style_bold_description" boolean DEFAULT true,
  	"show_subtotal_when_untaxed" boolean DEFAULT false,
  	"bank_details_placement" "enum_invoice_defaults_bank_details_placement" DEFAULT 'payable_to' NOT NULL,
  	"default_terms_template" varchar DEFAULT '1. Payment Terms: Payment is due {{paymentTermsDays}} days after the date issued.
  2. Payment Methods: Direct debit is preferred to the account listed above.
  3. Disputes: Any disputes regarding charges must be raised within 14 days of the invoice date.' NOT NULL,
  	"closing_line" varchar DEFAULT 'Thank you for your business. If you have any questions, please contact me at your convenience.',
  	"footer_line" varchar,
  	"reminder_offsets_days" varchar DEFAULT '-7,-3,-1,0,3,7,14',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_invoice_defaults_v_version_column_layout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" "enum__invoice_defaults_v_version_column_layout_key" NOT NULL,
  	"label" varchar NOT NULL,
  	"ratio" numeric DEFAULT 2 NOT NULL,
  	"align" "enum__invoice_defaults_v_version_column_layout_align" DEFAULT 'right' NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_invoice_defaults_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_table_style_grid_borders" boolean DEFAULT true,
  	"version_table_style_shade_body_rows" boolean DEFAULT true,
  	"version_table_style_bold_description" boolean DEFAULT true,
  	"version_show_subtotal_when_untaxed" boolean DEFAULT false,
  	"version_bank_details_placement" "enum__invoice_defaults_v_version_bank_details_placement" DEFAULT 'payable_to' NOT NULL,
  	"version_default_terms_template" varchar DEFAULT '1. Payment Terms: Payment is due {{paymentTermsDays}} days after the date issued.
  2. Payment Methods: Direct debit is preferred to the account listed above.
  3. Disputes: Any disputes regarding charges must be raised within 14 days of the invoice date.' NOT NULL,
  	"version_closing_line" varchar DEFAULT 'Thank you for your business. If you have any questions, please contact me at your convenience.',
  	"version_footer_line" varchar,
  	"version_reminder_offsets_days" varchar DEFAULT '-7,-3,-1,0,3,7,14',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clients_contacts" ADD CONSTRAINT "clients_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clients_texts" ADD CONSTRAINT "clients_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invoices_line_items" ADD CONSTRAINT "invoices_line_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_archived_pdf_id_media_id_fk" FOREIGN KEY ("archived_pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_quote_id_quotes_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services_costs" ADD CONSTRAINT "services_costs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_billings" ADD CONSTRAINT "service_billings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_billings" ADD CONSTRAINT "service_billings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_billings" ADD CONSTRAINT "service_billings_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes_scope_bullets" ADD CONSTRAINT "quotes_scope_bullets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes_line_items" ADD CONSTRAINT "quotes_line_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_to_invoice_id_invoices_id_fk" FOREIGN KEY ("converted_to_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clients_fk" FOREIGN KEY ("clients_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bank_accounts_fk" FOREIGN KEY ("bank_accounts_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_number_sequences_fk" FOREIGN KEY ("number_sequences_id") REFERENCES "public"."number_sequences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_log_fk" FOREIGN KEY ("activity_log_id") REFERENCES "public"."activity_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_billings_fk" FOREIGN KEY ("service_billings_id") REFERENCES "public"."service_billings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payments_fk" FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reminder_rules_fk" FOREIGN KEY ("reminder_rules_id") REFERENCES "public"."reminder_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoice_reminders_fk" FOREIGN KEY ("invoice_reminders_id") REFERENCES "public"."invoice_reminders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quotes_fk" FOREIGN KEY ("quotes_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_settings_v" ADD CONSTRAINT "_business_settings_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoice_defaults_column_layout" ADD CONSTRAINT "invoice_defaults_column_layout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."invoice_defaults"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_invoice_defaults_v_version_column_layout" ADD CONSTRAINT "_invoice_defaults_v_version_column_layout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_invoice_defaults_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "clients_contacts_order_idx" ON "clients_contacts" USING btree ("_order");
  CREATE INDEX "clients_contacts_parent_id_idx" ON "clients_contacts" USING btree ("_parent_id");
  CREATE INDEX "clients_owner_idx" ON "clients" USING btree ("owner_id");
  CREATE INDEX "clients_email_idx" ON "clients" USING btree ("email");
  CREATE INDEX "clients_default_currency_idx" ON "clients" USING btree ("default_currency");
  CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");
  CREATE INDEX "clients_updated_at_idx" ON "clients" USING btree ("updated_at");
  CREATE INDEX "clients_created_at_idx" ON "clients" USING btree ("created_at");
  CREATE INDEX "clients_texts_order_parent" ON "clients_texts" USING btree ("order","parent_id");
  CREATE INDEX "invoices_line_items_order_idx" ON "invoices_line_items" USING btree ("_order");
  CREATE INDEX "invoices_line_items_parent_id_idx" ON "invoices_line_items" USING btree ("_parent_id");
  CREATE INDEX "invoices_owner_idx" ON "invoices" USING btree ("owner_id");
  CREATE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");
  CREATE INDEX "invoices_display_number_idx" ON "invoices" USING btree ("display_number");
  CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");
  CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");
  CREATE INDEX "invoices_issued_date_idx" ON "invoices" USING btree ("issued_date");
  CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");
  CREATE INDEX "invoices_currency_idx" ON "invoices" USING btree ("currency");
  CREATE INDEX "invoices_bank_account_idx" ON "invoices" USING btree ("bank_account_id");
  CREATE INDEX "invoices_archived_pdf_idx" ON "invoices" USING btree ("archived_pdf_id");
  CREATE INDEX "invoices_share_token_idx" ON "invoices" USING btree ("share_token");
  CREATE INDEX "invoices_delivery_state_idx" ON "invoices" USING btree ("delivery_state");
  CREATE INDEX "invoices_source_quote_idx" ON "invoices" USING btree ("source_quote_id");
  CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");
  CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");
  CREATE UNIQUE INDEX "owner_invoiceNumber_idx" ON "invoices" USING btree ("owner_id","invoice_number");
  CREATE INDEX "owner_status_idx" ON "invoices" USING btree ("owner_id","status");
  CREATE INDEX "status_dueDate_idx" ON "invoices" USING btree ("status","due_date");
  CREATE INDEX "bank_accounts_owner_idx" ON "bank_accounts" USING btree ("owner_id");
  CREATE INDEX "bank_accounts_currency_idx" ON "bank_accounts" USING btree ("currency");
  CREATE INDEX "bank_accounts_archived_idx" ON "bank_accounts" USING btree ("archived");
  CREATE INDEX "bank_accounts_updated_at_idx" ON "bank_accounts" USING btree ("updated_at");
  CREATE INDEX "bank_accounts_created_at_idx" ON "bank_accounts" USING btree ("created_at");
  CREATE INDEX "media_kind_idx" ON "media" USING btree ("kind");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "number_sequences_owner_idx" ON "number_sequences" USING btree ("owner_id");
  CREATE INDEX "number_sequences_kind_idx" ON "number_sequences" USING btree ("kind");
  CREATE INDEX "number_sequences_updated_at_idx" ON "number_sequences" USING btree ("updated_at");
  CREATE INDEX "number_sequences_created_at_idx" ON "number_sequences" USING btree ("created_at");
  CREATE UNIQUE INDEX "owner_kind_idx" ON "number_sequences" USING btree ("owner_id","kind");
  CREATE INDEX "activity_log_owner_idx" ON "activity_log" USING btree ("owner_id");
  CREATE INDEX "activity_log_entity_type_idx" ON "activity_log" USING btree ("entity_type");
  CREATE INDEX "activity_log_entity_id_idx" ON "activity_log" USING btree ("entity_id");
  CREATE INDEX "activity_log_actor_idx" ON "activity_log" USING btree ("actor_id");
  CREATE INDEX "activity_log_occurred_at_idx" ON "activity_log" USING btree ("occurred_at");
  CREATE INDEX "activity_log_updated_at_idx" ON "activity_log" USING btree ("updated_at");
  CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");
  CREATE INDEX "services_costs_order_idx" ON "services_costs" USING btree ("_order");
  CREATE INDEX "services_costs_parent_id_idx" ON "services_costs" USING btree ("_parent_id");
  CREATE INDEX "services_costs_renews_on_idx" ON "services_costs" USING btree ("renews_on");
  CREATE INDEX "services_owner_idx" ON "services" USING btree ("owner_id");
  CREATE INDEX "services_client_idx" ON "services" USING btree ("client_id");
  CREATE INDEX "services_kind_idx" ON "services" USING btree ("kind");
  CREATE INDEX "services_status_idx" ON "services" USING btree ("status");
  CREATE INDEX "services_currency_idx" ON "services" USING btree ("currency");
  CREATE INDEX "services_next_invoice_on_idx" ON "services" USING btree ("next_invoice_on");
  CREATE INDEX "services_bank_account_idx" ON "services" USING btree ("bank_account_id");
  CREATE INDEX "services_updated_at_idx" ON "services" USING btree ("updated_at");
  CREATE INDEX "services_created_at_idx" ON "services" USING btree ("created_at");
  CREATE INDEX "owner_status_1_idx" ON "services" USING btree ("owner_id","status");
  CREATE INDEX "status_nextInvoiceOn_idx" ON "services" USING btree ("status","next_invoice_on");
  CREATE INDEX "service_billings_owner_idx" ON "service_billings" USING btree ("owner_id");
  CREATE INDEX "service_billings_service_idx" ON "service_billings" USING btree ("service_id");
  CREATE INDEX "service_billings_invoice_idx" ON "service_billings" USING btree ("invoice_id");
  CREATE INDEX "service_billings_period_start_idx" ON "service_billings" USING btree ("period_start");
  CREATE INDEX "service_billings_updated_at_idx" ON "service_billings" USING btree ("updated_at");
  CREATE INDEX "service_billings_created_at_idx" ON "service_billings" USING btree ("created_at");
  CREATE UNIQUE INDEX "service_periodStart_idx" ON "service_billings" USING btree ("service_id","period_start");
  CREATE INDEX "payments_owner_idx" ON "payments" USING btree ("owner_id");
  CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");
  CREATE INDEX "payments_received_on_idx" ON "payments" USING btree ("received_on");
  CREATE INDEX "payments_updated_at_idx" ON "payments" USING btree ("updated_at");
  CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");
  CREATE INDEX "invoice_receivedOn_idx" ON "payments" USING btree ("invoice_id","received_on");
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
  CREATE INDEX "quotes_scope_bullets_order_idx" ON "quotes_scope_bullets" USING btree ("_order");
  CREATE INDEX "quotes_scope_bullets_parent_id_idx" ON "quotes_scope_bullets" USING btree ("_parent_id");
  CREATE INDEX "quotes_line_items_order_idx" ON "quotes_line_items" USING btree ("_order");
  CREATE INDEX "quotes_line_items_parent_id_idx" ON "quotes_line_items" USING btree ("_parent_id");
  CREATE INDEX "quotes_owner_idx" ON "quotes" USING btree ("owner_id");
  CREATE INDEX "quotes_quote_number_idx" ON "quotes" USING btree ("quote_number");
  CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");
  CREATE INDEX "quotes_client_idx" ON "quotes" USING btree ("client_id");
  CREATE INDEX "quotes_share_token_idx" ON "quotes" USING btree ("share_token");
  CREATE INDEX "quotes_converted_to_invoice_idx" ON "quotes" USING btree ("converted_to_invoice_id");
  CREATE INDEX "quotes_updated_at_idx" ON "quotes" USING btree ("updated_at");
  CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");
  CREATE UNIQUE INDEX "owner_quoteNumber_idx" ON "quotes" USING btree ("owner_id","quote_number");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_clients_id_idx" ON "payload_locked_documents_rels" USING btree ("clients_id");
  CREATE INDEX "payload_locked_documents_rels_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("invoices_id");
  CREATE INDEX "payload_locked_documents_rels_bank_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("bank_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_number_sequences_id_idx" ON "payload_locked_documents_rels" USING btree ("number_sequences_id");
  CREATE INDEX "payload_locked_documents_rels_activity_log_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_log_id");
  CREATE INDEX "payload_locked_documents_rels_services_id_idx" ON "payload_locked_documents_rels" USING btree ("services_id");
  CREATE INDEX "payload_locked_documents_rels_service_billings_id_idx" ON "payload_locked_documents_rels" USING btree ("service_billings_id");
  CREATE INDEX "payload_locked_documents_rels_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("payments_id");
  CREATE INDEX "payload_locked_documents_rels_reminder_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("reminder_rules_id");
  CREATE INDEX "payload_locked_documents_rels_invoice_reminders_id_idx" ON "payload_locked_documents_rels" USING btree ("invoice_reminders_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_quotes_id_idx" ON "payload_locked_documents_rels" USING btree ("quotes_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "business_settings_logo_idx" ON "business_settings" USING btree ("logo_id");
  CREATE INDEX "_business_settings_v_version_version_logo_idx" ON "_business_settings_v" USING btree ("version_logo_id");
  CREATE INDEX "_business_settings_v_created_at_idx" ON "_business_settings_v" USING btree ("created_at");
  CREATE INDEX "_business_settings_v_updated_at_idx" ON "_business_settings_v" USING btree ("updated_at");
  CREATE INDEX "invoice_defaults_column_layout_order_idx" ON "invoice_defaults_column_layout" USING btree ("_order");
  CREATE INDEX "invoice_defaults_column_layout_parent_id_idx" ON "invoice_defaults_column_layout" USING btree ("_parent_id");
  CREATE INDEX "_invoice_defaults_v_version_column_layout_order_idx" ON "_invoice_defaults_v_version_column_layout" USING btree ("_order");
  CREATE INDEX "_invoice_defaults_v_version_column_layout_parent_id_idx" ON "_invoice_defaults_v_version_column_layout" USING btree ("_parent_id");
  CREATE INDEX "_invoice_defaults_v_created_at_idx" ON "_invoice_defaults_v" USING btree ("created_at");
  CREATE INDEX "_invoice_defaults_v_updated_at_idx" ON "_invoice_defaults_v" USING btree ("updated_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "clients_contacts" CASCADE;
  DROP TABLE "clients" CASCADE;
  DROP TABLE "clients_texts" CASCADE;
  DROP TABLE "invoices_line_items" CASCADE;
  DROP TABLE "invoices" CASCADE;
  DROP TABLE "bank_accounts" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "number_sequences" CASCADE;
  DROP TABLE "activity_log" CASCADE;
  DROP TABLE "services_costs" CASCADE;
  DROP TABLE "services" CASCADE;
  DROP TABLE "service_billings" CASCADE;
  DROP TABLE "payments" CASCADE;
  DROP TABLE "reminder_rules" CASCADE;
  DROP TABLE "invoice_reminders" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "quotes_scope_bullets" CASCADE;
  DROP TABLE "quotes_line_items" CASCADE;
  DROP TABLE "quotes" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "business_settings" CASCADE;
  DROP TABLE "_business_settings_v" CASCADE;
  DROP TABLE "invoice_defaults_column_layout" CASCADE;
  DROP TABLE "invoice_defaults" CASCADE;
  DROP TABLE "_invoice_defaults_v_version_column_layout" CASCADE;
  DROP TABLE "_invoice_defaults_v" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_timezone";
  DROP TYPE "public"."enum_users_locale";
  DROP TYPE "public"."enum_clients_default_currency";
  DROP TYPE "public"."enum_clients_default_due_mode";
  DROP TYPE "public"."enum_clients_default_qty_label";
  DROP TYPE "public"."enum_clients_status";
  DROP TYPE "public"."enum_invoices_status";
  DROP TYPE "public"."enum_invoices_due_mode";
  DROP TYPE "public"."enum_invoices_currency";
  DROP TYPE "public"."enum_invoices_qty_label";
  DROP TYPE "public"."enum_invoices_delivery_state";
  DROP TYPE "public"."enum_bank_accounts_currency";
  DROP TYPE "public"."enum_media_kind";
  DROP TYPE "public"."enum_number_sequences_kind";
  DROP TYPE "public"."enum_activity_log_entity_type";
  DROP TYPE "public"."enum_services_costs_currency";
  DROP TYPE "public"."enum_services_costs_period";
  DROP TYPE "public"."enum_services_kind";
  DROP TYPE "public"."enum_services_status";
  DROP TYPE "public"."enum_services_currency";
  DROP TYPE "public"."enum_services_billing_period";
  DROP TYPE "public"."enum_services_qty_label";
  DROP TYPE "public"."enum_payments_currency";
  DROP TYPE "public"."enum_payments_method";
  DROP TYPE "public"."enum_invoice_reminders_state";
  DROP TYPE "public"."enum_notifications_kind";
  DROP TYPE "public"."enum_quotes_status";
  DROP TYPE "public"."enum_quotes_currency";
  DROP TYPE "public"."enum_business_settings_tax_jurisdiction";
  DROP TYPE "public"."enum_business_settings_number_allocation_mode";
  DROP TYPE "public"."enum__business_settings_v_version_tax_jurisdiction";
  DROP TYPE "public"."enum__business_settings_v_version_number_allocation_mode";
  DROP TYPE "public"."enum_invoice_defaults_column_layout_key";
  DROP TYPE "public"."enum_invoice_defaults_column_layout_align";
  DROP TYPE "public"."enum_invoice_defaults_bank_details_placement";
  DROP TYPE "public"."enum__invoice_defaults_v_version_column_layout_key";
  DROP TYPE "public"."enum__invoice_defaults_v_version_column_layout_align";
  DROP TYPE "public"."enum__invoice_defaults_v_version_bank_details_placement";`)
}
