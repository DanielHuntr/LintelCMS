import { and, asc, desc, eq, isNotNull, type SQL, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";

/**
 * Database reads for the public delivery API. Every query here filters on
 * `publishedData`, so drafts and unpublished changes can't leak out by mistake.
 */

export interface PublishedEntryRow {
  id: string;
  slug: string;
  publishedAt: Date | null;
  publishedData: Record<string, unknown>;
}

const publishedColumns = {
  id: entriesTable.id,
  slug: entriesTable.slug,
  publishedAt: entriesTable.publishedAt,
  publishedData: sql<Record<string, unknown>>`${entriesTable.publishedData}`,
};

function publishedIn(collectionId: string): SQL | undefined {
  return and(eq(entriesTable.collectionId, collectionId), isNotNull(entriesTable.publishedData));
}

export async function listPublishedEntries(
  database: DatabaseOrTransaction,
  collectionId: string,
  newestFirst: boolean,
  page: { limit: number; offset: number },
): Promise<PublishedEntryRow[]> {
  return database
    .select(publishedColumns)
    .from(entriesTable)
    .where(publishedIn(collectionId))
    .orderBy(
      ...(newestFirst
        ? [desc(entriesTable.publishedAt), desc(entriesTable.createdAt)]
        : [asc(entriesTable.sortOrder), asc(entriesTable.createdAt)]),
    )
    .limit(page.limit)
    .offset(page.offset);
}

export async function countPublishedEntries(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(publishedIn(collectionId));
  return row?.count ?? 0;
}

export async function findPublishedEntryBySlug(
  database: DatabaseOrTransaction,
  collectionId: string,
  slug: string,
): Promise<PublishedEntryRow | undefined> {
  const [entry] = await database
    .select(publishedColumns)
    .from(entriesTable)
    .where(and(publishedIn(collectionId), eq(entriesTable.slug, slug)))
    .limit(1);
  return entry;
}
