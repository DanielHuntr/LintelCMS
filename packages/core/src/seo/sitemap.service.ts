import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { readAddressForSite } from "../sites/site-address.service.js";
import { SiteAddressMissingError } from "./seo.errors.js";
import { addPathPrefix } from "../sites/site-addresses.js";
import { findOrCreateDefaultSite, isDefaultSite, siteOrDefault } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { readSeoDefaults } from "./seo-defaults.service.js";
import { listSitemapEntryRows, type SitemapEntryRow } from "./seo.repository.js";
import { buildRobotsTxt, buildSitemapXml, MAX_SITEMAP_PAGES } from "./sitemap.js";

/**
 * `site` is the site whose pages are listed, the default site when left out. Its address is
 * its own (Settings → Sites), or for the default site the one from Settings → Your website.
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
  const pages = rows.flatMap((row) => {
    const entryPath = addPathPrefix(site.pathPrefix, buildEntryUrl(row.routePattern, row));
    const path =
      entryPath === null || !options.pathFor ? entryPath : options.pathFor(row, entryPath);
    if (row.noindex === true || path === null) {
      return [];
    }
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
