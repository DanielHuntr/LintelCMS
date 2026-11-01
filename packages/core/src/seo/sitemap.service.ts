import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { SiteAddressMissingError } from "./seo.errors.js";
import { addPathPrefix } from "../sites/site-addresses.js";
import { findOrCreateDefaultSite, isDefaultSite, siteOrDefault } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { readSeoDefaults, siteAddressFor } from "./seo-defaults.service.js";
import { listSitemapEntryRows } from "./seo.repository.js";
import { buildRobotsTxt, buildSitemapXml, MAX_SITEMAP_PAGES } from "./sitemap.js";

/**
 * sitemap.xml lists every published entry of one site that has a page, except those marked
 * "hide from search engines". It needs the site's address, since sitemaps hold full URLs.
 * Each site has its own; the default site's is served when none is asked for.
 */
export async function buildSitemap(
  database: DatabaseOrTransaction,
  forSite?: Site,
): Promise<string> {
  const site = await siteOrDefault(database, forSite);
  const siteUrl = siteAddressFor(site, await readSeoDefaults(database));
  if (!siteUrl) {
    throw new SiteAddressMissingError(isDefaultSite(site) ? undefined : site.name);
  }
  const defaultSite = await findOrCreateDefaultSite(database);
  const rows = await listSitemapEntryRows(database, DEFAULT_TENANT_ID, MAX_SITEMAP_PAGES, {
    siteId: site.id,
    defaultSiteId: defaultSite.id,
  });
  const pages = rows.flatMap((row) => {
    const path = addPathPrefix(site.pathPrefix, buildEntryUrl(row.routePattern, row));
    if (row.noindex === true || path === null) {
      return [];
    }
    return [{ location: `${siteUrl}${path}`, lastModified: row.publishedAt ?? row.updatedAt }];
  });
  return buildSitemapXml(pages);
}

export async function buildRobots(
  database: DatabaseOrTransaction,
  forSite?: Site,
): Promise<string> {
  const site = await siteOrDefault(database, forSite);
  const defaults = await readSeoDefaults(database);
  const siteUrl = siteAddressFor(site, defaults);
  return buildRobotsTxt({
    discourageSearchEngines: defaults.discourageSearchEngines,
    sitemapUrl: siteUrl ? `${siteUrl}${site.pathPrefix}/sitemap.xml` : null,
  });
}
