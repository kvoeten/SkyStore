CREATE TYPE "public"."approval_decision" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."approval_target" AS ENUM('receipt', 'observation', 'recipe', 'stock_correction');--> statement-breakpoint
CREATE TYPE "public"."catalog_status" AS ENUM('staged', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."global_role" AS ENUM('user', 'platform_admin');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('active', 'retired', 'merged');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."market_side" AS ENUM('store_pays', 'customer_pays');--> statement-breakpoint
CREATE TYPE "public"."observation_kind" AS ENUM('seen_listing', 'direct_quote', 'hearsay');--> statement-breakpoint
CREATE TYPE "public"."receipt_direction" AS ENUM('store_purchase', 'store_sale');--> statement-breakpoint
CREATE TYPE "public"."receipt_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'voided');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_kind" AS ENUM('receipt', 'correction', 'approval_transfer', 'rejection_reversal', 'void_reversal');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_state" AS ENUM('provisional', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."store_role" AS ENUM('clerk', 'manager', 'owner');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('unverified', 'verified');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"token_type" varchar(255),
	"scope" varchar(255),
	"access_token" text,
	"expires_at" integer,
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "agreement_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"agreement_version" varchar(64) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"target_type" "approval_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"decision" "approval_decision" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"store_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"alias" varchar(255) NOT NULL,
	"normalized_alias" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"url" text NOT NULL,
	"kind" varchar(32) DEFAULT 'fallback' NOT NULL,
	"is_fallback" boolean DEFAULT false NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_version_id" uuid,
	"stable_key" varchar(180) NOT NULL,
	"plugin" varchar(128),
	"local_form_id" varchar(16),
	"display_name" varchar(255) NOT NULL,
	"editor_id" varchar(255),
	"record_type" varchar(32) NOT NULL,
	"category" varchar(80) NOT NULL,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"merged_into_id" uuid,
	"value" integer,
	"weight" numeric(10, 3),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "catalog_items_stable_key_unique" UNIQUE("stable_key")
);
--> statement-breakpoint
CREATE TABLE "catalog_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(80) NOT NULL,
	"status" "catalog_status" DEFAULT 'staged' NOT NULL,
	"source_load_order_hash" varchar(128) NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "delayed_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" timestamp with time zone NOT NULL,
	"source_cutoff_at" timestamp with time zone NOT NULL,
	"catalog_version_id" uuid,
	"payload" jsonb NOT NULL,
	"checksum" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "derived_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"side" "market_side" NOT NULL,
	"audience" varchar(16) NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"median" numeric(14, 4),
	"lower_quartile" numeric(14, 4),
	"upper_quartile" numeric(14, 4),
	"signal_count" integer NOT NULL,
	"store_count" integer NOT NULL,
	"newest_evidence_at" timestamp with time zone,
	"confidence" numeric(5, 4) NOT NULL,
	"source_cutoff_at" timestamp with time zone,
	CONSTRAINT "signal_audience" CHECK ("derived_signals"."audience" in ('private', 'public'))
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(120),
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_attempts_bounds" CHECK ("jobs"."attempts" >= 0 and "jobs"."max_attempts" > 0)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"store_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "store_role" DEFAULT 'clerk' NOT NULL,
	"trust" "trust_level" DEFAULT 'unverified' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "memberships_store_id_user_id_pk" PRIMARY KEY("store_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"item_id" uuid NOT NULL,
	"side" "market_side" NOT NULL,
	"kind" "observation_kind" NOT NULL,
	"quantity" integer NOT NULL,
	"total_septims" integer NOT NULL,
	"source_location" varchar(180),
	"occurrence_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"submitted_by" uuid NOT NULL,
	"approval" "approval_decision" DEFAULT 'pending' NOT NULL,
	"quarantined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observation_positive_quantity" CHECK ("observations"."quantity" > 0),
	CONSTRAINT "observation_nonnegative_total" CHECK ("observations"."total_septims" >= 0)
);
--> statement-breakpoint
CREATE TABLE "official_price_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"item_id" uuid NOT NULL,
	"side" "market_side" NOT NULL,
	"minimum_septims" integer NOT NULL,
	"maximum_septims" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"maximum_quantity" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source_label" varchar(180) NOT NULL,
	"provenance_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_rule_range" CHECK ("official_price_rules"."minimum_septims" >= 0 and "official_price_rules"."maximum_septims" >= "official_price_rules"."minimum_septims"),
	CONSTRAINT "price_rule_quantity" CHECK ("official_price_rules"."quantity" > 0 and "official_price_rules"."maximum_quantity" >= "official_price_rules"."quantity")
);
--> statement-breakpoint
CREATE TABLE "receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"total_septims" integer NOT NULL,
	"sequence" integer NOT NULL,
	CONSTRAINT "receipt_line_positive_quantity" CHECK ("receipt_lines"."quantity" > 0),
	CONSTRAINT "receipt_line_nonnegative_total" CHECK ("receipt_lines"."total_septims" >= 0)
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"direction" "receipt_direction" NOT NULL,
	"status" "receipt_status" DEFAULT 'draft' NOT NULL,
	"occurrence_at" timestamp with time zone NOT NULL,
	"counterparty_label" varchar(160),
	"notes" text,
	"total_septims" integer NOT NULL,
	"submitted_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_total_nonnegative" CHECK ("receipts"."total_septims" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"recipe_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "recipe_ingredients_recipe_id_item_id_pk" PRIMARY KEY("recipe_id","item_id"),
	CONSTRAINT "recipe_ingredient_positive" CHECK ("recipe_ingredients"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"output_item_id" uuid NOT NULL,
	"output_yield" integer DEFAULT 1 NOT NULL,
	"mastery_tier" varchar(80),
	"labor_fee" integer DEFAULT 0 NOT NULL,
	"submitted_by" uuid NOT NULL,
	"store_id" uuid,
	"approval" "approval_decision" DEFAULT 'pending' NOT NULL,
	"is_catalog_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_positive_yield" CHECK ("recipes"."output_yield" > 0),
	CONSTRAINT "recipes_nonnegative_labor" CHECK ("recipes"."labor_fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"receipt_id" uuid,
	"kind" "stock_movement_kind" NOT NULL,
	"state" "stock_movement_state" NOT NULL,
	"quantity_delta" integer NOT NULL,
	"reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_nonzero" CHECK ("stock_movements"."quantity_delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"owner_id" uuid NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"target_markup_bps" integer DEFAULT 2500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_slug_unique" UNIQUE("slug"),
	CONSTRAINT "stores_markup_bounds" CHECK ("stores"."target_markup_bps" between 0 and 100000)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" varchar(32),
	"name" varchar(128),
	"email" varchar(255),
	"email_verified" timestamp with time zone,
	"image" text,
	"global_role" "global_role" DEFAULT 'user' NOT NULL,
	"quarantined_at" timestamp with time zone,
	"quarantine_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_aliases" ADD CONSTRAINT "catalog_aliases_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_catalog_version_id_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."catalog_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delayed_snapshots" ADD CONSTRAINT "delayed_snapshots_catalog_version_id_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."catalog_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_signals" ADD CONSTRAINT "derived_signals_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_price_rules" ADD CONSTRAINT "official_price_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_price_rules" ADD CONSTRAINT "official_price_rules_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_price_rules" ADD CONSTRAINT "official_price_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_output_item_id_catalog_items_id_fk" FOREIGN KEY ("output_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_acceptance_once" ON "agreement_acceptances" USING btree ("store_id","user_id","agreement_version");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_target_unique" ON "approvals" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "approvals_queue_idx" ON "approvals" USING btree ("store_id","decision","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_store_time_idx" ON "audit_events" USING btree ("store_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_aliases_normalized_unique" ON "catalog_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE INDEX "catalog_aliases_item_idx" ON "catalog_aliases" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "catalog_images_item_idx" ON "catalog_images" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "catalog_items_name_idx" ON "catalog_items" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "catalog_items_category_idx" ON "catalog_items" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_items_plugin_form_idx" ON "catalog_items" USING btree ("plugin","local_form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delayed_snapshot_date_unique" ON "delayed_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "derived_signals_lookup_idx" ON "derived_signals" USING btree ("item_id","side","audience","computed_at");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "observations_item_side_time_idx" ON "observations" USING btree ("item_id","side","occurrence_at");--> statement-breakpoint
CREATE INDEX "official_price_lookup_idx" ON "official_price_rules" USING btree ("item_id","side","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_lines_sequence_unique" ON "receipt_lines" USING btree ("receipt_id","sequence");--> statement-breakpoint
CREATE INDEX "receipt_lines_item_idx" ON "receipt_lines" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "receipts_store_time_idx" ON "receipts" USING btree ("store_id","occurrence_at");--> statement-breakpoint
CREATE INDEX "receipts_status_idx" ON "receipts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recipes_output_idx" ON "recipes" USING btree ("output_item_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_movements_balance_idx" ON "stock_movements" USING btree ("store_id","item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movement_receipt_posting_once" ON "stock_movements" USING btree ("receipt_id","item_id","kind","state");