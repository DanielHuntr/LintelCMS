DROP INDEX "global_values_set_locale_unique";--> statement-breakpoint
DROP INDEX "navigations_tenant_handle_unique";--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "site_scope" text DEFAULT 'per-site' NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "site_ids" uuid[];--> statement-breakpoint
ALTER TABLE "global_values" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "navigations" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "site_ids" uuid[];--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "hostnames" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "path_prefix" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "site_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "branding" jsonb DEFAULT '{"logoAssetId":null,"accentColor":null}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "taxonomies" ADD COLUMN "site_id" uuid;--> statement-breakpoint
-- Menus and global values existed before sites had them: they belong to the default site,
-- made here for installs that never needed it before.
INSERT INTO "sites" ("tenant_id", "handle", "name", "domain", "locale")
SELECT DISTINCT "owners"."tenant_id", 'default', 'Default site', 'localhost', 'en-GB'
FROM (
  SELECT "tenant_id" FROM "navigations" UNION SELECT "tenant_id" FROM "global_values"
) AS "owners"
ON CONFLICT ("tenant_id", "handle") DO NOTHING;--> statement-breakpoint
UPDATE "navigations" SET "site_id" = "sites"."id" FROM "sites"
WHERE "sites"."tenant_id" = "navigations"."tenant_id" AND "sites"."handle" = 'default';--> statement-breakpoint
UPDATE "global_values" SET "site_id" = "sites"."id" FROM "sites"
WHERE "sites"."tenant_id" = "global_values"."tenant_id" AND "sites"."handle" = 'default';--> statement-breakpoint
UPDATE "sites" SET "hostnames" = ARRAY["domain"] WHERE "domain" <> 'localhost';--> statement-breakpoint
ALTER TABLE "navigations" ALTER COLUMN "site_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "global_values" ALTER COLUMN "site_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_values" ADD CONSTRAINT "global_values_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigations" ADD CONSTRAINT "navigations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomies" ADD CONSTRAINT "taxonomies_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "global_values_set_site_locale_unique" ON "global_values" USING btree ("global_set_id","site_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "navigations_site_handle_unique" ON "navigations" USING btree ("tenant_id","site_id","handle");