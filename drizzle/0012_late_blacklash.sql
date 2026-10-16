CREATE TABLE "chest_price_overrides" (
	"item_key" text PRIMARY KEY NOT NULL,
	"unit_value" numeric(18, 2),
	"category" varchar(32) NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chest_override_nonnegative" CHECK ("chest_price_overrides"."unit_value" is null or "chest_price_overrides"."unit_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chest_storage" (
	"kind" varchar(12) PRIMARY KEY NOT NULL,
	"snapshot_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by" uuid NOT NULL,
	"items" jsonb NOT NULL,
	CONSTRAINT "chest_kind_valid" CHECK ("chest_storage"."kind" in ('event', 'store'))
);
--> statement-breakpoint
CREATE TABLE "loot_boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"box_number" varchar(12) NOT NULL,
	"contents" jsonb NOT NULL,
	"user_id" uuid,
	"assigned_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"fulfilled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loot_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"settings" jsonb NOT NULL,
	"plan" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loot_event_status" CHECK ("loot_events"."status" in ('draft', 'distributed'))
);
--> statement-breakpoint
CREATE TABLE "loot_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" varchar(16) NOT NULL,
	"quantity" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loot_purchase_positive" CHECK ("loot_purchases"."quantity" > 0 and "loot_purchases"."quantity" <= 1000)
);
--> statement-breakpoint
ALTER TABLE "chest_price_overrides" ADD CONSTRAINT "chest_price_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chest_storage" ADD CONSTRAINT "chest_storage_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_boxes" ADD CONSTRAINT "loot_boxes_event_id_loot_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."loot_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_boxes" ADD CONSTRAINT "loot_boxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_boxes" ADD CONSTRAINT "loot_boxes_fulfilled_by_users_id_fk" FOREIGN KEY ("fulfilled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_events" ADD CONSTRAINT "loot_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_purchases" ADD CONSTRAINT "loot_purchases_event_id_loot_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."loot_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_purchases" ADD CONSTRAINT "loot_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_purchases" ADD CONSTRAINT "loot_purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loot_event_box_unique" ON "loot_boxes" USING btree ("event_id","box_number");--> statement-breakpoint
CREATE INDEX "loot_box_recipient" ON "loot_boxes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loot_purchase_user_tier" ON "loot_purchases" USING btree ("event_id","user_id","tier");