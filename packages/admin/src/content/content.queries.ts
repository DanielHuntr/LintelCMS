import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getCollection,
  getEntry,
  listCollections,
  listEntries,
  listRevisions,
} from "./content.api.js";
import type { EntriesFilter } from "./entriesQuery.js";

/**
 * Cache keys for content. They nest, so invalidating `contentKeys.collection("posts")`
 * also refreshes every page of that collection's entries.
 */
export const contentKeys = {
  collections: () => ["collections"] as const,
  collection: (handle: string) => ["collections", handle] as const,
  entries: (handle: string, filter: EntriesFilter) =>
    ["collections", handle, "entries", filter] as const,
  entry: (entryId: string) => ["entries", entryId] as const,
  revisions: (entryId: string) => ["entries", entryId, "revisions"] as const,
};

export function useCollections() {
  return useQuery({ queryKey: contentKeys.collections(), queryFn: listCollections });
}

export function useCollection(handle: string) {
  return useQuery({
    queryKey: contentKeys.collection(handle),
    queryFn: () => getCollection(handle),
  });
}

export function useEntries(handle: string, filter: EntriesFilter) {
  return useQuery({
    queryKey: contentKeys.entries(handle, filter),
    queryFn: () => listEntries(handle, filter),
    // Keep the old rows on screen while the next page or filter loads, so the list doesn't flash.
    placeholderData: keepPreviousData,
  });
}

/** `entryId` is undefined for a new entry, which has nothing to load. */
export function useEntry(entryId: string | undefined) {
  return useQuery({
    queryKey: contentKeys.entry(entryId ?? "new"),
    queryFn: () => getEntry(entryId ?? ""),
    enabled: entryId !== undefined,
    // The editor owns the entry while it is open; a background refetch must not replace typing.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useRevisions(entryId: string | undefined) {
  return useQuery({
    queryKey: contentKeys.revisions(entryId ?? "new"),
    queryFn: () => listRevisions(entryId ?? ""),
    enabled: entryId !== undefined,
  });
}
