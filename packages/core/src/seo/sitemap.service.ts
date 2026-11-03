import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { placeEntryUrls } from "../content-roots/content-roots.service.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { readAddressForSite } from "../sites/site-address.service.js";
import { SiteAddressMissingError } from "./seo.errors.js";
import { findOrCreateDefaultSite, isDefaultSite, siteOrDefault } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { readSeoDefaults } from "./seo-defaults.service.js";
import { listSitemapEntryRows, type SitemapEntryRow } from "./seo.repository.js";
import { buildRobotsTxt, buildSitemapXml, MAX_SITEMAP_PAGES } from "./sitemap.js";

/**
 * `site` is the site whose pages are listed, the default site when left out. Its address is
 * its own (Build → Websites and domains), or for the default site the one from Settings → Your website.
 * `fallbackSiteUrl` is the built-in website's own address, used when neither has been typed;
 * a website served by Lintel itself also adjusts the paths (language prefixes, the home page
 * at "/").
 */
export interface SitemapOptions {
  site?: Site | undefined;
  fallbackSiteUrl?: string | null;
  pathFor?: (row: SitemapEntryRow, path: string) => string;
}

/**
 * sitemap.xml lists every published entry of one site that has a page, except those marked
 * "hide from search engines". It needs the site's address, since sitemaps hold full URLs.
 * Each site has its own; the default site's is served when none is asked for.
 */
export async function buildSitemap(
  database: DatabaseOrTransaction,
  options: SitemapOptions = {},
): Promise<string> {
  const site = await siteOrDefault(database, options.site);
  const siteUrl = (await readAddressForSite(database, site)) || options.fallbackSiteUrl;
  if (!siteUrl) {
    throw new SiteAddressMissingError(isDefaultSite(site) ? undefined : site.name);
  }
  const defaultSite = await findOrCreateDefaultSite(database);
  const rows = await listSitemapEntryRows(database, DEFAULT_TENANT_ID, MAX_SITEMAP_PAGES, {
    siteId: site.id,
    defaultSiteId: defaultSite.id,
  });
  const urls = await placeEntryUrls(
    database,
    rows.map((row) => ({ id: row.id, url: buildEntryUrl(row.routePattern, row) })),
    { site },
  );
  const pages = rows.flatMap((row) => {
    const entryPath = urls.get(row.id) ?? null;
    if (row.noindex === true || entryPath === null) {
      return [];
    }
    // A page under a site start with its own domain has a full address already.
    if (!entryPath.startsWith("/")) {
      return [{ location: entryPath, lastModified: row.publishedAt ?? row.updatedAt }];
    }
    const path = options.pathFor ? options.pathFor(row, entryPath) : entryPath;
    return [{ location: `${siteUrl}${path}`, lastModified: row.publishedAt ?? row.updatedAt }];
  });
  return buildSitemapXml(pages);
}

export async function buildRobots(
  database: DatabaseOrTransaction,
  options: Pick<SitemapOptions, "site" | "fallbackSiteUrl"> = {},
): Promise<string> {
  const site = await siteOrDefault(database, options.site);
  const defaults = await readSeoDefaults(database);
  const siteUrl = (await readAddressForSite(database, site)) || options.fallbackSiteUrl;
  return buildRobotsTxt({
    discourageSearchEngines: defaults.discourageSearchEngines,
    sitemapUrl: siteUrl ? `${siteUrl}${site.pathPrefix}/sitemap.xml` : null,
  });
}
