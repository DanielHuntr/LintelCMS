DROP INDEX "entries_slug_idx";--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "published_data" jsonb;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_collection_site_slug_unique" ON "entries" USING btree ("tenant_id","collection_id","site_id","slug");--> statement-breakpoint
CREATE INDEX "entries_status_scheduled_for_idx" ON "entries" USING btree ("status","scheduled_for");