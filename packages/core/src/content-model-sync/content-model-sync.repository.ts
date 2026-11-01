import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable, type EntryData } from "../entries/entries.table.js";
import { fieldsetsTable } from "../fieldsets/fieldsets.table.js";
import { globalSetsTable, globalValuesTable } from "../globals/globals.table.js";
import { navigationsTable } from "../navigation/navigation.table.js";
import { taxonomiesTable, termsTable } from "../taxonomies/taxonomies.table.js";

/**
 * Database reads and writes for syncing the content model, nothing else: the model's rows
 * in the shape the sync compares, and the stored values a change would affect.
 */

export async function listBlueprintModelRows(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select({
      id: blueprintsTable.id,
      handle: blueprintsTable.handle,
      name: blueprintsTable.name,
      fields: blueprintsTable.fields,
    })
    .from(blueprintsTable)
    .where(eq(blueprintsTable.tenantId, tenantId))
    .orderBy(asc(blueprintsTable.handle));
}

export async function listCollectionModelRows(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select({
      id: collectionsTable.id,
      handle: collectionsTable.handle,
      name: collectionsTable.name,
      blueprintId: collectionsTable.blueprintId,
      structure: collectionsTable.structure,
      routePattern: collectionsTable.routePattern,
      allowedAtRoot: collectionsTable.allowedAtRoot,
      allowedChildren: collectionsTable.allowedChildren,
      childrenAsCollection: collectionsTable.childrenAsCollection,
    })
    .from(collectionsTable)
    .where(eq(collectionsTable.tenantId, tenantId))
    .orderBy(asc(collectionsTable.handle));
}

export async function listTaxonomyModelRows(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select({ id: taxonomiesTable.id, handle: taxonomiesTable.handle, name: taxonomiesTable.name })
    .from(taxonomiesTable)
    .where(eq(taxonomiesTable.tenantId, tenantId))
    .orderBy(asc(taxonomiesTable.handle));
}

export async function listGlobalSetModelRows(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select({
      id: globalSetsTable.id,
      handle: globalSetsTable.handle,
      name: globalSetsTable.name,
      fields: globalSetsTable.fields,
    })
    .from(globalSetsTable)
    .where(eq(globalSetsTable.tenantId, tenantId))
    .orderBy(asc(globalSetsTable.handle));
}

export async function listMenuModelRows(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select({
      id: navigationsTable.id,
      handle: navigationsTable.handle,
      name: navigationsTable.name,
      maxDepth: navigationsTable.maxDepth,
      items: navigationsTable.items,
    })
    .from(navigationsTable)
    .where(eq(navigationsTable.tenantId, tenantId))
    .orderBy(asc(navigationsTable.handle));
}

export interface StoredEntryValues {
  id: string;
  collectionId: string;
  parentId: string | null;
  data: EntryData;
  publishedData: EntryData | null;
}

/** The values of every entry in these collections, every language and both copies. */
export async function listEntryValues(
  database: DatabaseOrTransaction,
  collectionIds: readonly string[],
): Promise<StoredEntryValues[]> {
  if (collectionIds.length === 0) {
    return [];
  }
  return database
    .select({
      id: entriesTable.id,
      collectionId: entriesTable.collectionId,
      parentId: entriesTable.parentId,
      data: entriesTable.data,
      publishedData: entriesTable.publishedData,
    })
    .from(entriesTable)
    .where(inArray(entriesTable.collectionId, [...collectionIds]));
}

export async function replaceEntryValues(
  database: DatabaseOrTransaction,
  entryId: string,
  values: Pick<StoredEntryValues, "data" | "publishedData">,
): Promise<void> {
  await database.update(entriesTable).set(values).where(eq(entriesTable.id, entryId));
}

export async function listEntryIdsInCollection(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<string[]> {
  const rows = await database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(eq(entriesTable.collectionId, collectionId));
  return rows.map((row) => row.id);
}

export async function countEntriesWithParents(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<number> {
  const rows = await database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(and(eq(entriesTable.collectionId, collectionId), isNotNull(entriesTable.parentId)));
  return rows.length;
}

/** Every language's saved values of a global set. */
export async function listFieldsetModelRows(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select({
      handle: fieldsetsTable.handle,
      name: fieldsetsTable.name,
      fields: fieldsetsTable.fields,
    })
    .from(fieldsetsTable)
    .where(eq(fieldsetsTable.tenantId, tenantId))
    .orderBy(asc(fieldsetsTable.handle));
}

export async function listGlobalValueRows(database: DatabaseOrTransaction, globalSetId: string) {
  return database
    .select({ id: globalValuesTable.id, data: globalValuesTable.data })
    .from(globalValuesTable)
    .where(eq(globalValuesTable.globalSetId, globalSetId));
}

export async function countTermsInTaxonomy(
  database: DatabaseOrTransaction,
  taxonomyId: string,
): Promise<number> {
  const rows = await database
    .select({ id: termsTable.id })
    .from(termsTable)
    .where(eq(termsTable.taxonomyId, taxonomyId));
  return rows.length;
}
