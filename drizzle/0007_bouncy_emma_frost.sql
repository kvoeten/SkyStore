ALTER TABLE "catalog_items" ADD COLUMN "market_category" varchar(80);--> statement-breakpoint
CREATE INDEX "catalog_items_market_category_idx" ON "catalog_items" USING btree ("market_category");