import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { formsTable } from "../forms/forms.table.js";
import { assetsTable } from "../media/media.table.js";
import { taxonomiesTable, termsTable } from "../taxonomies/taxonomies.table.js";

/** Database reads for exporting the website as files, nothing else. */

export interface PublishedEntryRow {
  id: string;
  originId: string | null;
  collectionHandle: string;
  routePattern: string;
  slug: string;
  locale: string;
  publishedAt: Date | null;
  updatedAt: Date;
  publishedData: Record<string, unknown>;
}

/** Every published entry in a collection with pages, in a stable order. */
export async function listPublishedEntryRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<PublishedEntryRow[]> {
  const rows = await database
    .select({
      id: entriesTable.id,
      originId: entriesTable.originId,
      collectionHandle: collectionsTable.handle,
      routePattern: collectionsTable.routePattern,
      slug: entriesTable.slug,
      locale: entriesTable.locale,
      publishedAt: entriesTable.publishedAt,
      updatedAt: entriesTable.updatedAt,
      publishedData: entriesTable.publishedData,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        eq(entriesTable.tenantId, tenantId),
        isNotNull(entriesTable.publishedData),
        isNotNull(collectionsTable.routePattern),
      ),
    )
    .orderBy(asc(collectionsTable.handle), asc(entriesTable.locale), asc(entriesTable.id));
  return rows.flatMap((row) =>
    row.routePattern === null || row.publishedData === null
      ? []
      : [{ ...row, routePattern: row.routePattern, publishedData: row.publishedData }],
  );
}

/**
 * When each record an entry points at (pictures, other entries) last changed, by id, so a
 * page showing a picture is rebuilt when the picture's alt text changes.
 */
export async function findReferencedVersions(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }
  const assets = await database
    .select({ id: assetsTable.id, updatedAt: assetsTable.updatedAt })
    .from(assetsTable)
    .where(inArray(assetsTable.id, [...ids]));
  const entries = await database
    .select({ id: entriesTable.id, updatedAt: entriesTable.updatedAt })
    .from(entriesTable)
    .where(inArray(entriesTable.id, [...ids]));
  return new Map(
    [...assets, ...entries].map((row) => [row.id, row.updatedAt.toISOString()] as const),
  );
}

export interface TermRow {
  taxonomyHandle: string;
  slug: string;
  updatedAt: Date;
}

export async function listTermRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<TermRow[]> {
  return database
    .select({
      taxonomyHandle: taxonomiesTable.handle,
      slug: termsTable.slug,
      updatedAt: termsTable.updatedAt,
    })
    .from(termsTable)
    .innerJoin(taxonomiesTable, eq(taxonomiesTable.id, termsTable.taxonomyId))
    .where(eq(termsTable.tenantId, tenantId))
    .orderBy(asc(taxonomiesTable.handle), asc(termsTable.slug));
}

/** When each form last changed, since a page shows its form's questions. */
export async function listFormVersions(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Array<{ handle: string; updatedAt: Date }>> {
  return database
    .select({ handle: formsTable.handle, updatedAt: formsTable.updatedAt })
    .from(formsTable)
    .where(eq(formsTable.tenantId, tenantId))
    .orderBy(asc(formsTable.handle));
}
