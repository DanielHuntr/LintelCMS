CREATE TABLE "client_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"entry_id" uuid NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"requested_by" uuid,
	"request_note" text DEFAULT '' NOT NULL,
	"decided_by" uuid,
	"decision_note" text DEFAULT '' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_reviews_entry_idx" ON "client_reviews" USING btree ("entry_id","created_at");--> statement-breakpoint
CREATE INDEX "client_reviews_status_idx" ON "client_reviews" USING btree ("tenant_id","status");--> statement-breakpoint
-- Designing pages became a permission of its own (builder:design). Custom roles that could
-- edit content could design too, so they keep it.
UPDATE "roles" SET "permissions" = array_append("permissions", 'builder:design')
WHERE "is_built_in" = false
  AND NOT ('builder:design' = ANY("permissions"))
  AND "permissions" && ARRAY['*', 'entries:*', 'entries:update', 'entries:update-own', 'entries:create']::text[];
