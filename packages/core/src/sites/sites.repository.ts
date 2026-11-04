import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import { type NewSite, type Site, sitesTable as sitesDefinition } from "./sites.table.js";
import { insertIfNewReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for sites, nothing else. */

export type SiteWithEntryCount = Site & { entryCount: number };

export async function findSiteByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Site | undefined> {
  const sitesTable = tableFor(database, sitesDefinition);
  const [site] = await database
    .select()
    .from(sitesTable)
    .where(and(eq(sitesTable.tenantId, tenantId), eq(sitesTable.handle, handle)))
    .limit(1);
  return site;
}

export async function findSiteById(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<Site | undefined> {
  const sitesTable = tableFor(database, sitesDefinition);
  const [site] = await database.select().from(sitesTable).where(eq(sitesTable.id, siteId)).limit(1);
  return site;
}

/** Every site, in the order the admin lists them: the default first, then by when added. */
export async function listSiteRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Site[]> {
  const sitesTable = tableFor(database, sitesDefinition);
  return database
    .select()
    .from(sitesTable)
    .where(eq(sitesTable.tenantId, tenantId))
    .orderBy(asc(sitesTable.sortOrder), asc(sitesTable.createdAt), asc(sitesTable.handle));
}

export async function listSitesWithEntryCounts(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<SiteWithEntryCount[]> {
  const entriesTable = tableFor(database, entriesDefinition);
  const sitesTable = tableFor(database, sitesDefinition);
  return database
    .select({
      ...getTableColumns(sitesTable),
      // Spelled out in full: without a join, Drizzle leaves column names unqualified.
      entryCount: sql<number>`(
        select count(*) from ${entriesTable}
        where ${entriesTable.siteId} = ${sql.identifier("sites")}.${sql.identifier("id")}
      )`.mapWith(Number),
    })
    .from(sitesTable)
    .where(eq(sitesTable.tenantId, tenantId))
    .orderBy(asc(sitesTable.sortOrder), asc(sitesTable.createdAt), asc(sitesTable.handle));
}

/** Inserts the site unless one with its handle exists; returns undefined if it did. */
export async function insertSiteIfMissing(
  database: DatabaseOrTransaction,
  site: NewSite,
): Promise<Site | undefined> {
  const sitesTable = tableFor(database, sitesDefinition);
  const [inserted] = await insertIfNewReturning(database, sitesTable, site, {
    target: [sitesTable.tenantId, sitesTable.handle],
  });
  return inserted;
}

export async function updateSiteRow(
  database: DatabaseOrTransaction,
  siteId: string,
  changes: Partial<
    Pick<Site, "name" | "domain" | "hostnames" | "pathPrefix" | "siteUrl" | "locale" | "branding">
  >,
): Promise<void> {
  const sitesTable = tableFor(database, sitesDefinition);
  await database
    .update(sitesTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(sitesTable.id, siteId));
}

export async function deleteSiteRow(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<void> {
  const sitesTable = tableFor(database, sitesDefinition);
  await database.delete(sitesTable).where(eq(sitesTable.id, siteId));
}

export async function countEntriesInSite(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<number> {
  const entriesTable = tableFor(database, entriesDefinition);
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(eq(entriesTable.siteId, siteId));
  return row?.count ?? 0;
}

export async function findHighestSortOrder(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<number> {
  const sitesTable = tableFor(database, sitesDefinition);
  const [row] = await database
    .select({ highest: sql<number>`coalesce(max(${sitesTable.sortOrder}), 0)`.mapWith(Number) })
    .from(sitesTable)
    .where(eq(sitesTable.tenantId, tenantId));
  return row?.highest ?? 0;
}
