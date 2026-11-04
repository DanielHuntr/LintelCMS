import { and, asc, desc, eq, inArray, isNotNull, or, type SQL, sql } from "drizzle-orm";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import { sitesTable as sitesDefinition } from "../sites/sites.table.js";
import { jsonText, orderNewestFirst } from "../database/dialect/expressions.js";
import { jsonKeyListIncludes } from "../database/dialect/json-expressions.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

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

/** Which published entries to list: one collection, on one site, in one language. */
export interface PublishedEntryFilter {
  collectionId: string;
  /** Left out by older callers, which mean every site; there is only one on such installs. */
  siteId?: string;
  locale: string;
  /** Only entries that chose this term in one of these fields. */
  withTerm?: { termId: string; fieldHandles: readonly string[] };
}

function publishedColumns(database: DatabaseOrTransaction) {
  const entriesTable = tableFor(database, entriesDefinition);
  return {
    id: entriesTable.id,
    originId: entriesTable.originId,
    locale: entriesTable.locale,
    slug: entriesTable.slug,
    publishedAt: entriesTable.publishedAt,
    publishedData: sql<Record<string, unknown>>`${entriesTable.publishedData}`.mapWith(
      entriesTable.publishedData,
    ) as SQL<Record<string, unknown>>,
  };
}

function publishedIn(
  database: DatabaseOrTransaction,
  filter: PublishedEntryFilter,
): SQL | undefined {
  const entriesTable = tableFor(database, entriesDefinition);
  return and(
    eq(entriesTable.collectionId, filter.collectionId),
    filter.siteId ? eq(entriesTable.siteId, filter.siteId) : undefined,
    eq(entriesTable.locale, filter.locale),
    isNotNull(entriesTable.publishedData),
    filter.withTerm ? choseTerm(database, filter.withTerm) : undefined,
  );
}

/** Terms fields store a list of ids, so "chose" means the list contains the id. */
function choseTerm(
  database: DatabaseOrTransaction,
  { termId, fieldHandles }: NonNullable<PublishedEntryFilter["withTerm"]>,
) {
  const entriesTable = tableFor(database, entriesDefinition);
  return or(
    ...fieldHandles.map((handle) =>
      jsonKeyListIncludes(database, entriesTable.publishedData, handle, termId),
    ),
  );
}

export async function listPublishedEntries(
  database: DatabaseOrTransaction,
  filter: PublishedEntryFilter,
  newestFirst: boolean,
  page: { limit: number; offset: number },
): Promise<PublishedEntryRow[]> {
  const entriesTable = tableFor(database, entriesDefinition);
  return database
    .select(publishedColumns(database))
    .from(entriesTable)
    .where(publishedIn(database, filter))
    .orderBy(
      ...(newestFirst
        ? [orderNewestFirst(database, entriesTable.publishedAt), desc(entriesTable.createdAt)]
        : [asc(entriesTable.sortOrder), asc(entriesTable.createdAt)]),
    )
    .limit(page.limit)
    .offset(page.offset);
}

export async function countPublishedEntries(
  database: DatabaseOrTransaction,
  filter: PublishedEntryFilter,
): Promise<number> {
  const entriesTable = tableFor(database, entriesDefinition);
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(publishedIn(database, filter));
  return row?.count ?? 0;
}

/** An entry's working copy, for live preview. Only call this after checking a preview token. */
export interface DraftEntryRow {
  id: string;
  collectionId: string;
  siteId: string;
  originId: string | null;
  locale: string;
  slug: string;
  publishedAt: Date | null;
  data: Record<string, unknown>;
}

export async function findDraftEntry(
  database: DatabaseOrTransaction,
  where:
    { entryId: string } | { collectionId: string; siteId: string; locale: string; slug: string },
): Promise<DraftEntryRow | undefined> {
  const entriesTable = tableFor(database, entriesDefinition);
  const [entry] = await database
    .select({
      id: entriesTable.id,
      collectionId: entriesTable.collectionId,
      siteId: entriesTable.siteId,
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
            eq(entriesTable.siteId, where.siteId),
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
  const entriesTable = tableFor(database, entriesDefinition);
  const [entry] = await database
    .select(publishedColumns(database))
    .from(entriesTable)
    .where(and(publishedIn(database, filter), eq(entriesTable.slug, slug)))
    .limit(1);
  return entry;
}

/** The published versions of an entry in every language: its origin and their translations. */
export async function listPublishedTranslations(
  database: DatabaseOrTransaction,
  rootId: string,
): Promise<PublishedEntryRow[]> {
  const entriesTable = tableFor(database, entriesDefinition);
  return database
    .select(publishedColumns(database))
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
  /** The path prefix of the entry's site, such as "/fr". */
  pathPrefix: string;
}

/** Published entries with these ids, and their published translations. */
export async function findPublishedEntryLinks(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<PublishedEntryLinkRow[]> {
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const sitesTable = tableFor(database, sitesDefinition);
  if (entryIds.length === 0) {
    return [];
  }
  return database
    .select({
      id: entriesTable.id,
      originId: entriesTable.originId,
      locale: entriesTable.locale,
      slug: entriesTable.slug,
      title: jsonText(database, entriesTable.publishedData, "title"),
      publishedAt: entriesTable.publishedAt,
      collectionHandle: collectionsTable.handle,
      routePattern: collectionsTable.routePattern,
      pathPrefix: sitesTable.pathPrefix,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .innerJoin(sitesTable, eq(sitesTable.id, entriesTable.siteId))
    .where(
      and(
        isNotNull(entriesTable.publishedData),
        or(inArray(entriesTable.id, [...entryIds]), inArray(entriesTable.originId, [...entryIds])),
      ),
    );
}
