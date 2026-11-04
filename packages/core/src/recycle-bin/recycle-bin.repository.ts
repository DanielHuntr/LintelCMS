import { and, asc, count, desc, eq, inArray, isNull, notInArray, type SQL } from "drizzle-orm";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type Entry,
  entriesTable as entriesDefinition,
  type NewEntry,
  type Revision,
  revisionsTable as revisionsDefinition,
} from "../entries/entries.table.js";
import {
  type ContentRootAddressRow,
  contentRootAddressesTable as contentRootAddressesDefinition,
} from "../content-roots/content-roots.table.js";
import { entrySeoTable as entrySeoDefinition, type EntrySeoRow } from "../seo/seo.table.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import {
  type NewRecycleBinItem,
  type RecycleBinItem,
  recycleBinItemsTable as recycleBinItemsDefinition,
} from "./recycle-bin.table.js";
import { deleteReturning, insertReturning } from "../database/dialect/writes.js";
import { jsonText } from "../database/dialect/expressions.js";
import { childTitlesInBranch, jsonTextAt } from "../database/dialect/json-expressions.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for the recycle bin, nothing else. */

export async function countRecycleBinItems(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<number> {
  const recycleBinItemsTable = tableFor(database, recycleBinItemsDefinition);
  const [row] = await database
    .select({ count: count() })
    .from(recycleBinItemsTable)
    .where(eq(recycleBinItemsTable.tenantId, tenantId));
  return row?.count ?? 0;
}

export interface RecycleBinRow {
  item: Omit<RecycleBinItem, "branch">;
  collectionHandle: string;
  collectionName: string;
  deletedByName: string | null;
  /** Where it was on the site when it was binned; null for items binned before this was kept. */
  address: string | null;
  /** The titles of the first few entries that were straight under it. */
  childTitles: string[] | null;
}

/** How many of an item's children the list names, to tell items with the same title apart. */
const LISTED_CHILDREN = 3;

/**
 * The site an item's entries were on. A branch never spans sites, so the first entry's site
 * is everyone's.
 */
function itemSiteId(database: DatabaseOrTransaction): SQL<string | null> {
  const recycleBinItemsTable = tableFor(database, recycleBinItemsDefinition);
  return jsonTextAt(database, recycleBinItemsTable.branch, ["entries", 0, "siteId"]);
}

/** Items on these sites only, or every item when `siteIds` is null. */
function onSites(
  database: DatabaseOrTransaction,
  siteIds: readonly string[] | null,
): SQL | undefined {
  return siteIds === null ? undefined : inArray(itemSiteId(database), [...siteIds]);
}

/** Newest first, without the stored branches (they can be large). */
export async function listRecycleBinRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
  siteIds: readonly string[] | null,
): Promise<RecycleBinRow[]> {
  const collectionsTable = tableFor(database, collectionsDefinition);
  const recycleBinItemsTable = tableFor(database, recycleBinItemsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  return database
    .select({
      item: {
        id: recycleBinItemsTable.id,
        tenantId: recycleBinItemsTable.tenantId,
        entryId: recycleBinItemsTable.entryId,
        collectionId: recycleBinItemsTable.collectionId,
        parentId: recycleBinItemsTable.parentId,
        title: recycleBinItemsTable.title,
        itemCount: recycleBinItemsTable.itemCount,
        deletedBy: recycleBinItemsTable.deletedBy,
        deletedAt: recycleBinItemsTable.deletedAt,
      },
      collectionHandle: collectionsTable.handle,
      collectionName: collectionsTable.name,
      deletedByName: usersTable.name,
      address: jsonText(database, recycleBinItemsTable.branch, "address"),
      childTitles: childTitlesInBranch(
        database,
        recycleBinItemsTable.branch,
        recycleBinItemsTable.entryId,
        LISTED_CHILDREN,
      ),
    })
    .from(recycleBinItemsTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, recycleBinItemsTable.collectionId))
    .leftJoin(usersTable, eq(usersTable.id, recycleBinItemsTable.deletedBy))
    .where(and(eq(recycleBinItemsTable.tenantId, tenantId), onSites(database, siteIds)))
    .orderBy(desc(recycleBinItemsTable.deletedAt))
    .limit(limit);
}

export async function findRecycleBinItem(
  database: DatabaseOrTransaction,
  tenantId: string,
  itemId: string,
): Promise<RecycleBinItem | undefined> {
  const recycleBinItemsTable = tableFor(database, recycleBinItemsDefinition);
  const [item] = await database
    .select()
    .from(recycleBinItemsTable)
    .where(and(eq(recycleBinItemsTable.tenantId, tenantId), eq(recycleBinItemsTable.id, itemId)))
    .limit(1);
  return item;
}

export async function insertRecycleBinItem(
  database: DatabaseOrTransaction,
  item: NewRecycleBinItem,
): Promise<RecycleBinItem> {
  const recycleBinItemsTable = tableFor(database, recycleBinItemsDefinition);
  const [inserted] = await insertReturning(database, recycleBinItemsTable, item);
  if (!inserted) {
    throw new Error("The database did not return the recycle bin item.");
  }
  return inserted;
}

export async function deleteRecycleBinItem(
  database: DatabaseOrTransaction,
  itemId: string,
): Promise<void> {
  const recycleBinItemsTable = tableFor(database, recycleBinItemsDefinition);
  await database.delete(recycleBinItemsTable).where(eq(recycleBinItemsTable.id, itemId));
}

/** Empties the bin (of these sites' items, unless null); answers how many items went. */
export async function deleteAllRecycleBinItems(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteIds: readonly string[] | null,
): Promise<number> {
  const recycleBinItemsTable = tableFor(database, recycleBinItemsDefinition);
  const deleted = await deleteReturning(
    database,
    recycleBinItemsTable,
    and(eq(recycleBinItemsTable.tenantId, tenantId), onSites(database, siteIds)),
    { id: recycleBinItemsTable.id },
  );
  return deleted.length;
}

export async function listEntryRows(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Entry[]> {
  const entriesTable = tableFor(database, entriesDefinition);
  if (entryIds.length === 0) return [];
  return database
    .select()
    .from(entriesTable)
    .where(inArray(entriesTable.id, [...entryIds]));
}

/** Entries outside `entryIds` that are translations of one inside, with what they point at. */
export async function listTranslationLinks(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Array<{ entryId: string; originId: string }>> {
  const entriesTable = tableFor(database, entriesDefinition);
  if (entryIds.length === 0) return [];
  const rows = await database
    .select({ entryId: entriesTable.id, originId: entriesTable.originId })
    .from(entriesTable)
    .where(
      and(
        inArray(entriesTable.originId, [...entryIds]),
        notInArray(entriesTable.id, [...entryIds]),
      ),
    );
  return rows.flatMap((row) =>
    row.originId ? [{ entryId: row.entryId, originId: row.originId }] : [],
  );
}

/** Links translations back to their restored origin, where nothing else has meanwhile. */
export async function relinkTranslations(
  database: DatabaseOrTransaction,
  links: readonly { entryId: string; originId: string }[],
): Promise<void> {
  const entriesTable = tableFor(database, entriesDefinition);
  for (const link of links) {
    await database
      .update(entriesTable)
      .set({ originId: link.originId })
      .where(and(eq(entriesTable.id, link.entryId), isNull(entriesTable.originId)));
  }
}

export async function listRevisionRows(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Revision[]> {
  const revisionsTable = tableFor(database, revisionsDefinition);
  if (entryIds.length === 0) return [];
  return database
    .select()
    .from(revisionsTable)
    .where(inArray(revisionsTable.entryId, [...entryIds]))
    .orderBy(asc(revisionsTable.createdAt));
}

export async function listSeoRows(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<EntrySeoRow[]> {
  const entrySeoTable = tableFor(database, entrySeoDefinition);
  if (entryIds.length === 0) return [];
  return database
    .select()
    .from(entrySeoTable)
    .where(inArray(entrySeoTable.entryId, [...entryIds]));
}

export async function listRootAddressRows(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<ContentRootAddressRow[]> {
  const contentRootAddressesTable = tableFor(database, contentRootAddressesDefinition);
  if (entryIds.length === 0) return [];
  return database
    .select()
    .from(contentRootAddressesTable)
    .where(inArray(contentRootAddressesTable.entryId, [...entryIds]));
}

export async function insertRootAddressRow(
  database: DatabaseOrTransaction,
  row: typeof contentRootAddressesDefinition.$inferInsert,
): Promise<void> {
  const contentRootAddressesTable = tableFor(database, contentRootAddressesDefinition);
  await database.insert(contentRootAddressesTable).values(row);
}

export async function insertEntryRow(
  database: DatabaseOrTransaction,
  entry: NewEntry,
): Promise<void> {
  const entriesTable = tableFor(database, entriesDefinition);
  await database.insert(entriesTable).values(entry);
}

export async function insertRevisionRows(
  database: DatabaseOrTransaction,
  revisions: (typeof revisionsDefinition.$inferInsert)[],
): Promise<void> {
  const revisionsTable = tableFor(database, revisionsDefinition);
  if (revisions.length === 0) return;
  await database.insert(revisionsTable).values(revisions);
}

export async function insertSeoRows(
  database: DatabaseOrTransaction,
  rows: (typeof entrySeoDefinition.$inferInsert)[],
): Promise<void> {
  const entrySeoTable = tableFor(database, entrySeoDefinition);
  if (rows.length === 0) return;
  await database.insert(entrySeoTable).values(rows);
}

/** Which of these ids are still people, so a restored entry doesn't point at someone removed. */
export async function findExistingUserIds(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<Set<string>> {
  const usersTable = tableFor(database, usersDefinition);
  if (userIds.length === 0) return new Set();
  const rows = await database
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, [...userIds]));
  return new Set(rows.map((row) => row.id));
}

/** Which of these ids are entries now. */
export async function findExistingEntryIds(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Set<string>> {
  const entriesTable = tableFor(database, entriesDefinition);
  if (entryIds.length === 0) return new Set();
  const rows = await database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(inArray(entriesTable.id, [...entryIds]));
  return new Set(rows.map((row) => row.id));
}
