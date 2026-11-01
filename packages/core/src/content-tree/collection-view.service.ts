import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import {
  findCollectionByIdOrFail,
  findCollectionOrFail,
} from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import { findSiteWithLocales } from "../sites/locales.service.js";
import {
  countChildrenOf,
  countItems,
  type ItemSort,
  listItemRows,
  type NodePlace,
} from "./content-tree.repository.js";
import type { CollectionItemsQuery, TreeNode } from "./content-tree.schema.js";

/**
 * The collection view: a long list of entries in the workspace (a blog's posts, the
 * thousands of products under a shop page) instead of in the tree. Columns are the fields
 * the content type lists in `listColumns`.
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
}

export interface CollectionItemsResponse {
  items: CollectionItem[];
  columns: ListColumn[];
  total: number;
  page: number;
  perPage: number;
  /** Whether "Sort children" makes sense here: dated collections are always newest first. */
  canSortByHand: boolean;
}

/** The fields to show as columns: those the content type lists, in its order, that still exist. */
async function listColumnsOf(
  database: DatabaseOrTransaction,
  collection: Collection,
): Promise<ListColumn[]> {
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  return collection.listColumns.flatMap((handle) => {
    const field = blueprint.fields.find((candidate) => candidate.handle === handle);
    return field ? [{ handle, label: field.label, type: field.type }] : [];
  });
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

export async function listCollectionItems(
  database: DatabaseOrTransaction,
  query: CollectionItemsQuery,
): Promise<CollectionItemsResponse> {
  let place: NodePlace;
  let collection: Collection;
  if (query.parentId !== undefined) {
    const parent = await findEntryOrFail(database, query.parentId);
    collection = await findCollectionByIdOrFail(database, parent.collectionId);
    place = { parentId: parent.id };
  } else {
    collection = await findCollectionOrFail(database, query.collection ?? "");
    const main = await findSiteWithLocales(database);
    place = {
      collectionId: collection.id,
      siteId: query.siteId ?? main.id,
      locale: query.locale ?? main.locale,
    };
  }
  const isDated = query.parentId === undefined && collection.structure === "dated";
  const columns = await listColumnsOf(database, collection);
  const filters = { search: query.search, status: query.status };
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
      values: row.values,
      updatedBy: row.updatedByName,
    })),
    columns,
    total: await countItems(database, place, filters),
    page: query.page,
    perPage: query.perPage,
    canSortByHand: !isDated,
  };
}
