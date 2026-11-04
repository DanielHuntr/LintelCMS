import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import { contentRootAddressesTable as contentRootAddressesDefinition } from "./content-roots.table.js";
import { upsert } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { jsonText } from "../database/dialect/expressions.js";

/** Database reads and writes for site starts and their addresses, nothing else. */

export interface SiteStartRow {
  entryId: string;
  slug: string;
  title: string | null;
  sortOrder: number;
  createdAt: Date;
  collectionHandle: string;
  collectionName: string;
  collectionCreatedAt: Date;
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
  const collectionsTable = tableFor(database, collectionsDefinition);
  const contentRootAddressesTable = tableFor(database, contentRootAddressesDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  return database
    .select({
      entryId: entriesTable.id,
      slug: entriesTable.slug,
      title: jsonText(database, entriesTable.data, "title"),
      sortOrder: entriesTable.sortOrder,
      createdAt: entriesTable.createdAt,
      collectionHandle: collectionsTable.handle,
      collectionName: collectionsTable.name,
      collectionCreatedAt: collectionsTable.createdAt,
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
  slug: string;
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
  const entriesTable = tableFor(database, entriesDefinition);
  const rows: EntryPlaceRow[] = [];
  for (let start = 0; start < entryIds.length; start += IDS_PER_QUERY) {
    const ids = entryIds.slice(start, start + IDS_PER_QUERY);
    rows.push(
      ...(await database
        .select({
          id: entriesTable.id,
          slug: entriesTable.slug,
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
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const rows: EntryAddressRow[] = [];
  for (let start = 0; start < entryIds.length; start += IDS_PER_QUERY) {
    rows.push(
      ...(await database
        .select({
          id: entriesTable.id,
          title: jsonText(database, entriesTable.data, "title"),
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

/** The domains site starts have of their own, with their sites. All sites when none given. */
export async function listSiteStartHostnameRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId?: string,
): Promise<{ siteId: string; hostname: string }[]> {
  const contentRootAddressesTable = tableFor(database, contentRootAddressesDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  return database
    .selectDistinct({ siteId: entriesTable.siteId, hostname: contentRootAddressesTable.hostname })
    .from(contentRootAddressesTable)
    .innerJoin(entriesTable, eq(entriesTable.id, contentRootAddressesTable.entryId))
    .where(
      and(
        eq(contentRootAddressesTable.tenantId, tenantId),
        ne(contentRootAddressesTable.hostname, ""),
        isNull(entriesTable.parentId),
        siteId === undefined ? undefined : eq(entriesTable.siteId, siteId),
      ),
    );
}

export async function findRootAddressRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
) {
  const contentRootAddressesTable = tableFor(database, contentRootAddressesDefinition);
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
  const contentRootAddressesTable = tableFor(database, contentRootAddressesDefinition);
  await upsert(
    database,
    contentRootAddressesTable,
    { tenantId, entryId, ...address },
    {
      target: [contentRootAddressesTable.tenantId, contentRootAddressesTable.entryId],
      set: { ...address, updatedAt: new Date() },
    },
  );
}

export async function deleteRootAddressRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
): Promise<void> {
  const contentRootAddressesTable = tableFor(database, contentRootAddressesDefinition);
  await database
    .delete(contentRootAddressesTable)
    .where(
      and(
        eq(contentRootAddressesTable.tenantId, tenantId),
        eq(contentRootAddressesTable.entryId, entryId),
      ),
    );
}
