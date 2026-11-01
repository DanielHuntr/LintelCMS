import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type NewSite, type Site, sitesTable } from "./sites.table.js";

/** Database reads and writes for sites, nothing else. */

export async function findSiteByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Site | undefined> {
  const [site] = await database
    .select()
    .from(sitesTable)
    .where(and(eq(sitesTable.tenantId, tenantId), eq(sitesTable.handle, handle)))
    .limit(1);
  return site;
}

/** Inserts the site unless one with its handle exists. */
export async function insertSiteIfMissing(
  database: DatabaseOrTransaction,
  site: NewSite,
): Promise<void> {
  await database
    .insert(sitesTable)
    .values(site)
    .onConflictDoNothing({ target: [sitesTable.tenantId, sitesTable.handle] });
}
