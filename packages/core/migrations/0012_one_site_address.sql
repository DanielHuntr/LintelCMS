-- The site's address is kept once, as the "siteAddress" setting (Settings → Site). Sites that
-- typed it in the SEO settings keep it: it moves across unless an address is already saved.
INSERT INTO "settings" ("tenant_id", "key", "value")
SELECT "tenant_id", 'siteAddress', "value" -> 'siteUrl'
FROM "settings"
WHERE "key" = 'seoDefaults' AND coalesce("value" ->> 'siteUrl', '') <> ''
ON CONFLICT ("tenant_id", "key") DO UPDATE SET "value" = EXCLUDED."value"
WHERE "settings"."value" = '""'::jsonb;--> statement-breakpoint
UPDATE "settings" SET "value" = "value" - 'siteUrl' WHERE "key" = 'seoDefaults';
