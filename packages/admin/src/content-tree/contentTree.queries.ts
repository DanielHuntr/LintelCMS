import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { contentKeys } from "../content/content.queries.js";
import {
  getAllowedTypes,
  getCollectionItems,
  getEntryInfo,
  getEntryPath,
  getRootHostnames,
  getTreeChildren,
  getTreeRoots,
  listRecycleBin,
  searchTree,
} from "./contentTree.api.js";
import type { CollectionQuery, TreePlace } from "./contentTree.types.js";

/** How many children the tree loads at once; "Show more" loads the next lot. */
export const TREE_PAGE_SIZE = 100;

/** How many rows a page of the collection view shows. */
export const COLLECTION_PAGE_SIZE = 25;

/**
 * Cache keys for the tree. Everything sits under "content-tree", so one invalidation
 * refreshes every level that is open after a change.
 */
export const treeKeys = {
  all: () => ["content-tree"] as const,
  roots: (siteId: string | undefined) => ["content-tree", "roots", siteId ?? "main"] as const,
  children: (place: TreePlace, siteId: string | undefined) =>
    ["content-tree", "children", place, siteId ?? "main"] as const,
  search: (search: string, siteId: string | undefined) =>
    ["content-tree", "search", search, siteId ?? "main"] as const,
  allowedTypes: (place: TreePlace | null) => ["content-tree", "allowed", place] as const,
  path: (entryId: string) => ["content-tree", "path", entryId] as const,
  info: (entryId: string) => ["content-tree", "info", entryId] as const,
  items: (place: TreePlace, query: CollectionQuery) =>
    ["content-tree", "items", place, query] as const,
  recycleBin: () => ["content-tree", "recycle-bin"] as const,
  hostnames: (entryId: string) => ["content-tree", "hostnames", entryId] as const,
  moveTargets: (collection: string, siteId: string | undefined) =>
    ["content-tree", "move-targets", collection, siteId ?? "main"] as const,
};

export function useRootHostnames(entryId: string) {
  return useQuery({
    queryKey: treeKeys.hostnames(entryId),
    queryFn: () => getRootHostnames(entryId),
  });
}

export function useTreeRoots(siteId: string | undefined) {
  return useQuery({ queryKey: treeKeys.roots(siteId), queryFn: () => getTreeRoots(siteId) });
}

/** One level of the tree, loaded a page at a time as people ask for more. */
export function useTreeChildren(place: TreePlace, siteId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: treeKeys.children(place, siteId),
    queryFn: ({ pageParam }) =>
      getTreeChildren(place, { offset: pageParam, limit: TREE_PAGE_SIZE }, siteId),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
    enabled,
  });
}

/** How many pages each level of "Move…" lists before a search is needed. */
const MOVE_TARGETS_PER_LEVEL = 50;

/**
 * The places "Move…" offers before anything is typed: the top of the collection's tree and
 * one level under each page there (the home page's pages), with how deep each one is.
 */
export function useMoveTargets(collection: string, siteId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: treeKeys.moveTargets(collection, siteId),
    queryFn: async () => {
      const page = { offset: 0, limit: MOVE_TARGETS_PER_LEVEL };
      const top = await getTreeChildren({ collection }, page, siteId);
      const under = await Promise.all(
        top.items.map((node) =>
          node.childCount > 0 && !node.childrenAsCollection
            ? getTreeChildren({ parentId: node.id }, page, siteId)
            : null,
        ),
      );
      return top.items.flatMap((node, index) => [
        { node, depth: 0 },
        ...(under[index]?.items ?? []).map((child) => ({ node: child, depth: 1 })),
      ]);
    },
    enabled,
  });
}

export function useTreeSearch(search: string, siteId: string | undefined) {
  return useQuery({
    queryKey: treeKeys.search(search, siteId),
    queryFn: () => searchTree(search, siteId),
    enabled: search.trim() !== "",
    placeholderData: keepPreviousData,
  });
}

export function useAllowedTypes(place: TreePlace | null, enabled = true) {
  return useQuery({
    queryKey: treeKeys.allowedTypes(place),
    queryFn: () => getAllowedTypes(place),
    enabled,
  });
}

export function useEntryPath(entryId: string | undefined) {
  return useQuery({
    queryKey: treeKeys.path(entryId ?? "none"),
    queryFn: () => getEntryPath(entryId ?? ""),
    enabled: entryId !== undefined,
  });
}

/** Undefined (a new entry, not saved yet) asks nothing. */
export function useEntryInfo(entryId: string | undefined) {
  return useQuery({
    queryKey: treeKeys.info(entryId ?? "none"),
    queryFn: () => getEntryInfo(entryId ?? ""),
    enabled: entryId !== undefined,
  });
}

export function useCollectionItems(place: TreePlace, query: CollectionQuery) {
  return useQuery({
    queryKey: treeKeys.items(place, query),
    queryFn: () => getCollectionItems(place, { ...query, perPage: COLLECTION_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

export function useRecycleBin() {
  return useQuery({ queryKey: treeKeys.recycleBin(), queryFn: listRecycleBin });
}

/**
 * After anything changes the tree: refresh every open level, the lists, and the entries
 * that changed, so the editor shows a status changed from the tree.
 */
export function useRefreshContent() {
  const queryClient = useQueryClient();
  return useCallback(
    async (changedEntryIds: readonly string[] = []) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: treeKeys.all() }),
        queryClient.invalidateQueries({ queryKey: contentKeys.collections() }),
        ...changedEntryIds.map((entryId) =>
          queryClient.invalidateQueries({ queryKey: contentKeys.entry(entryId) }),
        ),
      ]);
    },
    [queryClient],
  );
}
