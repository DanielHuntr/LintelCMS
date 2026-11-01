import { apiRequest } from "../api/client.js";
import type { Entry } from "../content/content.types.js";
import type {
  AllowedType,
  BatchResult,
  CollectionItems,
  CollectionQuery,
  EntryInfo,
  PathStep,
  RecycleBinItem,
  TreeLevel,
  TreeNode,
  TreePlace,
  TreeRoots,
} from "./contentTree.types.js";

/** Calls to the content tree and recycle bin routes. One function per route. */

function query(values: Record<string, string | number | undefined>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") parameters.set(key, String(value));
  }
  const text = parameters.toString();
  return text === "" ? "" : `?${text}`;
}

function placeQuery(place: TreePlace) {
  return "parentId" in place ? { parentId: place.parentId } : { collection: place.collection };
}

export function getTreeRoots(siteId: string | undefined): Promise<TreeRoots> {
  return apiRequest<TreeRoots>(`/content-tree${query({ siteId })}`);
}

export function getTreeChildren(
  place: TreePlace,
  page: { offset: number; limit: number },
  siteId?: string,
): Promise<TreeLevel> {
  return apiRequest<TreeLevel>(
    `/content-tree/children${query({ ...placeQuery(place), ...page, siteId })}`,
  );
}

export function searchTree(search: string, siteId?: string): Promise<{ items: TreeNode[] }> {
  return apiRequest(`/content-tree/search${query({ search, siteId })}`);
}

export function getAllowedTypes(place: TreePlace | null): Promise<{ types: AllowedType[] }> {
  return apiRequest(`/content-tree/allowed-types${query(place ? placeQuery(place) : {})}`);
}

export function getEntryPath(entryId: string): Promise<{ path: PathStep[] }> {
  return apiRequest(`/content-tree/entries/${entryId}/path`);
}

export function getEntryInfo(entryId: string): Promise<EntryInfo> {
  return apiRequest(`/content-tree/entries/${entryId}/info`);
}

export function getCollectionItems(
  place: TreePlace,
  options: CollectionQuery & { perPage: number },
): Promise<CollectionItems> {
  return apiRequest(`/content-tree/items${query({ ...placeQuery(place), ...options })}`);
}

/** Answers where the entry was, so the move can be undone. */
export function moveEntry(
  entryId: string,
  parentId: string | null,
  index: number,
): Promise<{ previous: { parentId: string | null; index: number } }> {
  return apiRequest("/content-tree/move", { method: "POST", body: { entryId, parentId, index } });
}

export function sortChildren(
  parentId: string | null,
  collection: string | undefined,
  order: string[],
): Promise<void> {
  return apiRequest("/content-tree/sort", {
    method: "POST",
    body: { parentId, collection, order },
  });
}

export function publishBranch(entryId: string, includeDescendants: boolean): Promise<BatchResult> {
  return apiRequest(`/content-tree/entries/${entryId}/publish`, {
    method: "POST",
    body: { includeDescendants },
  });
}

export function unpublishBranch(
  entryId: string,
  includeDescendants: boolean,
): Promise<BatchResult> {
  return apiRequest(`/content-tree/entries/${entryId}/unpublish`, {
    method: "POST",
    body: { includeDescendants },
  });
}

export function duplicateBranch(
  entryId: string,
  includeDescendants: boolean,
): Promise<{ entry: Entry; copied: number }> {
  return apiRequest(`/content-tree/entries/${entryId}/duplicate`, {
    method: "POST",
    body: { includeDescendants },
  });
}

export function moveToRecycleBin(entryId: string): Promise<{ itemId: string; entryIds: string[] }> {
  return apiRequest(`/content-tree/entries/${entryId}/recycle`, { method: "POST" });
}

export function runBulkAction(
  action: "publish" | "unpublish" | "move" | "recycle",
  entryIds: string[],
  parentId?: string | null,
): Promise<BatchResult> {
  return apiRequest("/content-tree/bulk", {
    method: "POST",
    body: { action, entryIds, parentId },
  });
}

export function listRecycleBin(): Promise<{ items: RecycleBinItem[] }> {
  return apiRequest("/recycle-bin");
}

export function restoreFromRecycleBin(
  itemId: string,
): Promise<{ entryId: string; parentId: string | null; restoredCount: number }> {
  return apiRequest(`/recycle-bin/${itemId}/restore`, { method: "POST" });
}

export function deleteFromRecycleBin(itemId: string): Promise<void> {
  return apiRequest(`/recycle-bin/${itemId}`, { method: "DELETE" });
}

export function emptyRecycleBin(): Promise<{ deleted: number }> {
  return apiRequest("/recycle-bin", { method: "DELETE" });
}
