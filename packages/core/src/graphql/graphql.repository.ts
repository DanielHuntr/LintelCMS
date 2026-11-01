import { and, asc, desc, eq, sql } from "drizzle-orm";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";

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
  updatedAt: Date;
  blueprint: { handle: string; fields: FieldDefinition[]; version: number; updatedAt: Date };
}

export async function listCollectionsWithBlueprints(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<CollectionWithBlueprint[]> {
  const rows = await database
    .select({
      id: collectionsTable.id,
      handle: collectionsTable.handle,
      name: collectionsTable.name,
      structure: collectionsTable.structure,
      routePattern: collectionsTable.routePattern,
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
  slug: string;
  status: string;
  publishedAt: Date | null;
  data: Record<string, unknown>;
}

const workingCopyColumns = {
  id: entriesTable.id,
  slug: entriesTable.slug,
  status: entriesTable.status,
  publishedAt: entriesTable.publishedAt,
  data: sql<Record<string, unknown>>`${entriesTable.data}`,
};

/** Every entry in a collection, drafts included, with its latest saved values. */
export async function listWorkingCopies(
  database: DatabaseOrTransaction,
  collectionId: string,
  newestFirst: boolean,
  page: { limit: number; offset: number },
): Promise<{ rows: WorkingCopyRow[]; total: number }> {
  const rows = await database
    .select(workingCopyColumns)
    .from(entriesTable)
    .where(eq(entriesTable.collectionId, collectionId))
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
    .where(eq(entriesTable.collectionId, collectionId));
  return { rows, total: counted?.total ?? 0 };
}

export async function findWorkingCopyBySlug(
  database: DatabaseOrTransaction,
  collectionId: string,
  slug: string,
): Promise<WorkingCopyRow | undefined> {
  const [row] = await database
    .select(workingCopyColumns)
    .from(entriesTable)
    .where(and(eq(entriesTable.collectionId, collectionId), eq(entriesTable.slug, slug)))
    .limit(1);
  return row;
}
