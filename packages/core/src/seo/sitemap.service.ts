import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { readSiteAddress } from "../sites/site-address.service.js";
import { SiteAddressMissingError } from "./seo.errors.js";
import { readSeoDefaults } from "./seo-defaults.service.js";
import { listSitemapEntryRows } from "./seo.repository.js";
import { buildRobotsTxt, buildSitemapXml, MAX_SITEMAP_PAGES } from "./sitemap.js";

/**
 * sitemap.xml lists every published entry that has a page, except those marked
 * "hide from search engines". It needs the site's address, since sitemaps hold full URLs.
 */
export async function buildSitemap(database: DatabaseOrTransaction): Promise<string> {
  const defaults = await readSeoDefaults(database);
  // The SEO settings' own address wins; otherwise the site address from Settings → Site.
  const siteUrl = defaults.siteUrl || (await readSiteAddress(database));
  if (!siteUrl) {
    throw new SiteAddressMissingError();
  }
  const rows = await listSitemapEntryRows(database, DEFAULT_TENANT_ID, MAX_SITEMAP_PAGES);
  const pages = rows.flatMap((row) => {
    const path = buildEntryUrl(row.routePattern, row);
    if (row.noindex === true || path === null) {
      return [];
    }
    return [{ location: `${siteUrl}${path}`, lastModified: row.publishedAt ?? row.updatedAt }];
  });
  return buildSitemapXml(pages);
}

export async function buildRobots(database: DatabaseOrTransaction): Promise<string> {
  const defaults = await readSeoDefaults(database);
  const siteUrl = defaults.siteUrl || (await readSiteAddress(database));
  return buildRobotsTxt({
    discourageSearchEngines: defaults.discourageSearchEngines,
    sitemapUrl: siteUrl ? `${siteUrl}/sitemap.xml` : null,
  });
}
