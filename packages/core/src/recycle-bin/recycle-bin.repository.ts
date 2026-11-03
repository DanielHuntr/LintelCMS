import { and, asc, count, desc, eq, inArray, isNull, notInArray, type SQL, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type Entry,
  entriesTable,
  type NewEntry,
  type Revision,
  revisionsTable,
} from "../entries/entries.table.js";
import {
  type ContentRootAddressRow,
  contentRootAddressesTable,
} from "../content-roots/content-roots.table.js";
import { entrySeoTable, type EntrySeoRow } from "../seo/seo.table.js";
import { usersTable } from "../users/users.table.js";
import {
  type NewRecycleBinItem,
  type RecycleBinItem,
  recycleBinItemsTable,
} from "./recycle-bin.table.js";

/** Database reads and writes for the recycle bin, nothing else. */

export async function countRecycleBinItems(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<number> {
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
}

/**
 * The site an item's entries were on. A branch never spans sites, so the first entry's site
 * is everyone's.
 */
const itemSiteId = sql<string>`${recycleBinItemsTable.branch}->'entries'->0->>'siteId'`;

/** Items on these sites only, or every item when `siteIds` is null. */
function onSites(siteIds: readonly string[] | null): SQL | undefined {
  return siteIds === null ? undefined : inArray(itemSiteId, [...siteIds]);
}

/** Newest first, without the stored branches (they can be large). */
export async function listRecycleBinRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
  siteIds: readonly string[] | null,
): Promise<RecycleBinRow[]> {
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
    })
    .from(recycleBinItemsTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, recycleBinItemsTable.collectionId))
    .leftJoin(usersTable, eq(usersTable.id, recycleBinItemsTable.deletedBy))
    .where(and(eq(recycleBinItemsTable.tenantId, tenantId), onSites(siteIds)))
    .orderBy(desc(recycleBinItemsTable.deletedAt))
    .limit(limit);
}

export async function findRecycleBinItem(
  database: DatabaseOrTransaction,
  tenantId: string,
  itemId: string,
): Promise<RecycleBinItem | undefined> {
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
  const [inserted] = await database.insert(recycleBinItemsTable).values(item).returning();
  if (!inserted) {
    throw new Error("The database did not return the recycle bin item.");
  }
  return inserted;
}

export async function deleteRecycleBinItem(
  database: DatabaseOrTransaction,
  itemId: string,
): Promise<void> {
  await database.delete(recycleBinItemsTable).where(eq(recycleBinItemsTable.id, itemId));
}

/** Empties the bin (of these sites' items, unless null); answers how many items went. */
export async function deleteAllRecycleBinItems(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteIds: readonly string[] | null,
): Promise<number> {
  const deleted = await database
    .delete(recycleBinItemsTable)
    .where(and(eq(recycleBinItemsTable.tenantId, tenantId), onSites(siteIds)))
    .returning({ id: recycleBinItemsTable.id });
  return deleted.length;
}

export async function listEntryRows(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Entry[]> {
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
  if (entryIds.length === 0) return [];
  return database
    .select()
    .from(contentRootAddressesTable)
    .where(inArray(contentRootAddressesTable.entryId, [...entryIds]));
}

export async function insertRootAddressRow(
  database: DatabaseOrTransaction,
  row: typeof contentRootAddressesTable.$inferInsert,
): Promise<void> {
  await database.insert(contentRootAddressesTable).values(row);
}

export async function insertEntryRow(
  database: DatabaseOrTransaction,
  entry: NewEntry,
): Promise<void> {
  await database.insert(entriesTable).values(entry);
}

export async function insertRevisionRows(
  database: DatabaseOrTransaction,
  revisions: (typeof revisionsTable.$inferInsert)[],
): Promise<void> {
  if (revisions.length === 0) return;
  await database.insert(revisionsTable).values(revisions);
}

export async function insertSeoRows(
  database: DatabaseOrTransaction,
  rows: (typeof entrySeoTable.$inferInsert)[],
): Promise<void> {
  if (rows.length === 0) return;
  await database.insert(entrySeoTable).values(rows);
}

/** Which of these ids are still people, so a restored entry doesn't point at someone removed. */
export async function findExistingUserIds(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<Set<string>> {
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
  if (entryIds.length === 0) return new Set();
  const rows = await database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(inArray(entriesTable.id, [...entryIds]));
  return new Set(rows.map((row) => row.id));
}
