import { and, asc, eq, inArray } from "drizzle-orm";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable, revisionsTable } from "../entries/entries.table.js";
import { globalSetsTable, globalValuesTable } from "../globals/globals.table.js";
import { assetsTable } from "../media/media.table.js";
import { navigationsTable } from "../navigation/navigation.table.js";
import { siteLocalesTable } from "../sites/locales.table.js";
import { sitesTable } from "../sites/sites.table.js";
import { taxonomiesTable, termsTable } from "../taxonomies/taxonomies.table.js";

/**
 * Database reads and writes for exports and imports, nothing else. Reads take whole tables
 * for one tenant; writes insert or update one row at a time, inside the import's transaction.
 */

export function listSites(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(sitesTable).where(eq(sitesTable.tenantId, tenantId));
}

export function listLocales(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(siteLocalesTable).where(eq(siteLocalesTable.tenantId, tenantId));
}

export function listBlueprints(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(blueprintsTable).where(eq(blueprintsTable.tenantId, tenantId));
}

export function listCollections(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(collectionsTable).where(eq(collectionsTable.tenantId, tenantId));
}

export function listTaxonomies(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(taxonomiesTable).where(eq(taxonomiesTable.tenantId, tenantId));
}

export function listTerms(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select()
    .from(termsTable)
    .where(eq(termsTable.tenantId, tenantId))
    .orderBy(asc(termsTable.title));
}

export function listGlobalSets(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(globalSetsTable).where(eq(globalSetsTable.tenantId, tenantId));
}

export function listGlobalValues(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(globalValuesTable).where(eq(globalValuesTable.tenantId, tenantId));
}

export function listMenus(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(navigationsTable).where(eq(navigationsTable.tenantId, tenantId));
}

export function listAssets(database: DatabaseOrTransaction, tenantId: string) {
  return database.select().from(assetsTable).where(eq(assetsTable.tenantId, tenantId));
}

export function listEntries(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.tenantId, tenantId))
    .orderBy(asc(entriesTable.sortOrder), asc(entriesTable.createdAt));
}

export function listRevisions(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select()
    .from(revisionsTable)
    .where(eq(revisionsTable.tenantId, tenantId))
    .orderBy(asc(revisionsTable.createdAt));
}

export async function listExistingRevisionIds(
  database: DatabaseOrTransaction,
  revisionIds: readonly string[],
): Promise<Set<string>> {
  if (revisionIds.length === 0) {
    return new Set();
  }
  const rows = await database
    .select({ id: revisionsTable.id })
    .from(revisionsTable)
    .where(inArray(revisionsTable.id, [...revisionIds]));
  return new Set(rows.map((row) => row.id));
}

export async function insertLocale(
  database: DatabaseOrTransaction,
  locale: typeof siteLocalesTable.$inferInsert,
) {
  await database.insert(siteLocalesTable).values(locale).onConflictDoNothing();
}

export async function upsertBlueprint(
  database: DatabaseOrTransaction,
  blueprint: typeof blueprintsTable.$inferInsert & { id: string },
  existing: boolean,
) {
  if (!existing) {
    await database.insert(blueprintsTable).values(blueprint);
    return;
  }
  await database
    .update(blueprintsTable)
    .set({ name: blueprint.name, fields: blueprint.fields, updatedAt: new Date() })
    .where(eq(blueprintsTable.id, blueprint.id));
}

export async function upsertCollection(
  database: DatabaseOrTransaction,
  collection: typeof collectionsTable.$inferInsert & { id: string },
  existing: boolean,
) {
  if (!existing) {
    await database.insert(collectionsTable).values(collection);
    return;
  }
  await database
    .update(collectionsTable)
    .set({
      name: collection.name,
      blueprintId: collection.blueprintId,
      routePattern: collection.routePattern,
      previewUrlPattern: collection.previewUrlPattern,
      structure: collection.structure,
      updatedAt: new Date(),
    })
    .where(eq(collectionsTable.id, collection.id));
}

export async function upsertTaxonomy(
  database: DatabaseOrTransaction,
  taxonomy: typeof taxonomiesTable.$inferInsert & { id: string },
  existing: boolean,
) {
  if (!existing) {
    await database.insert(taxonomiesTable).values(taxonomy);
    return;
  }
  await database
    .update(taxonomiesTable)
    .set({ name: taxonomy.name, updatedAt: new Date() })
    .where(eq(taxonomiesTable.id, taxonomy.id));
}

export async function upsertTerm(
  database: DatabaseOrTransaction,
  term: typeof termsTable.$inferInsert & { id: string },
  existing: boolean,
) {
  if (!existing) {
    await database.insert(termsTable).values(term);
    return;
  }
  await database
    .update(termsTable)
    .set({ title: term.title, description: term.description, updatedAt: new Date() })
    .where(eq(termsTable.id, term.id));
}

export async function upsertGlobalSet(
  database: DatabaseOrTransaction,
  globalSet: typeof globalSetsTable.$inferInsert & { id: string },
  existing: boolean,
) {
  if (!existing) {
    await database.insert(globalSetsTable).values(globalSet);
    return;
  }
  await database
    .update(globalSetsTable)
    .set({ name: globalSet.name, fields: globalSet.fields, updatedAt: new Date() })
    .where(eq(globalSetsTable.id, globalSet.id));
}

export async function upsertGlobalValues(
  database: DatabaseOrTransaction,
  values: typeof globalValuesTable.$inferInsert,
) {
  await database
    .insert(globalValuesTable)
    .values(values)
    .onConflictDoUpdate({
      target: [globalValuesTable.globalSetId, globalValuesTable.locale],
      set: { data: values.data, updatedAt: new Date() },
    });
}

export async function upsertMenu(
  database: DatabaseOrTransaction,
  menu: typeof navigationsTable.$inferInsert & { id: string },
  existing: boolean,
) {
  if (!existing) {
    await database.insert(navigationsTable).values(menu);
    return;
  }
  await database
    .update(navigationsTable)
    .set({ name: menu.name, maxDepth: menu.maxDepth, items: menu.items, updatedAt: new Date() })
    .where(eq(navigationsTable.id, menu.id));
}

export async function upsertAsset(
  database: DatabaseOrTransaction,
  asset: typeof assetsTable.$inferInsert & { id: string },
  existing: boolean,
) {
  if (!existing) {
    await database.insert(assetsTable).values(asset);
    return;
  }
  await database
    .update(assetsTable)
    .set({
      filename: asset.filename,
      alt: asset.alt,
      focalX: asset.focalX,
      focalY: asset.focalY,
      updatedAt: new Date(),
    })
    .where(eq(assetsTable.id, asset.id));
}

/** Inserts or replaces an entry, leaving its parent and origin for `linkEntry`. */
export async function upsertEntry(
  database: DatabaseOrTransaction,
  entry: typeof entriesTable.$inferInsert & { id: string },
  existing: boolean,
) {
  const unlinked = { ...entry, parentId: null, originId: null };
  if (!existing) {
    await database.insert(entriesTable).values(unlinked);
    return;
  }
  await database
    .update(entriesTable)
    .set({
      collectionId: entry.collectionId,
      siteId: entry.siteId,
      locale: entry.locale,
      slug: entry.slug,
      status: entry.status,
      publishedAt: entry.publishedAt,
      scheduledFor: entry.scheduledFor,
      data: entry.data,
      publishedData: entry.publishedData,
      sortOrder: entry.sortOrder,
      updatedAt: entry.updatedAt,
    })
    .where(eq(entriesTable.id, entry.id));
}

/** Sets the parent page and translation origin once every entry they can point at exists. */
export async function linkEntry(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
  links: { parentId: string | null; originId: string | null },
) {
  await database
    .update(entriesTable)
    .set(links)
    .where(and(eq(entriesTable.tenantId, tenantId), eq(entriesTable.id, entryId)));
}

export async function insertRevisions(
  database: DatabaseOrTransaction,
  revisions: Array<typeof revisionsTable.$inferInsert>,
) {
  if (revisions.length > 0) {
    await database.insert(revisionsTable).values(revisions);
  }
}
