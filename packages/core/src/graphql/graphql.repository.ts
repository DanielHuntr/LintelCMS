import { and, asc, desc, eq, sql } from "drizzle-orm";
import { blueprintsTable as blueprintsDefinition } from "../blueprints/blueprints.table.js";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { CollectionSiteScope } from "../collections/collections.schema.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/**
 * Database reads for GraphQL. Published content comes through src/delivery; the reads
 * here are the content model the schema is built from, and the working copies of entries
 * that only previews may see.
 */

export interface CollectionWithBlueprint {
  id: string;
  handle: string;
  name: string;
  structure: string;
  routePattern: string | null;
  siteScope: CollectionSiteScope;
  updatedAt: Date;
  blueprint: { handle: string; fields: FieldDefinition[]; version: number; updatedAt: Date };
}

export async function listCollectionsWithBlueprints(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<CollectionWithBlueprint[]> {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  const collectionsTable = tableFor(database, collectionsDefinition);
  const rows = await database
    .select({
      id: collectionsTable.id,
      handle: collectionsTable.handle,
      name: collectionsTable.name,
      structure: collectionsTable.structure,
      routePattern: collectionsTable.routePattern,
      siteScope: collectionsTable.siteScope,
      updatedAt: collectionsTable.updatedAt,
      blueprintHandle: blueprintsTable.handle,
      fields: blueprintsTable.fields,
      version: blueprintsTable.version,
      blueprintUpdatedAt: blueprintsTable.updatedAt,
    })
    .from(collectionsTable)
    .innerJoin(blueprintsTable, eq(blueprintsTable.id, collectionsTable.blueprintId))
    .where(eq(collectionsTable.tenantId, tenantId))
    .orderBy(asc(collectionsTable.handle));
  return rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    name: row.name,
    structure: row.structure,
    routePattern: row.routePattern,
    siteScope: row.siteScope,
    updatedAt: row.updatedAt,
    blueprint: {
      handle: row.blueprintHandle,
      fields: row.fields,
      version: row.version,
      updatedAt: row.blueprintUpdatedAt,
    },
  }));
}

export interface WorkingCopyRow {
  id: string;
  locale: string;
  slug: string;
  status: string;
  publishedAt: Date | null;
  data: Record<string, unknown>;
}

function workingCopyColumns(database: DatabaseOrTransaction) {
  const entriesTable = tableFor(database, entriesDefinition);
  return {
    id: entriesTable.id,
    locale: entriesTable.locale,
    slug: entriesTable.slug,
    status: entriesTable.status,
    publishedAt: entriesTable.publishedAt,
    data: sql<Record<string, unknown>>`${entriesTable.data}`.mapWith(entriesTable.data),
  };
}

/** Every entry in a collection, drafts included, with its latest saved values. */
export async function listWorkingCopies(
  database: DatabaseOrTransaction,
  collectionId: string,
  siteId: string,
  locale: string,
  newestFirst: boolean,
  page: { limit: number; offset: number },
): Promise<{ rows: WorkingCopyRow[]; total: number }> {
  const entriesTable = tableFor(database, entriesDefinition);
  const rows = await database
    .select(workingCopyColumns(database))
    .from(entriesTable)
    .where(inCollection(entriesTable, collectionId, siteId, locale))
    .orderBy(
      ...(newestFirst
        ? [desc(entriesTable.createdAt)]
        : [asc(entriesTable.sortOrder), asc(entriesTable.createdAt)]),
    )
    .limit(page.limit)
    .offset(page.offset);
  const [counted] = await database
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(inCollection(entriesTable, collectionId, siteId, locale));
  return { rows, total: counted?.total ?? 0 };
}

function inCollection(
  entriesTable: typeof entriesDefinition,
  collectionId: string,
  siteId: string,
  locale: string,
) {
  return and(
    eq(entriesTable.collectionId, collectionId),
    eq(entriesTable.siteId, siteId),
    eq(entriesTable.locale, locale),
  );
}

export async function findWorkingCopyBySlug(
  database: DatabaseOrTransaction,
  collectionId: string,
  siteId: string,
  locale: string,
  slug: string,
): Promise<WorkingCopyRow | undefined> {
  const entriesTable = tableFor(database, entriesDefinition);
  const [row] = await database
    .select(workingCopyColumns(database))
    .from(entriesTable)
    .where(
      and(inCollection(entriesTable, collectionId, siteId, locale), eq(entriesTable.slug, slug)),
    )
    .limit(1);
  return row;
}
