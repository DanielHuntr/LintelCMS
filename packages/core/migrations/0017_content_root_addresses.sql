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
ALTER TABLE "content_root_addresses" ADD CONSTRAINT "content_root_addresses_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_root_addresses_entry_unique" ON "content_root_addresses" USING btree ("tenant_id","entry_id");