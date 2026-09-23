CREATE TABLE "base_cost_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"total_septims" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source_label" varchar(180) NOT NULL,
	"provenance_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "base_cost_nonnegative" CHECK ("base_cost_rules"."total_septims" >= 0),
	CONSTRAINT "base_cost_quantity_positive" CHECK ("base_cost_rules"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "base_cost_rules" ADD CONSTRAINT "base_cost_rules_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "base_cost_lookup_idx" ON "base_cost_rules" USING btree ("item_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "base_cost_rule_identity_unique" ON "base_cost_rules" USING btree ("item_id","effective_from","source_label");