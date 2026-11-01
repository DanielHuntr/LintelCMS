import { and, asc, desc, eq, inArray, isNotNull, or, type SQL, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";

/**
 * Database reads for the public delivery API. Every query here filters on
 * `publishedData`, so drafts and unpublished changes can't leak out by mistake. The one
 * exception, `findDraftEntry`, is only reached with a signed preview token.
 */

export interface PublishedEntryRow {
  id: string;
  originId: string | null;
  locale: string;
  slug: string;
  publishedAt: Date | null;
  publishedData: Record<string, unknown>;
}

/** Which published entries to list: one collection, in one language. */
export interface PublishedEntryFilter {
  collectionId: string;
  locale: string;
  /** Only entries that chose this term in one of these fields. */
  withTerm?: { termId: string; fieldHandles: readonly string[] };
}

const publishedColumns = {
  id: entriesTable.id,
  originId: entriesTable.originId,
  locale: entriesTable.locale,
  slug: entriesTable.slug,
  publishedAt: entriesTable.publishedAt,
  publishedData: sql<Record<string, unknown>>`${entriesTable.publishedData}`,
};

function publishedIn(filter: PublishedEntryFilter): SQL | undefined {
  return and(
    eq(entriesTable.collectionId, filter.collectionId),
    eq(entriesTable.locale, filter.locale),
    isNotNull(entriesTable.publishedData),
    filter.withTerm ? choseTerm(filter.withTerm) : undefined,
  );
}

/** Terms fields store a list of ids, so "chose" means the list contains the id. */
function choseTerm({ termId, fieldHandles }: NonNullable<PublishedEntryFilter["withTerm"]>) {
  const listed = JSON.stringify([termId]);
  return or(
    ...fieldHandles.map(
      (handle) => sql`(${entriesTable.publishedData} -> ${handle}) @> ${listed}::jsonb`,
    ),
  );
}

export async function listPublishedEntries(
  database: DatabaseOrTransaction,
  filter: PublishedEntryFilter,
  newestFirst: boolean,
  page: { limit: number; offset: number },
): Promise<PublishedEntryRow[]> {
  return database
    .select(publishedColumns)
    .from(entriesTable)
    .where(publishedIn(filter))
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
  filter: PublishedEntryFilter,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(publishedIn(filter));
  return row?.count ?? 0;
}

/** An entry's working copy, for live preview. Only call this after checking a preview token. */
export interface DraftEntryRow {
  id: string;
  collectionId: string;
  originId: string | null;
  locale: string;
  slug: string;
  publishedAt: Date | null;
  data: Record<string, unknown>;
}

export async function findDraftEntry(
  database: DatabaseOrTransaction,
  where: { entryId: string } | { collectionId: string; locale: string; slug: string },
): Promise<DraftEntryRow | undefined> {
  const [entry] = await database
    .select({
      id: entriesTable.id,
      collectionId: entriesTable.collectionId,
      originId: entriesTable.originId,
      locale: entriesTable.locale,
      slug: entriesTable.slug,
      publishedAt: entriesTable.publishedAt,
      data: entriesTable.data,
    })
    .from(entriesTable)
    .where(
      "entryId" in where
        ? eq(entriesTable.id, where.entryId)
        : and(
            eq(entriesTable.collectionId, where.collectionId),
            eq(entriesTable.locale, where.locale),
            eq(entriesTable.slug, where.slug),
          ),
    )
    .limit(1);
  return entry;
}

export async function findPublishedEntryBySlug(
  database: DatabaseOrTransaction,
  filter: PublishedEntryFilter,
  slug: string,
): Promise<PublishedEntryRow | undefined> {
  const [entry] = await database
    .select(publishedColumns)
    .from(entriesTable)
    .where(and(publishedIn(filter), eq(entriesTable.slug, slug)))
    .limit(1);
  return entry;
}

/** The published versions of an entry in every language: its origin and their translations. */
export async function listPublishedTranslations(
  database: DatabaseOrTransaction,
  rootId: string,
): Promise<PublishedEntryRow[]> {
  return database
    .select(publishedColumns)
    .from(entriesTable)
    .where(
      and(
        isNotNull(entriesTable.publishedData),
        or(eq(entriesTable.id, rootId), eq(entriesTable.originId, rootId)),
      ),
    )
    .orderBy(asc(entriesTable.createdAt));
}

/** A published entry with what a link to it needs. */
export interface PublishedEntryLinkRow {
  id: string;
  originId: string | null;
  locale: string;
  slug: string;
  title: string | null;
  publishedAt: Date | null;
  collectionHandle: string;
  routePattern: string | null;
}

/** Published entries with these ids, and their published translations. */
export async function findPublishedEntryLinks(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<PublishedEntryLinkRow[]> {
  if (entryIds.length === 0) {
    return [];
  }
  return database
    .select({
      id: entriesTable.id,
      originId: entriesTable.originId,
      locale: entriesTable.locale,
      slug: entriesTable.slug,
      title: sql<string | null>`${entriesTable.publishedData}->>'title'`,
      publishedAt: entriesTable.publishedAt,
      collectionHandle: collectionsTable.handle,
      routePattern: collectionsTable.routePattern,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        isNotNull(entriesTable.publishedData),
        or(inArray(entriesTable.id, [...entryIds]), inArray(entriesTable.originId, [...entryIds])),
      ),
    );
}
