DROP INDEX "public_market_reports_item_time_idx";--> statement-breakpoint
ALTER TABLE "public_market_reports" ADD COLUMN "source_location" varchar(180);--> statement-breakpoint
ALTER TABLE "public_market_reports" ADD COLUMN "occurrence_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "public_market_reports_item_time_idx" ON "public_market_reports" USING btree ("item_id","location_type","occurrence_at");