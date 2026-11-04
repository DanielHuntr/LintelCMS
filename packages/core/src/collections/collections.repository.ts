import { and, asc, eq, ne, sql } from "drizzle-orm";
import { blueprintsTable as blueprintsDefinition } from "../blueprints/blueprints.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import {
  type Collection,
  collectionsTable as collectionsDefinition,
  type NewCollection,
} from "./collections.table.js";
import { insertIfNewReturning, insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { idListIncludes, idListWithout } from "../database/dialect/expressions.js";

/** Database reads and writes for collections, nothing else. */

/** A collection with what the API shows alongside it. */
export type CollectionWithDetails = Collection & { blueprintHandle: string; entryCount: number };

function selectWithDetails(database: DatabaseOrTransaction) {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  return database
    .select({
      collection: collectionsTable,
      blueprintHandle: blueprintsTable.handle,
      entryCount: sql<number>`(
        select count(*) from ${entriesTable} where ${entriesTable.collectionId} = ${collectionsTable.id}
      )`.mapWith(Number),
    })
    .from(collectionsTable)
    .innerJoin(blueprintsTable, eq(blueprintsTable.id, collectionsTable.blueprintId));
}

export async function listCollectionsWithDetails(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<CollectionWithDetails[]> {
  const collectionsTable = tableFor(database, collectionsDefinition);
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
  const collectionsTable = tableFor(database, collectionsDefinition);
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
  const collectionsTable = tableFor(database, collectionsDefinition);
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
  const collectionsTable = tableFor(database, collectionsDefinition);
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
  const collectionsTable = tableFor(database, collectionsDefinition);
  const [inserted] = await insertReturning(database, collectionsTable, collection);
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
  const collectionsTable = tableFor(database, collectionsDefinition);
  const [inserted] = await insertIfNewReturning(database, collectionsTable, collection, {
    target: [collectionsTable.tenantId, collectionsTable.handle],
  });
  return inserted;
}

export async function updateCollectionRow(
  database: DatabaseOrTransaction,
  collectionId: string,
  changes: Partial<
    Pick<
      Collection,
      | "name"
      | "blueprintId"
      | "structure"
      | "routePattern"
      | "previewUrlPattern"
      | "siteScope"
      | "siteIds"
      | "allowedAtRoot"
      | "allowedChildren"
      | "childrenAsCollection"
    >
  >,
): Promise<void> {
  const collectionsTable = tableFor(database, collectionsDefinition);
  await database
    .update(collectionsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(collectionsTable.id, collectionId));
}

export async function deleteCollectionRow(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<void> {
  const collectionsTable = tableFor(database, collectionsDefinition);
  await database.delete(collectionsTable).where(eq(collectionsTable.id, collectionId));
}

export async function listCollectionNamesUsingBlueprint(
  database: DatabaseOrTransaction,
  blueprintId: string,
): Promise<string[]> {
  const collectionsTable = tableFor(database, collectionsDefinition);
  const rows = await database
    .select({ name: collectionsTable.name })
    .from(collectionsTable)
    .where(eq(collectionsTable.blueprintId, blueprintId))
    .orderBy(asc(collectionsTable.name));
  return rows.map((row) => row.name);
}

/** Takes a deleted site out of every collection limited to some sites. */
export async function removeSiteFromCollections(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<void> {
  const collectionsTable = tableFor(database, collectionsDefinition);
  await database
    .update(collectionsTable)
    .set({ siteIds: idListWithout(database, collectionsTable.siteIds, siteId) })
    .where(idListIncludes(database, collectionsTable.siteIds, siteId));
}

/** How many of the collection's entries belong to sites other than this one. */
export async function countEntriesOutsideSite(
  database: DatabaseOrTransaction,
  collectionId: string,
  siteId: string,
): Promise<number> {
  const entriesTable = tableFor(database, entriesDefinition);
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(and(eq(entriesTable.collectionId, collectionId), ne(entriesTable.siteId, siteId)));
  return row?.count ?? 0;
}
