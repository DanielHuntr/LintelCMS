import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { contentRootAddressesTable } from "./content-roots.table.js";

/** Database reads and writes for site starts and their addresses, nothing else. */

export interface SiteStartRow {
  entryId: string;
  slug: string;
  title: string | null;
  sortOrder: number;
  createdAt: Date;
  collectionHandle: string;
  collectionName: string;
  hostname: string | null;
  pathPrefix: string | null;
}

/**
 * Site starts in one site and language: entries at the top of a page tree (a tree
 * collection with pages), with their addresses when they have one. In no special order.
 */
export async function listSiteStartRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
  locale: string,
): Promise<SiteStartRow[]> {
  return database
    .select({
      entryId: entriesTable.id,
      slug: entriesTable.slug,
      title: sql<string | null>`${entriesTable.data}->>'title'`,
      sortOrder: entriesTable.sortOrder,
      createdAt: entriesTable.createdAt,
      collectionHandle: collectionsTable.handle,
      collectionName: collectionsTable.name,
      hostname: contentRootAddressesTable.hostname,
      pathPrefix: contentRootAddressesTable.pathPrefix,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .leftJoin(contentRootAddressesTable, eq(contentRootAddressesTable.entryId, entriesTable.id))
    .where(
      and(
        eq(entriesTable.tenantId, tenantId),
        eq(entriesTable.siteId, siteId),
        eq(entriesTable.locale, locale),
        isNull(entriesTable.parentId),
        eq(collectionsTable.structure, "tree"),
        isNotNull(collectionsTable.routePattern),
      ),
    );
}

export interface EntryPlaceRow {
  id: string;
  parentId: string | null;
  siteId: string;
  locale: string;
}

/** Ids per query, well under the database's limit on parameters (a sitemap has thousands). */
const IDS_PER_QUERY = 1000;

/** Where these entries sit: their parents, sites and languages. */
export async function findEntryPlaces(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<EntryPlaceRow[]> {
  const rows: EntryPlaceRow[] = [];
  for (let start = 0; start < entryIds.length; start += IDS_PER_QUERY) {
    const ids = entryIds.slice(start, start + IDS_PER_QUERY);
    rows.push(
      ...(await database
        .select({
          id: entriesTable.id,
          parentId: entriesTable.parentId,
          siteId: entriesTable.siteId,
          locale: entriesTable.locale,
        })
        .from(entriesTable)
        .where(inArray(entriesTable.id, ids))),
    );
  }
  return rows;
}

export interface EntryAddressRow {
  id: string;
  title: string | null;
  slug: string;
  status: string;
  publishedAt: Date | null;
  routePattern: string | null;
}

/** What building these entries' addresses needs. */
export async function findEntryAddressRows(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<EntryAddressRow[]> {
  const rows: EntryAddressRow[] = [];
  for (let start = 0; start < entryIds.length; start += IDS_PER_QUERY) {
    rows.push(
      ...(await database
        .select({
          id: entriesTable.id,
          title: sql<string | null>`${entriesTable.data}->>'title'`,
          slug: entriesTable.slug,
          status: entriesTable.status,
          publishedAt: entriesTable.publishedAt,
          routePattern: collectionsTable.routePattern,
        })
        .from(entriesTable)
        .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
        .where(inArray(entriesTable.id, entryIds.slice(start, start + IDS_PER_QUERY)))),
    );
  }
  return rows;
}

export async function findRootAddressRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
) {
  const [row] = await database
    .select()
    .from(contentRootAddressesTable)
    .where(
      and(
        eq(contentRootAddressesTable.tenantId, tenantId),
        eq(contentRootAddressesTable.entryId, entryId),
      ),
    )
    .limit(1);
  return row;
}

export async function saveRootAddressRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
  address: { hostname: string; pathPrefix: string },
): Promise<void> {
  await database
    .insert(contentRootAddressesTable)
    .values({ tenantId, entryId, ...address })
    .onConflictDoUpdate({
      target: [contentRootAddressesTable.tenantId, contentRootAddressesTable.entryId],
      set: { ...address, updatedAt: new Date() },
    });
}

export async function deleteRootAddressRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
): Promise<void> {
  await database
    .delete(contentRootAddressesTable)
    .where(
      and(
        eq(contentRootAddressesTable.tenantId, tenantId),
        eq(contentRootAddressesTable.entryId, entryId),
      ),
    );
}
