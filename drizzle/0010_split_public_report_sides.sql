-- Existing public reports were historically treated as customer-paid prices.
-- Preserve that interpretation while allowing all future reports to state the
-- trade side explicitly.
ALTER TABLE "public_market_reports" ADD COLUMN "side" "market_side" DEFAULT 'customer_pays' NOT NULL;
--> statement-breakpoint
DROP INDEX "public_market_reports_item_time_idx";
--> statement-breakpoint
CREATE INDEX "public_market_reports_item_time_idx" ON "public_market_reports" USING btree ("item_id","side","occurrence_at");
