import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { SiteNotFoundError } from "./sites.errors.js";
import {
  findSiteById,
  findSiteByHandle,
  insertSiteIfMissing,
  listSiteRows,
} from "./sites.repository.js";
import type { Site } from "./sites.table.js";

/**
 * Every install starts with one site, the default. Installs from before multi-site have
 * only this one, and everything that isn't told which site to use means it.
 */
export const DEFAULT_SITE = {
  handle: "default",
  name: "Default site",
  domain: "localhost",
  locale: "en-GB",
};

export function isDefaultSite(site: Pick<Site, "handle">): boolean {
  return site.handle === DEFAULT_SITE.handle;
}

/** The default site, created the first time anything needs it. */
export async function findOrCreateDefaultSite(database: DatabaseOrTransaction): Promise<Site> {
  const existing = await findSiteByHandle(database, DEFAULT_TENANT_ID, DEFAULT_SITE.handle);
  if (existing) {
    return existing;
  }

  await insertSiteIfMissing(database, DEFAULT_SITE);
  const created = await findSiteByHandle(database, DEFAULT_TENANT_ID, DEFAULT_SITE.handle);
  if (!created) {
    throw new Error("The default site could not be created.");
  }
  return created;
}

/** The site given, or the default one when none is: what single-site code paths pass. */
export async function siteOrDefault(
  database: DatabaseOrTransaction,
  site: Site | undefined,
): Promise<Site> {
  return site ?? findOrCreateDefaultSite(database);
}

/** The site with this handle, or a 404 that names it. */
export async function findSiteOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<Site> {
  if (handle === DEFAULT_SITE.handle) {
    return findOrCreateDefaultSite(database);
  }
  const site = await findSiteByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!site) {
    throw new SiteNotFoundError(handle);
  }
  return site;
}

/** The site an entry or menu points at. A missing one means the database was edited by hand. */
export async function findSiteByIdOrFail(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<Site> {
  const site = await findSiteById(database, siteId);
  if (!site) {
    throw new Error(`The site ${siteId} is missing.`);
  }
  return site;
}

/** Every site, the default first (made if needed, so the list is never empty). */
export async function listAllSites(database: DatabaseOrTransaction): Promise<Site[]> {
  await findOrCreateDefaultSite(database);
  return listSiteRows(database, DEFAULT_TENANT_ID);
}
