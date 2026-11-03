import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, type SQL, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable, type EntryStatus } from "../entries/entries.table.js";
import { sitesTable } from "../sites/sites.table.js";
import { usersTable } from "../users/users.table.js";

/** Database reads and writes for the content tree, nothing else. */

/**
 * Where a list of tree nodes comes from: under one entry, the top of one collection, or
 * (for the collection view's "Every level") a whole branch, as ids in the tree's order.
 */
export type NodePlace =
  | { parentId: string }
  | { collectionId: string; siteId: string; locale: string }
  | { entryIds: readonly string[] };

export interface TreeNodeRow {
  id: string;
  title: string | null;
  slug: string;
  status: EntryStatus;
  hasUnpublishedChanges: boolean;
  scheduledFor: Date | null;
  updatedAt: Date;
  parentId: string | null;
  locale: string;
  sortOrder: number;
  collectionHandle: string;
  collectionName: string;
  childrenAsCollection: boolean;
  /** At the top of a page tree, so a site start: its site's "/", or a "/shop" of its own. */
  isSiteStart: boolean;
  /** For its address: its collection's route, and when it went live (for dated routes). */
  routePattern: string | null;
  publishedAt: Date | null;
}

const titleColumn = sql<string | null>`${entriesTable.data}->>'title'`;

const nodeColumns = {
  id: entriesTable.id,
  title: titleColumn,
  slug: entriesTable.slug,
  status: entriesTable.status,
  // jsonb equality ignores key order, as the editor's own comparison does.
  hasUnpublishedChanges: sql<boolean>`(${entriesTable.publishedData} is not null and ${entriesTable.data} <> ${entriesTable.publishedData})`,
  scheduledFor: entriesTable.scheduledFor,
  updatedAt: entriesTable.updatedAt,
  parentId: entriesTable.parentId,
  locale: entriesTable.locale,
  sortOrder: entriesTable.sortOrder,
  collectionHandle: collectionsTable.handle,
  collectionName: collectionsTable.name,
  childrenAsCollection: collectionsTable.childrenAsCollection,
  isSiteStart: sql<boolean>`(${entriesTable.parentId} is null and ${collectionsTable.structure} = 'tree' and ${collectionsTable.routePattern} is not null)`,
  routePattern: collectionsTable.routePattern,
  publishedAt: entriesTable.publishedAt,
};

function placeCondition(place: NodePlace): SQL | undefined {
  if ("entryIds" in place) {
    return place.entryIds.length === 0 ? sql`false` : inArray(entriesTable.id, [...place.entryIds]);
  }
  if ("parentId" in place) {
    return eq(entriesTable.parentId, place.parentId);
  }
  return and(
    eq(entriesTable.collectionId, place.collectionId),
    eq(entriesTable.siteId, place.siteId),
    eq(entriesTable.locale, place.locale),
    isNull(entriesTable.parentId),
  );
}

/** Hand-set order for trees and lists; newest first for dated collections. */
export type NodeOrder = "manual" | "dated";

const orderings: Record<NodeOrder, SQL[]> = {
  manual: [asc(entriesTable.sortOrder), asc(entriesTable.createdAt)],
  dated: [
    desc(
      sql`coalesce(${entriesTable.publishedAt}, ${entriesTable.scheduledFor}, ${entriesTable.createdAt})`,
    ),
    desc(entriesTable.createdAt),
  ],
};

export async function listNodeRows(
  database: DatabaseOrTransaction,
  place: NodePlace,
  order: NodeOrder,
  page: { limit: number; offset: number },
): Promise<TreeNodeRow[]> {
  return database
    .select(nodeColumns)
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(placeCondition(place))
    .orderBy(...orderings[order])
    .limit(page.limit)
    .offset(page.offset);
}

export async function countNodes(
  database: DatabaseOrTransaction,
  place: NodePlace,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(placeCondition(place));
  return row?.count ?? 0;
}

/** How many children each of these entries has, in one grouped query. */
export async function countChildrenOf(
  database: DatabaseOrTransaction,
  parentIds: readonly string[],
): Promise<Map<string, number>> {
  if (parentIds.length === 0) {
    return new Map();
  }
  const rows = await database
    .select({
      parentId: entriesTable.parentId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(entriesTable)
    .where(inArray(entriesTable.parentId, [...parentIds]))
    .groupBy(entriesTable.parentId);
  return new Map(rows.map((row) => [row.parentId ?? "", row.count]));
}

/** Entries at the top level of each collection, in one site and language. */
export async function countTopLevelByCollection(
  database: DatabaseOrTransaction,
  siteId: string,
  locale: string,
): Promise<Map<string, number>> {
  const rows = await database
    .select({
      collectionId: entriesTable.collectionId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.siteId, siteId),
        eq(entriesTable.locale, locale),
        isNull(entriesTable.parentId),
      ),
    )
    .groupBy(entriesTable.collectionId);
  return new Map(rows.map((row) => [row.collectionId, row.count]));
}

export interface ItemFilters {
  search?: string;
  status?: EntryStatus;
  /** Only entries of this content type (collection id). */
  collectionId?: string;
}

/** Sort keys the collection view offers; a list column sorts by its stored value. */
export type ItemSort =
  { by: "title" | "updated" | "status" | "published" } | { by: "field"; handle: string };

function itemSortExpression(sort: ItemSort): SQL {
  if (sort.by === "field") return sql`${entriesTable.data}->>${sort.handle}`;
  if (sort.by === "title") return sql`lower(${titleColumn})`;
  if (sort.by === "status") return sql`${entriesTable.status}`;
  if (sort.by === "published") return sql`${entriesTable.publishedAt}`;
  return sql`${entriesTable.updatedAt}`;
}

function itemConditions(place: NodePlace, filters: ItemFilters): SQL | undefined {
  const escaped = filters.search?.replace(/[\\%_]/g, (character) => `\\${character}`);
  return and(
    placeCondition(place),
    escaped ? ilike(titleColumn, `%${escaped}%`) : undefined,
    filters.status ? eq(entriesTable.status, filters.status) : undefined,
    filters.collectionId ? eq(entriesTable.collectionId, filters.collectionId) : undefined,
  );
}

/** A page of the collection view: nodes with the values of the list's columns. */
export async function listItemRows(
  database: DatabaseOrTransaction,
  place: NodePlace,
  options: {
    filters: ItemFilters;
    sort: ItemSort | "manual" | "dated";
    direction: "asc" | "desc";
    columns: readonly string[];
    page: { limit: number; offset: number };
  },
): Promise<
  (TreeNodeRow & {
    values: Record<string, unknown>;
    updatedByName: string | null;
    routePattern: string | null;
    publishedAt: Date | null;
  })[]
> {
  const values =
    options.columns.length === 0
      ? sql<Record<string, unknown>>`'{}'::jsonb`
      : sql<Record<string, unknown>>`jsonb_build_object(${sql.join(
          options.columns.map((handle) => sql`${handle}::text, ${entriesTable.data}->${handle}`),
          sql`, `,
        )})`;
  const ordering =
    typeof options.sort === "string"
      ? options.sort === "manual" && "entryIds" in place
        ? [givenOrder(place.entryIds)]
        : orderings[options.sort]
      : [
          options.direction === "asc"
            ? sql`${itemSortExpression(options.sort)} asc nulls last`
            : sql`${itemSortExpression(options.sort)} desc nulls last`,
          desc(entriesTable.createdAt),
        ];
  return database
    .select({
      ...nodeColumns,
      values,
      updatedByName: usersTable.name,
      routePattern: collectionsTable.routePattern,
      publishedAt: entriesTable.publishedAt,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .leftJoin(usersTable, eq(usersTable.id, entriesTable.updatedBy))
    .where(itemConditions(place, options.filters))
    .orderBy(...ordering)
    .limit(options.page.limit)
    .offset(options.page.offset);
}

/** The order the ids were given in: a branch's tree order, for "Every level". */
function givenOrder(entryIds: readonly string[]): SQL {
  if (entryIds.length === 0) return sql`1`;
  return sql`array_position(array[${sql.join(
    entryIds.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[], ${entriesTable.id})`;
}

/** The content types of the entries at a place, for the collection view's type filter. */
export async function listTypesAt(
  database: DatabaseOrTransaction,
  place: NodePlace,
): Promise<{ id: string; handle: string; name: string }[]> {
  return database
    .selectDistinct({
      id: collectionsTable.id,
      handle: collectionsTable.handle,
      name: collectionsTable.name,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(placeCondition(place))
    .orderBy(asc(collectionsTable.name));
}

export async function countItems(
  database: DatabaseOrTransaction,
  place: NodePlace,
  filters: ItemFilters,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(itemConditions(place, filters));
  return row?.count ?? 0;
}

/** The ids at one place, in their order: what moving and sorting renumber. */
export async function listSiblingIds(
  database: DatabaseOrTransaction,
  place: NodePlace,
): Promise<string[]> {
  const rows = await database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(placeCondition(place))
    .orderBy(...orderings.manual);
  return rows.map((row) => row.id);
}

/** Sets `sortOrder` to each id's place in the list, changing only rows that moved. */
export async function renumberSiblings(
  database: DatabaseOrTransaction,
  orderedIds: readonly string[],
  parentId: string | null,
): Promise<void> {
  if (orderedIds.length === 0) {
    return;
  }
  const current = await database
    .select({
      id: entriesTable.id,
      sortOrder: entriesTable.sortOrder,
      parentId: entriesTable.parentId,
    })
    .from(entriesTable)
    .where(inArray(entriesTable.id, [...orderedIds]));
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const [sortOrder, id] of orderedIds.entries()) {
    const row = byId.get(id);
    if (row && row.sortOrder === sortOrder && row.parentId === parentId) {
      continue;
    }
    await database.update(entriesTable).set({ sortOrder, parentId }).where(eq(entriesTable.id, id));
  }
}

/** The direct children of these entries, for walking down a branch one level at a time. */
export async function listChildLinks(
  database: DatabaseOrTransaction,
  parentIds: readonly string[],
): Promise<{ id: string; parentId: string }[]> {
  if (parentIds.length === 0) {
    return [];
  }
  const rows = await database
    .select({ id: entriesTable.id, parentId: entriesTable.parentId })
    .from(entriesTable)
    .where(inArray(entriesTable.parentId, [...parentIds]))
    .orderBy(asc(entriesTable.sortOrder), asc(entriesTable.createdAt));
  return rows.flatMap((row) => (row.parentId ? [{ id: row.id, parentId: row.parentId }] : []));
}

/** Tree nodes for these ids, in no particular order. */
export async function findNodeRows(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<TreeNodeRow[]> {
  if (entryIds.length === 0) {
    return [];
  }
  return database
    .select(nodeColumns)
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(inArray(entriesTable.id, [...entryIds]));
}

/** Entries whose title contains the search, in one site and language, best matches first. */
export async function searchNodeRows(
  database: DatabaseOrTransaction,
  search: string,
  siteId: string,
  locale: string,
  limit: number,
): Promise<TreeNodeRow[]> {
  const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`);
  return (
    database
      .select(nodeColumns)
      .from(entriesTable)
      .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
      .where(
        and(
          eq(entriesTable.siteId, siteId),
          eq(entriesTable.locale, locale),
          ilike(titleColumn, `%${escaped}%`),
        ),
      )
      // Titles that start with the search come first, then the most recently changed.
      .orderBy(
        sql`case when ${titleColumn} ilike ${`${escaped}%`} then 0 else 1 end`,
        desc(entriesTable.updatedAt),
      )
      .limit(limit)
  );
}

export async function listSites(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<{ id: string; name: string; locale: string }[]> {
  return database
    .select({ id: sitesTable.id, name: sitesTable.name, locale: sitesTable.locale })
    .from(sitesTable)
    .where(eq(sitesTable.tenantId, tenantId))
    .orderBy(asc(sitesTable.createdAt));
}

/**
 * Entries whose saved or published values mention this id: what links to an entry. Ids are
 * random uuids, so a match in the JSON text is a real reference.
 */
export async function findNodesMentioning(
  database: DatabaseOrTransaction,
  entryId: string,
  limit: number,
): Promise<TreeNodeRow[]> {
  const quoted = `%"${entryId}"%`;
  return database
    .select(nodeColumns)
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        ne(entriesTable.id, entryId),
        or(
          sql`${entriesTable.data}::text like ${quoted}`,
          sql`${entriesTable.publishedData}::text like ${quoted}`,
        ),
      ),
    )
    .orderBy(desc(entriesTable.updatedAt))
    .limit(limit);
}

/** Names of these people, for "Created by" and "Last changed by". */
export async function findPersonNames(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const rows = await database
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(inArray(usersTable.id, [...userIds]));
  return new Map(rows.map((row) => [row.id, row.name]));
}
