CREATE TABLE "content_root_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"entry_id" uuid NOT NULL,
	"hostname" text DEFAULT '' NOT NULL,
	"path_prefix" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "content_root_addresses" ADD CONSTRAINT "content_root_addresses_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycle_bin_items" ADD CONSTRAINT "recycle_bin_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycle_bin_items" ADD CONSTRAINT "recycle_bin_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_root_addresses_entry_unique" ON "content_root_addresses" USING btree ("tenant_id","entry_id");--> statement-breakpoint
CREATE INDEX "recycle_bin_items_tenant_deleted_idx" ON "recycle_bin_items" USING btree ("tenant_id","deleted_at");--> statement-breakpoint
CREATE INDEX "entries_parent_sort_idx" ON "entries" USING btree ("parent_id","sort_order");--> statement-breakpoint
-- Page trees already let pages go under pages; keep it that way now that it is a setting.
UPDATE "collections" SET "allowed_children" = jsonb_build_array("handle") WHERE "structure" = 'tree';
--> statement-breakpoint
-- Page addresses follow the tree now ("/about/team"). The website sends the old flat
-- address ("/team") on to the new one.
UPDATE "collections" SET "route_pattern" = '/{path}' WHERE "structure" = 'tree' AND "route_pattern" = '/{slug}';
