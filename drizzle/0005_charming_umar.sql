CREATE TYPE "public"."public_market_report_location" AS ENUM('store_sale', 'street_sale');--> statement-breakpoint
ALTER TYPE "public"."approval_target" ADD VALUE 'public_market_report';--> statement-breakpoint
CREATE TABLE "public_market_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"total_septims" integer NOT NULL,
	"location_type" "public_market_report_location" NOT NULL,
	"note" text,
	"submitted_by" uuid NOT NULL,
	"contributor_display_name" varchar(120) NOT NULL,
	"status" "approval_decision" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"quarantined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_market_report_positive_quantity" CHECK ("public_market_reports"."quantity" > 0),
	CONSTRAINT "public_market_report_nonnegative_total" CHECK ("public_market_reports"."total_septims" >= 0)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" varchar(120);--> statement-breakpoint
ALTER TABLE "public_market_reports" ADD CONSTRAINT "public_market_reports_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_market_reports" ADD CONSTRAINT "public_market_reports_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_market_reports" ADD CONSTRAINT "public_market_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_market_reports_queue_idx" ON "public_market_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "public_market_reports_item_time_idx" ON "public_market_reports" USING btree ("item_id","location_type","created_at");--> statement-breakpoint
CREATE INDEX "public_market_reports_submitter_idx" ON "public_market_reports" USING btree ("submitted_by","created_at");