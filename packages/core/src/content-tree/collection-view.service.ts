import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import {
  findCollectionByIdOrFail,
  findCollectionOrFail,
} from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import { findSiteWithLocales } from "../sites/locales.service.js";
import { placeEntryUrls } from "../content-roots/content-roots.service.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { findSiteByIdOrFail } from "../sites/sites.service.js";
import {
  countChildrenOf,
  countItems,
  type ItemSort,
  listChildLinks,
  listItemRows,
  listSiblingIds,
  listTypesAt,
  type NodePlace,
} from "./content-tree.repository.js";
import type { CollectionItemsQuery, TreeNode } from "./content-tree.schema.js";

/**
 * The collection view: a long list of entries in the workspace (a blog's posts, the
 * thousands of products under a shop page) instead of in the tree. Columns are the fields
 * the content type marks "Show in the list" (`showInList`).
 */

export interface ListColumn {
  handle: string;
  label: string;
  type: string;
}

export interface CollectionItem extends TreeNode {
  /** The list columns' saved values, keyed by field handle. */
  values: Record<string, unknown>;
  updatedBy: string | null;
  /** Where it answers on the site, or null for content without pages. */
  url: string | null;
}

export interface CollectionItemsResponse {
  items: CollectionItem[];
  columns: ListColumn[];
  total: number;
  page: number;
  perPage: number;
  /** Whether "Sort children" makes sense here: dated collections are always newest first. */
  canSortByHand: boolean;
  /** The content types found here, for the type filter. */
  types: { handle: string; name: string }[];
}

/** The most entries "Every level" lists; a branch bigger than this shows its first part. */
const MAX_BRANCH_SIZE = 5000;

/**
 * Everything under these entries, each parent followed by its children, in their order:
 * the tree read top to bottom, a level (one query) at a time.
 */
async function listDescendantsInTreeOrder(
  database: DatabaseOrTransaction,
  topIds: readonly string[],
): Promise<string[]> {
  const childrenOf = new Map<string, string[]>();
  const seen = new Set(topIds);
  let level = [...topIds];
  while (level.length > 0 && seen.size < MAX_BRANCH_SIZE) {
    const links = (await listChildLinks(database, level)).filter((link) => !seen.has(link.id));
    for (const link of links) {
      seen.add(link.id);
      childrenOf.set(link.parentId, [...(childrenOf.get(link.parentId) ?? []), link.id]);
    }
    level = links.map((link) => link.id);
  }
  const ordered: string[] = [];
  const visit = (ids: readonly string[]) => {
    for (const id of ids) {
      ordered.push(id);
      visit(childrenOf.get(id) ?? []);
    }
  };
  visit(topIds);
  return ordered.slice(0, MAX_BRANCH_SIZE);
}

/**
 * The fields to show as columns: those marked "Show in the list" in the content type's
 * field settings (`showInList`), in the content type's order. The one place it is chosen.
 */
async function listColumnsOf(
  database: DatabaseOrTransaction,
  collection: Collection,
): Promise<ListColumn[]> {
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  return blueprint.fields
    .filter((field) => field.showInList)
    .map((field) => ({ handle: field.handle, label: field.label, type: field.type }));
}

function sortFrom(query: CollectionItemsQuery, columns: readonly ListColumn[]): ItemSort | null {
  if (query.sort === undefined) return null;
  if (query.sort.startsWith("field:")) {
    const handle = query.sort.slice("field:".length);
    // Only a column can be sorted by, so nobody can sort by a field they can't see.
    return columns.some((column) => column.handle === handle) ? { by: "field", handle } : null;
  }
  return { by: query.sort as Exclude<ItemSort["by"], "field"> };
}

/** A content type picked in the filter that has nothing here matches nothing. */
const NO_TYPE_ID = "00000000-0000-0000-0000-000000000000";

function typeIdOf(types: readonly { id: string; handle: string }[], handle: string): string {
  return types.find((type) => type.handle === handle)?.id ?? NO_TYPE_ID;
}

export async function listCollectionItems(
  database: DatabaseOrTransaction,
  query: CollectionItemsQuery,
): Promise<CollectionItemsResponse> {
  let place: NodePlace;
  let collection: Collection;
  let siteId: string;
  if (query.parentId !== undefined) {
    const parent = await findEntryOrFail(database, query.parentId);
    collection = await findCollectionByIdOrFail(database, parent.collectionId);
    place = { parentId: parent.id };
    siteId = parent.siteId;
  } else {
    collection = await findCollectionOrFail(database, query.collection ?? "");
    const main = await findSiteWithLocales(database);
    siteId = query.siteId ?? main.id;
    place = { collectionId: collection.id, siteId, locale: query.locale ?? main.locale };
  }
  const isDated = query.parentId === undefined && collection.structure === "dated";
  if (query.allLevels && !isDated) {
    const topIds =
      "parentId" in place
        ? (await listChildLinks(database, [place.parentId])).map((link) => link.id)
        : await listSiblingIds(database, place);
    place = { entryIds: await listDescendantsInTreeOrder(database, topIds) };
  }
  const columns = await listColumnsOf(database, collection);
  const types = await listTypesAt(database, place);
  const filters = {
    search: query.search,
    status: query.status,
    waitingForReview: query.review === "waiting",
    collectionId: query.type === undefined ? undefined : typeIdOf(types, query.type),
  };
  const rows = await listItemRows(database, place, {
    filters,
    sort: sortFrom(query, columns) ?? (isDated ? "dated" : "manual"),
    direction: query.direction ?? "asc",
    columns: columns.map((column) => column.handle),
    page: { limit: query.perPage, offset: (query.page - 1) * query.perPage },
  });
  const counts = await countChildrenOf(
    database,
    rows.map((row) => row.id),
  );
  const site = await findSiteByIdOrFail(database, siteId);
  const urls = await placeEntryUrls(
    database,
    rows.map((row) => ({ id: row.id, url: buildEntryUrl(row.routePattern, row) })),
    { site },
  );
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title ?? "",
      slug: row.slug,
      status: row.status,
      hasUnpublishedChanges: row.hasUnpublishedChanges,
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      parentId: row.parentId,
      locale: row.locale,
      collection: { handle: row.collectionHandle, name: row.collectionName },
      childCount: counts.get(row.id) ?? 0,
      childrenAsCollection: row.childrenAsCollection,
      isSiteStart: row.isSiteStart,
      values: row.values,
      updatedBy: row.updatedByName,
      url: urls.get(row.id) ?? null,
    })),
    columns,
    types: types.map(({ handle, name }) => ({ handle, name })),
    total: await countItems(database, place, filters),
    page: query.page,
    perPage: query.perPage,
    canSortByHand: !isDated,
  };
}
