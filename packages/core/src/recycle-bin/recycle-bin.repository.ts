import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type Entry,
  entriesTable,
  type NewEntry,
  type Revision,
  revisionsTable,
} from "../entries/entries.table.js";
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

/** Newest first, without the stored branches (they can be large). */
export async function listRecycleBinRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
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
    .where(eq(recycleBinItemsTable.tenantId, tenantId))
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

/** Empties the bin; answers how many items went. */
export async function deleteAllRecycleBinItems(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<number> {
  const deleted = await database
    .delete(recycleBinItemsTable)
    .where(eq(recycleBinItemsTable.tenantId, tenantId))
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
