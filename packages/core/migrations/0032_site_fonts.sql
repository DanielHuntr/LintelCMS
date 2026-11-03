CREATE TABLE "site_fonts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"site_id" uuid NOT NULL,
	"family" text NOT NULL,
	"category" text DEFAULT 'sans' NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"licence_confirmed_at" timestamp with time zone,
	"licence_confirmed_by" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_fonts" ADD CONSTRAINT "site_fonts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_fonts_site_family_unique" ON "site_fonts" USING btree ("tenant_id","site_id","family");