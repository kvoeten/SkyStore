ALTER TABLE "recipes" ALTER COLUMN "submitted_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "catalog_version_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "source_stable_key" varchar(180);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "workbench_key" varchar(255);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "profession" varchar(80);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "conditions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "source_references" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_catalog_version_id_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."catalog_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_import_source_unique" ON "recipes" USING btree ("source_stable_key");