import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findSiteByHandle, insertSiteIfMissing } from "./sites.repository.js";
import type { Site } from "./sites.table.js";

/**
 * Every install starts with one site. More sites (other domains or languages) come later;
 * until then, every entry belongs to this one.
 */
export const DEFAULT_SITE = {
  handle: "default",
  name: "Default site",
  domain: "localhost",
  locale: "en-GB",
};

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
