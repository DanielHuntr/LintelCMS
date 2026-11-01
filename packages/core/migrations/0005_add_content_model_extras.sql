CREATE TABLE "global_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"global_set_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"max_depth" integer DEFAULT 3 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"site_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"taxonomy_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "entries_collection_site_slug_unique";--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "locale" text DEFAULT 'en-GB' NOT NULL;--> statement-breakpoint
UPDATE "entries" SET "locale" = "sites"."locale" FROM "sites" WHERE "entries"."site_id" = "sites"."id";--> statement-breakpoint
ALTER TABLE "global_values" ADD CONSTRAINT "global_values_global_set_id_global_sets_id_fk" FOREIGN KEY ("global_set_id") REFERENCES "public"."global_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_values" ADD CONSTRAINT "global_values_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_locales" ADD CONSTRAINT "site_locales_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_taxonomy_id_taxonomies_id_fk" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."taxonomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "global_sets_tenant_handle_unique" ON "global_sets" USING btree ("tenant_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "global_values_set_locale_unique" ON "global_values" USING btree ("global_set_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "navigations_tenant_handle_unique" ON "navigations" USING btree ("tenant_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "site_locales_site_code_unique" ON "site_locales" USING btree ("site_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomies_tenant_handle_unique" ON "taxonomies" USING btree ("tenant_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_taxonomy_slug_unique" ON "terms" USING btree ("tenant_id","taxonomy_id","slug");--> statement-breakpoint
CREATE INDEX "terms_taxonomy_idx" ON "terms" USING btree ("taxonomy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_collection_site_locale_slug_unique" ON "entries" USING btree ("tenant_id","collection_id","site_id","locale","slug");--> statement-breakpoint
CREATE INDEX "entries_origin_idx" ON "entries" USING btree ("origin_id");