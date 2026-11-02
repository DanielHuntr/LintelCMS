import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { type Navigation, navigationsTable, type NewNavigation } from "./navigation.table.js";

/** Database reads and writes for menus, nothing else. */

/** One site's menus. */
export async function listNavigationRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
): Promise<Navigation[]> {
  return database
    .select()
    .from(navigationsTable)
    .where(and(eq(navigationsTable.tenantId, tenantId), eq(navigationsTable.siteId, siteId)))
    .orderBy(asc(navigationsTable.name));
}

export async function findNavigationByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
  handle: string,
): Promise<Navigation | undefined> {
  const [navigation] = await database
    .select()
    .from(navigationsTable)
    .where(
      and(
        eq(navigationsTable.tenantId, tenantId),
        eq(navigationsTable.siteId, siteId),
        eq(navigationsTable.handle, handle),
      ),
    )
    .limit(1);
  return navigation;
}

/** Inserts the menu unless its site has one with its handle; returns undefined if it did. */
export async function insertNavigationIfMissing(
  database: DatabaseOrTransaction,
  navigation: NewNavigation,
): Promise<Navigation | undefined> {
  const [inserted] = await database
    .insert(navigationsTable)
    .values(navigation)
    .onConflictDoNothing({
      target: [navigationsTable.tenantId, navigationsTable.siteId, navigationsTable.handle],
    })
    .returning();
  return inserted;
}

export async function updateNavigationRow(
  database: DatabaseOrTransaction,
  navigationId: string,
  changes: Partial<Pick<Navigation, "name" | "maxDepth" | "items" | "source" | "pageTree">>,
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

/**
 * Every page of the site's page trees in one language (tree collections with addresses),
 * with their places: what a menu that follows the page tree is made from.
 */
export async function listMenuTreePages(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
  locale: string,
) {
  return database
    .select({
      id: entriesTable.id,
      parentId: entriesTable.parentId,
      sortOrder: entriesTable.sortOrder,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        eq(entriesTable.tenantId, tenantId),
        eq(entriesTable.siteId, siteId),
        eq(entriesTable.locale, locale),
        eq(collectionsTable.structure, "tree"),
        isNotNull(collectionsTable.routePattern),
      ),
    )
    .orderBy(asc(entriesTable.sortOrder), asc(entriesTable.createdAt));
}

/** A page's site, language and parent: where its menu item goes. */
export async function findMenuPageRow(database: DatabaseOrTransaction, entryId: string) {
  const [row] = await database
    .select({
      id: entriesTable.id,
      siteId: entriesTable.siteId,
      locale: entriesTable.locale,
      parentId: entriesTable.parentId,
      structure: collectionsTable.structure,
      routePattern: collectionsTable.routePattern,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(eq(entriesTable.id, entryId))
    .limit(1);
  return row;
}
