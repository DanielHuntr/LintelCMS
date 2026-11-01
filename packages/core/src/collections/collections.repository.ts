import { and, asc, eq, sql } from "drizzle-orm";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { type Collection, collectionsTable, type NewCollection } from "./collections.table.js";

/** Database reads and writes for collections, nothing else. */

/** A collection with what the API shows alongside it. */
export type CollectionWithDetails = Collection & { blueprintHandle: string; entryCount: number };

const detailColumns = {
  blueprintHandle: blueprintsTable.handle,
  entryCount: sql<number>`(
    select count(*) from ${entriesTable} where ${entriesTable.collectionId} = ${collectionsTable.id}
  )`.mapWith(Number),
};

function selectWithDetails(database: DatabaseOrTransaction) {
  return database
    .select({ collection: collectionsTable, ...detailColumns })
    .from(collectionsTable)
    .innerJoin(blueprintsTable, eq(blueprintsTable.id, collectionsTable.blueprintId));
}

export async function listCollectionsWithDetails(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<CollectionWithDetails[]> {
  const rows = await selectWithDetails(database)
    .where(eq(collectionsTable.tenantId, tenantId))
    .orderBy(asc(collectionsTable.name));
  return rows.map(toCollectionWithDetails);
}

export async function findCollectionWithDetails(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<CollectionWithDetails | undefined> {
  const [row] = await selectWithDetails(database)
    .where(and(eq(collectionsTable.tenantId, tenantId), eq(collectionsTable.handle, handle)))
    .limit(1);
  return row ? toCollectionWithDetails(row) : undefined;
}

function toCollectionWithDetails({
  collection,
  ...details
}: { collection: Collection } & Omit<
  CollectionWithDetails,
  keyof Collection
>): CollectionWithDetails {
  return { ...collection, ...details };
}

export async function findCollectionByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Collection | undefined> {
  const [collection] = await database
    .select()
    .from(collectionsTable)
    .where(and(eq(collectionsTable.tenantId, tenantId), eq(collectionsTable.handle, handle)))
    .limit(1);
  return collection;
}

export async function findCollectionById(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<Collection | undefined> {
  const [collection] = await database
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.id, collectionId))
    .limit(1);
  return collection;
}

export async function insertCollection(
  database: DatabaseOrTransaction,
  collection: NewCollection,
): Promise<Collection> {
  const [inserted] = await database.insert(collectionsTable).values(collection).returning();
  if (!inserted) {
    throw new Error("The database did not return the new collection.");
  }
  return inserted;
}

/** Inserts the collection unless one with its handle exists; returns undefined if it did. */
export async function insertCollectionIfMissing(
  database: DatabaseOrTransaction,
  collection: NewCollection,
): Promise<Collection | undefined> {
  const [inserted] = await database
    .insert(collectionsTable)
    .values(collection)
    .onConflictDoNothing({ target: [collectionsTable.tenantId, collectionsTable.handle] })
    .returning();
  return inserted;
}

export async function updateCollectionRow(
  database: DatabaseOrTransaction,
  collectionId: string,
  changes: Partial<Pick<Collection, "name" | "blueprintId" | "structure" | "routePattern">>,
): Promise<void> {
  await database
    .update(collectionsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(collectionsTable.id, collectionId));
}

export async function deleteCollectionRow(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<void> {
  await database.delete(collectionsTable).where(eq(collectionsTable.id, collectionId));
}

export async function listCollectionNamesUsingBlueprint(
  database: DatabaseOrTransaction,
  blueprintId: string,
): Promise<string[]> {
  const rows = await database
    .select({ name: collectionsTable.name })
    .from(collectionsTable)
    .where(eq(collectionsTable.blueprintId, blueprintId))
    .orderBy(asc(collectionsTable.name));
  return rows.map((row) => row.name);
}
