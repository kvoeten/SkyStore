CREATE TABLE "custom_ledger_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitted_by" uuid,
	"contributor_display_name" varchar(120) NOT NULL,
	"source_url" text,
	"plaintext" text,
	"file_name" varchar(255),
	"file_path" text,
	"mime_type" varchar(160),
	"file_size" integer,
	"status" "approval_decision" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_ledger_submissions" ADD CONSTRAINT "custom_ledger_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_ledger_submissions" ADD CONSTRAINT "custom_ledger_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_ledger_submissions_queue_idx" ON "custom_ledger_submissions" USING btree ("status","created_at");