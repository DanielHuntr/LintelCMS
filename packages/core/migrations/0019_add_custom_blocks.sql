CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'square' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'site' NOT NULL,
	"properties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"design" jsonb,
	"template" text,
	"renamed_properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_tenant_handle_unique" ON "blocks" USING btree ("tenant_id","handle");