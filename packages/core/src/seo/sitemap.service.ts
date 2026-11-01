import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { readSiteAddress } from "../sites/site-address.service.js";
import { SiteAddressMissingError } from "./seo.errors.js";
import { readSeoDefaults } from "./seo-defaults.service.js";
import { listSitemapEntryRows, type SitemapEntryRow } from "./seo.repository.js";
import { buildRobotsTxt, buildSitemapXml, MAX_SITEMAP_PAGES } from "./sitemap.js";

/**
 * The address is the one from Settings → Your website. `fallbackSiteUrl` is the built-in website's
 * own address, used when none has been typed; a website served by Lintel itself also
 * adjusts the paths (language prefixes, the home page at "/").
 */
export interface SitemapOptions {
  fallbackSiteUrl?: string | null;
  pathFor?: (row: SitemapEntryRow, path: string) => string;
}

/**
 * sitemap.xml lists every published entry that has a page, except those marked
 * "hide from search engines". It needs the site's address, since sitemaps hold full URLs.
 */
export async function buildSitemap(
  database: DatabaseOrTransaction,
  options: SitemapOptions = {},
): Promise<string> {
  const siteUrl = (await readSiteAddress(database)) || options.fallbackSiteUrl;
  if (!siteUrl) {
    throw new SiteAddressMissingError();
  }
  const rows = await listSitemapEntryRows(database, DEFAULT_TENANT_ID, MAX_SITEMAP_PAGES);
  const pages = rows.flatMap((row) => {
    const entryPath = buildEntryUrl(row.routePattern, row);
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
  options: Pick<SitemapOptions, "fallbackSiteUrl"> = {},
): Promise<string> {
  const defaults = await readSeoDefaults(database);
  const siteUrl = (await readSiteAddress(database)) || options.fallbackSiteUrl;
  return buildRobotsTxt({
    discourageSearchEngines: defaults.discourageSearchEngines,
    sitemapUrl: siteUrl ? `${siteUrl}/sitemap.xml` : null,
  });
}
