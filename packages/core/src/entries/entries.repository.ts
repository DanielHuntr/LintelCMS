import { and, asc, desc, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { type Blueprint, blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable } from "../users/users.table.js";
import type { TreePosition } from "./entry-tree.js";
import { type Entry, entriesTable, type EntryStatus, type NewEntry } from "./entries.table.js";

/** Database reads and writes for entries, nothing else. */

export interface EntryFilters {
  collectionId: string;
  /** Only this site's entries. */
  siteId?: string;
  status?: EntryStatus;
  search?: string;
  parentId?: string;
  locale?: string;
}

/** Where a slug has to be free: one collection, in one site and language. */
export interface SlugScope {
  collectionId: string;
  siteId: string;
  locale: string;
  exceptEntryId?: string;
}

/** "dated" is newest first; "manual" is the order editors set (`sortOrder`). */
export type EntryOrder = "dated" | "manual";

/** What a list of entries shows, without the (possibly large) field values. */
export interface EntrySummaryRow {
  id: string;
  title: string | null;
  slug: string;
  status: EntryStatus;
  parentId: string | null;
  locale: string;
  originId: string | null;
  updatedAt: Date;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  updatedById: string | null;
  updatedByName: string | null;
}

export interface EntryWithDetails {
  entry: Entry;
  collectionHandle: string;
  blueprint: Blueprint;
  updatedByName: string | null;
}

const titleColumn = sql<string | null>`${entriesTable.data}->>'title'`;

const summaryColumns = {
  id: entriesTable.id,
  title: titleColumn,
  slug: entriesTable.slug,
  status: entriesTable.status,
  parentId: entriesTable.parentId,
  locale: entriesTable.locale,
  originId: entriesTable.originId,
  updatedAt: entriesTable.updatedAt,
  publishedAt: entriesTable.publishedAt,
  scheduledFor: entriesTable.scheduledFor,
  updatedById: usersTable.id,
  updatedByName: usersTable.name,
};

function matching(filters: EntryFilters): SQL | undefined {
  return and(
    eq(entriesTable.collectionId, filters.collectionId),
    filters.siteId ? eq(entriesTable.siteId, filters.siteId) : undefined,
    filters.status ? eq(entriesTable.status, filters.status) : undefined,
    filters.search ? ilike(titleColumn, `%${escapeLikePattern(filters.search)}%`) : undefined,
    filters.parentId ? eq(entriesTable.parentId, filters.parentId) : undefined,
    filters.locale ? eq(entriesTable.locale, filters.locale) : undefined,
  );
}

/** So a search for "100%" looks for those characters rather than treating % as "anything". */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

const orderings: Record<EntryOrder, SQL[]> = {
  // Drafts have no publish date yet; they sort by when they are due, or were started.
  dated: [
    desc(
      sql`coalesce(${entriesTable.publishedAt}, ${entriesTable.scheduledFor}, ${entriesTable.createdAt})`,
    ),
    desc(entriesTable.createdAt),
  ],
  manual: [asc(entriesTable.sortOrder), asc(entriesTable.createdAt)],
};

export async function listEntrySummaries(
  database: DatabaseOrTransaction,
  filters: EntryFilters,
  order: EntryOrder,
  page?: { limit: number; offset: number },
): Promise<EntrySummaryRow[]> {
  const query = database
    .select(summaryColumns)
    .from(entriesTable)
    .leftJoin(usersTable, eq(usersTable.id, entriesTable.updatedBy))
    .where(matching(filters))
    .orderBy(...orderings[order]);
  return page ? query.limit(page.limit).offset(page.offset) : query;
}

/**
 * The values of a few fields for a page of entries, for fields shown as columns in the list.
 * Only asked for when a blueprint has such fields, so lists stay light otherwise.
 */
export async function findEntryFieldValues(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
  handles: readonly string[],
): Promise<Map<string, Record<string, unknown>>> {
  if (entryIds.length === 0 || handles.length === 0) {
    return new Map();
  }
  const rows = await database
    .select({ id: entriesTable.id, data: entriesTable.data })
    .from(entriesTable)
    .where(inArray(entriesTable.id, [...entryIds]));
  return new Map(
    rows.map((row) => [
      row.id,
      Object.fromEntries(handles.map((handle) => [handle, row.data[handle] ?? null])),
    ]),
  );
}

export async function countEntries(
  database: DatabaseOrTransaction,
  filters: EntryFilters,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(matching(filters));
  return row?.count ?? 0;
}

/** Where every entry of a collection sits (on one site, if given), for putting a tree in order. */
export async function listEntryPositions(
  database: DatabaseOrTransaction,
  collectionId: string,
  siteId?: string,
): Promise<TreePosition[]> {
  return database
    .select({
      id: entriesTable.id,
      parentId: entriesTable.parentId,
      sortOrder: entriesTable.sortOrder,
      createdAt: entriesTable.createdAt,
    })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.collectionId, collectionId),
        siteId ? eq(entriesTable.siteId, siteId) : undefined,
      ),
    );
}

export async function findEntryById(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<Entry | undefined> {
  const [entry] = await database
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.id, entryId))
    .limit(1);
  return entry;
}

/** The entry with its collection's handle and blueprint, and who last saved it. */
export async function findEntryWithDetails(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<EntryWithDetails | undefined> {
  const [row] = await database
    .select({
      entry: entriesTable,
      collectionHandle: collectionsTable.handle,
      blueprint: blueprintsTable,
      updatedByName: usersTable.name,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .innerJoin(blueprintsTable, eq(blueprintsTable.id, collectionsTable.blueprintId))
    .leftJoin(usersTable, eq(usersTable.id, entriesTable.updatedBy))
    .where(eq(entriesTable.id, entryId))
    .limit(1);
  return row;
}

export async function insertEntry(
  database: DatabaseOrTransaction,
  entry: NewEntry,
): Promise<Entry> {
  const [inserted] = await database.insert(entriesTable).values(entry).returning();
  if (!inserted) {
    throw new Error("The database did not return the new entry.");
  }
  return inserted;
}

export async function updateEntryRow(
  database: DatabaseOrTransaction,
  entryId: string,
  changes: Partial<Omit<NewEntry, "id" | "tenantId" | "collectionId" | "siteId">>,
): Promise<Entry> {
  const [updated] = await database
    .update(entriesTable)
    .set(changes)
    .where(eq(entriesTable.id, entryId))
    .returning();
  if (!updated) {
    throw new Error("The database did not return the updated entry.");
  }
  return updated;
}

export async function deleteEntryRow(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<void> {
  await database.delete(entriesTable).where(eq(entriesTable.id, entryId));
}

/**
 * The ids above an entry, nearest first: its parent, its parent's parent and so on, across
 * collections, starting with the entry itself. Trees are shallow, so one query per level is
 * cheap; it stops at a loop in hand-edited data rather than running forever.
 */
export async function findAncestorIds(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<string[]> {
  const path: string[] = [];
  let current: string | null = entryId;
  while (current !== null && !path.includes(current)) {
    const [row] = await database
      .select({ parentId: entriesTable.parentId })
      .from(entriesTable)
      .where(eq(entriesTable.id, current))
      .limit(1);
    if (!row) {
      break;
    }
    path.push(current);
    current = row.parentId;
  }
  return path;
}

/** Gives the children of `entryId` a new parent, so deleting a page doesn't orphan them. */
export async function moveChildrenToParent(
  database: DatabaseOrTransaction,
  entryId: string,
  newParentId: string | null,
): Promise<void> {
  await database
    .update(entriesTable)
    .set({ parentId: newParentId })
    .where(eq(entriesTable.parentId, entryId));
}

/** Translations of a deleted entry stay, but stop pointing at it. */
export async function clearOriginReferences(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<void> {
  await database
    .update(entriesTable)
    .set({ originId: null })
    .where(eq(entriesTable.originId, entryId));
}

export async function clearParentsInCollection(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<void> {
  await database
    .update(entriesTable)
    .set({ parentId: null })
    .where(eq(entriesTable.collectionId, collectionId));
}

/** Slugs in the collection, site and locale that are `base` or `base-<something>`. */
export async function findSlugsStartingWith(
  database: DatabaseOrTransaction,
  scope: SlugScope,
  base: string,
): Promise<string[]> {
  const rows = await database
    .select({ id: entriesTable.id, slug: entriesTable.slug })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.collectionId, scope.collectionId),
        eq(entriesTable.siteId, scope.siteId),
        eq(entriesTable.locale, scope.locale),
        or(eq(entriesTable.slug, base), sql`${entriesTable.slug} like ${`${base}-%`}`),
      ),
    );
  return rows.filter((row) => row.id !== scope.exceptEntryId).map((row) => row.slug);
}

/**
 * Siblings: the top level of one collection, or everything under one parent. Children of
 * one parent can come from several collections (see src/content-tree), so they share one order.
 */
function siblingsOf(collectionId: string, parentId: string | null): SQL | undefined {
  return parentId === null
    ? and(eq(entriesTable.collectionId, collectionId), sql`${entriesTable.parentId} is null`)
    : eq(entriesTable.parentId, parentId);
}

/** One more than the highest `sortOrder` among these siblings, so a new entry goes last. */
export async function findNextSortOrder(
  database: DatabaseOrTransaction,
  collectionId: string,
  parentId: string | null,
): Promise<number> {
  const [row] = await database
    .select({ highest: sql<number | null>`max(${entriesTable.sortOrder})`.mapWith(Number) })
    .from(entriesTable)
    .where(siblingsOf(collectionId, parentId));
  return row?.highest === null || row?.highest === undefined ? 0 : row.highest + 1;
}

/** Moves every sibling after `sortOrder` one place down, leaving a free place right after it. */
export async function makeRoomAfter(
  database: DatabaseOrTransaction,
  collectionId: string,
  parentId: string | null,
  sortOrder: number,
): Promise<void> {
  await database
    .update(entriesTable)
    .set({ sortOrder: sql`${entriesTable.sortOrder} + 1` })
    .where(and(siblingsOf(collectionId, parentId), sql`${entriesTable.sortOrder} > ${sortOrder}`));
}

export async function updateEntryPosition(
  database: DatabaseOrTransaction,
  entryId: string,
  position: { parentId: string | null; sortOrder: number },
): Promise<void> {
  await database.update(entriesTable).set(position).where(eq(entriesTable.id, entryId));
}

/**
 * Entries whose saved or published values mention this id anywhere. Ids are random
 * uuids, so a match in the JSON text is a real reference (an image field today, an image
 * inside rich text later).
 */
export async function findEntriesMentioning(
  database: DatabaseOrTransaction,
  id: string,
): Promise<{ entryId: string; title: string | null }[]> {
  const quoted = `%"${id}"%`;
  // A picture kept only by its address (an element's cursor picture) names the file's id in it.
  const address = `%/media/${id}/file%`;
  return database
    .select({ entryId: entriesTable.id, title: titleColumn })
    .from(entriesTable)
    .where(
      or(
        sql`${entriesTable.data}::text like ${quoted}`,
        sql`${entriesTable.publishedData}::text like ${quoted}`,
        sql`${entriesTable.data}::text like ${address}`,
        sql`${entriesTable.publishedData}::text like ${address}`,
      ),
    );
}

/** An entry and its translations: the entry `rootId` and every entry pointing at it. */
export async function listTranslationFamily(
  database: DatabaseOrTransaction,
  rootId: string,
): Promise<{ id: string; locale: string; title: string | null; status: EntryStatus }[]> {
  return database
    .select({
      id: entriesTable.id,
      locale: entriesTable.locale,
      title: titleColumn,
      status: entriesTable.status,
    })
    .from(entriesTable)
    .where(or(eq(entriesTable.id, rootId), eq(entriesTable.originId, rootId)))
    .orderBy(asc(entriesTable.createdAt));
}

/**
 * Whether another entry in the collection, in the same language, has this value for a field,
 * for fields marked unique. Values are compared as stored JSON.
 */
export async function hasEntryWithValue(
  database: DatabaseOrTransaction,
  where: { collectionId: string; locale: string; exceptEntryId: string | null },
  handle: string,
  value: unknown,
): Promise<boolean> {
  const rows = await database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.collectionId, where.collectionId),
        eq(entriesTable.locale, where.locale),
        where.exceptEntryId ? sql`${entriesTable.id} <> ${where.exceptEntryId}` : undefined,
        sql`${entriesTable.data} -> ${handle} = ${JSON.stringify(value)}::jsonb`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** The sites these entries belong to, each once. Unknown ids are left out. */
export async function listEntrySiteIds(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<string[]> {
  if (entryIds.length === 0) {
    return [];
  }
  const rows = await database
    .selectDistinct({ siteId: entriesTable.siteId })
    .from(entriesTable)
    .where(inArray(entriesTable.id, [...entryIds]));
  return rows.map((row) => row.siteId);
}

/** Which of these ids are entries, in one of these collections when any are named. */
export async function findExistingEntryIds(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
  collectionHandles: readonly string[],
): Promise<string[]> {
  if (entryIds.length === 0) {
    return [];
  }
  const rows = await database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        inArray(entriesTable.id, [...entryIds]),
        collectionHandles.length > 0
          ? inArray(collectionsTable.handle, [...collectionHandles])
          : undefined,
      ),
    );
  return rows.map((row) => row.id);
}

/** Every entry whose saved or published values are listed, for tidying up references. */
export async function findEntryValuesMentioning(
  database: DatabaseOrTransaction,
  id: string,
): Promise<Pick<Entry, "id" | "data" | "publishedData">[]> {
  const quoted = `%"${id}"%`;
  return database
    .select({
      id: entriesTable.id,
      data: entriesTable.data,
      publishedData: entriesTable.publishedData,
    })
    .from(entriesTable)
    .where(
      or(
        sql`${entriesTable.data}::text like ${quoted}`,
        sql`${entriesTable.publishedData}::text like ${quoted}`,
      ),
    );
}

/**
 * Pages on one site and language with this slug in other collections that have addresses:
 * the only entries whose address can be the same as a page's (a collection's own slugs are
 * unique already).
 */
export async function findSameSlugPages(
  database: DatabaseOrTransaction,
  entry: Pick<Entry, "id" | "siteId" | "locale" | "slug" | "collectionId">,
) {
  return database
    .select({
      id: entriesTable.id,
      slug: entriesTable.slug,
      publishedAt: entriesTable.publishedAt,
      title: sql<string | null>`${entriesTable.data}->>'title'`,
      routePattern: collectionsTable.routePattern,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        eq(entriesTable.siteId, entry.siteId),
        eq(entriesTable.locale, entry.locale),
        eq(entriesTable.slug, entry.slug),
        sql`${entriesTable.id} <> ${entry.id}`,
        sql`${entriesTable.collectionId} <> ${entry.collectionId}`,
        sql`${collectionsTable.routePattern} is not null`,
      ),
    );
}
