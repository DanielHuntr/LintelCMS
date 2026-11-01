import { findCollectionOrFail } from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { orderAsTree } from "./entry-tree.js";
import { describeEntrySummary } from "./entry-responses.js";
import {
  countEntries,
  type EntryFilters,
  listEntryPositions,
  listEntrySummaries,
} from "./entries.repository.js";
import type { EntryListResponse, ListEntriesQuery } from "./entries.schema.js";

/**
 * Lists a collection's entries, a page at a time, in the order its structure calls for:
 * newest first for "dated", the hand-set order for "flat", and for a "tree" each page
 * followed by its children, so the admin can indent them as they come.
 */
export async function listEntries(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  query: ListEntriesQuery,
): Promise<EntryListResponse> {
  const collection = await findCollectionOrFail(database, collectionHandle);
  const filters: EntryFilters = {
    collectionId: collection.id,
    status: query.status,
    search: query.search,
    parentId: query.parentId,
  };
  const page = { limit: query.perPage, offset: (query.page - 1) * query.perPage };

  const { rows, total } =
    collection.structure === "tree"
      ? await listInTreeOrder(database, collection, filters, page)
      : {
          rows: await listEntrySummaries(
            database,
            filters,
            collection.structure === "dated" ? "dated" : "manual",
            page,
          ),
          total: await countEntries(database, filters),
        };

  return {
    entries: rows.map(describeEntrySummary),
    total,
    page: query.page,
    perPage: query.perPage,
  };
}

/**
 * Tree order depends on every ancestor, which SQL can't page through simply, so the
 * matching entries are ordered here. Page trees stay small enough for that to be cheap.
 */
async function listInTreeOrder(
  database: DatabaseOrTransaction,
  collection: Collection,
  filters: EntryFilters,
  page: { limit: number; offset: number },
) {
  const [matching, positions] = await Promise.all([
    listEntrySummaries(database, filters, "manual"),
    listEntryPositions(database, collection.id),
  ]);
  const placeInTree = new Map(orderAsTree(positions).map((id, index) => [id, index]));
  const ordered = matching.sort(
    (first, second) => (placeInTree.get(first.id) ?? 0) - (placeInTree.get(second.id) ?? 0),
  );
  return { rows: ordered.slice(page.offset, page.offset + page.limit), total: ordered.length };
}
