import type { EntryStatus } from "./content.types.js";

/** The entries list's filter, as kept in the page's URL. */
export interface EntriesFilter {
  /** Undefined shows every status. */
  status?: EntryStatus;
  search?: string;
  page?: number;
  /** Defaults to `entriesPerPage`. The parent page picker asks for more. */
  perPage?: number;
}

export const entriesPerPage = 25;

/**
 * The API path for a page of a collection's entries. Empty filters are left out, so the
 * request (and the cache key built from it) is the same however the filter was cleared.
 */
export function entriesListPath(collectionHandle: string, filter: EntriesFilter): string {
  const query = new URLSearchParams();
  if (filter.status) query.set("status", filter.status);
  const search = filter.search?.trim();
  if (search) query.set("search", search);
  query.set("page", String(filter.page ?? 1));
  query.set("perPage", String(filter.perPage ?? entriesPerPage));
  return `/collections/${encodeURIComponent(collectionHandle)}/entries?${query.toString()}`;
}
