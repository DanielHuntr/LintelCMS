import { integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";

/** Hooks for agencies to rebrand a site's admin and website: a logo and an accent colour. */
export interface SiteBranding {
  /** An image from the media library. */
  logoAssetId: string | null;
  /** A hex colour such as "#7539fd". */
  accentColor: string | null;
}

/**
 * A site is one website served by this install: "Acme UK" and "Acme France" are two rows.
 * Each has its own languages (in `site_locales`), entries, menus and global values.
 *
 * - `handle` names the site in the API (`?site=acme_uk`). The first site's is "default"
 *   and it can't be deleted; installs from before multi-site have only that one.
 * - `hostnames` are the domains the site answers on ("acme.co.uk", "www.acme.co.uk").
 *   With `pathPrefix` ("/fr"), several sites can share one domain.
 * - `domain` is the first hostname, kept for code written before sites had several.
 * - `siteUrl` is the public address, such as "https://acme.co.uk", for sitemaps and links.
 * - `locale` is the main language; `fallbackLocale` is shown when a translation is missing.
 */
export const sitesTable = pgTable(
  "sites",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    hostnames: text("hostnames").array().notNull().default([]),
    pathPrefix: text("path_prefix").notNull().default(""),
    siteUrl: text("site_url").notNull().default(""),
    locale: text("locale").notNull().default("en-GB"),
    fallbackLocale: text("fallback_locale"),
    branding: jsonb("branding")
      .$type<SiteBranding>()
      .notNull()
      .default({ logoAssetId: null, accentColor: null }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (table) => [uniqueIndex("sites_tenant_handle_unique").on(table.tenantId, table.handle)],
);

export type Site = typeof sitesTable.$inferSelect;
export type NewSite = typeof sitesTable.$inferInsert;
