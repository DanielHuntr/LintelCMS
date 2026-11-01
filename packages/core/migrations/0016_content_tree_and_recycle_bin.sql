CREATE TABLE "recycle_bin_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"entry_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"parent_id" uuid,
	"title" text NOT NULL,
	"item_count" integer NOT NULL,
	"branch" jsonb NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "allowed_at_root" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "allowed_children" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "children_as_collection" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "list_columns" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recycle_bin_items" ADD CONSTRAINT "recycle_bin_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycle_bin_items" ADD CONSTRAINT "recycle_bin_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recycle_bin_items_tenant_deleted_idx" ON "recycle_bin_items" USING btree ("tenant_id","deleted_at");--> statement-breakpoint
CREATE INDEX "entries_parent_sort_idx" ON "entries" USING btree ("parent_id","sort_order");--> statement-breakpoint
-- Page trees already let pages go under pages; keep it that way now that it is a setting.
UPDATE "collections" SET "allowed_children" = jsonb_build_array("handle") WHERE "structure" = 'tree';
