import { findSiteIdForSiteStartHost } from "../content-roots/content-roots.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { matchSiteForAddress, removePathPrefix } from "../sites/site-addresses.js";
import { isDefaultSite, listAllSites } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";

/**
 * Which site a visit to the built-in website is for: the one whose domains (and path
 * prefix, when it has one) match the address, else the default site. Each site then gets
 * its own pages, menus, global values, languages and sitemap; see README.md for what the
 * sites share.
 */
export async function findSiteForAddress(
  database: DatabaseOrTransaction,
  address: { host: string | undefined; path: string },
): Promise<{ site: Site; path: string }> {
  const sites = await listAllSites(database);
  const matched =
    sites.length > 1 && address.host
      ? matchSiteForAddress(sites, { host: address.host, path: address.path })
      : undefined;
  // A page at the top of a tree may have a domain of its own ("Hostnames"); its site answers there.
  const startSiteId =
    matched === undefined && sites.length > 1 && address.host
      ? await findSiteIdForSiteStartHost(database, address.host)
      : undefined;
  const site =
    matched ??
    sites.find((candidate) => candidate.id === startSiteId) ??
    sites.find(isDefaultSite) ??
    sites[0];
  if (!site) {
    throw new Error("There is no site to show");
  }
  // On a site start's own domain the site's prefix doesn't apply.
  if (startSiteId !== undefined && site.id === startSiteId) {
    return { site, path: address.path };
  }
  // "/fr/about" on a site served under /fr is that site's "/about".
  return { site, path: removePathPrefix(site.pathPrefix, address.path) };
}
