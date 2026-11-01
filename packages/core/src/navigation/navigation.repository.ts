import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { type Navigation, navigationsTable, type NewNavigation } from "./navigation.table.js";

/** Database reads and writes for menus, nothing else. */

export async function listNavigationRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Navigation[]> {
  return database
    .select()
    .from(navigationsTable)
    .where(eq(navigationsTable.tenantId, tenantId))
    .orderBy(asc(navigationsTable.name));
}

export async function findNavigationByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Navigation | undefined> {
  const [navigation] = await database
    .select()
    .from(navigationsTable)
    .where(and(eq(navigationsTable.tenantId, tenantId), eq(navigationsTable.handle, handle)))
    .limit(1);
  return navigation;
}

/** Inserts the menu unless one with its handle exists; returns undefined if it did. */
export async function insertNavigationIfMissing(
  database: DatabaseOrTransaction,
  navigation: NewNavigation,
): Promise<Navigation | undefined> {
  const [inserted] = await database
    .insert(navigationsTable)
    .values(navigation)
    .onConflictDoNothing({ target: [navigationsTable.tenantId, navigationsTable.handle] })
    .returning();
  return inserted;
}

export async function updateNavigationRow(
  database: DatabaseOrTransaction,
  navigationId: string,
  changes: Partial<Pick<Navigation, "name" | "maxDepth" | "items">>,
): Promise<void> {
  await database
    .update(navigationsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(navigationsTable.id, navigationId));
}

export async function deleteNavigationRow(
  database: DatabaseOrTransaction,
  navigationId: string,
): Promise<void> {
  await database.delete(navigationsTable).where(eq(navigationsTable.id, navigationId));
}

/** Titles, collections and statuses of the entries a menu links to. */
export async function findLinkedEntries(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
) {
  if (entryIds.length === 0) {
    return [];
  }
  return database
    .select({
      id: entriesTable.id,
      title: sql<string | null>`${entriesTable.data}->>'title'`,
      collectionHandle: collectionsTable.handle,
      status: entriesTable.status,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(inArray(entriesTable.id, [...entryIds]));
}
