CREATE TABLE "wordpress_import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"import_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_id" text NOT NULL,
	"position" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"target_id" uuid,
	"message" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wordpress_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"filename" text NOT NULL,
	"site_title" text DEFAULT '' NOT NULL,
	"site_address" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"found" jsonb NOT NULL,
	"mapping" jsonb,
	"progress" jsonb DEFAULT '{"done":0,"total":0}'::jsonb NOT NULL,
	"content_zip_file" text,
	"started_by" uuid,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wordpress_import_items" ADD CONSTRAINT "wordpress_import_items_import_id_wordpress_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."wordpress_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wordpress_import_items_source_unique" ON "wordpress_import_items" USING btree ("import_id","kind","source_id");--> statement-breakpoint
CREATE INDEX "wordpress_import_items_position_idx" ON "wordpress_import_items" USING btree ("import_id","status","position");--> statement-breakpoint
CREATE INDEX "wordpress_imports_tenant_created_idx" ON "wordpress_imports" USING btree ("tenant_id","created_at");