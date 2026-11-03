import { keepPreviousData, type QueryClient, useQuery } from "@tanstack/react-query";
import { ApiError } from "../api/client.js";
import { getEntry } from "../content/content.api.js";
import type { EntryStatus } from "../content/content.types.js";
import { searchTree } from "../content-tree/contentTree.api.js";
import { useCurrentSite } from "../sites/SiteContext.js";

/**
 * A page someone picked to link to. Links store the page itself (`pageLinkHref(id)`), so
 * they follow it; `url` is its address now, such as "/about", for showing.
 */
export interface PickedPage {
  id: string;
  title: string;
  url: string;
}

export interface PageResult extends PickedPage {
  status: EntryStatus;
  collection: { handle: string; name: string };
}

/**
 * Pages of the site the admin works on whose titles contain `search`, through the content
 * tree's search. Entries without a page of their own (no address) are left out.
 */
export function usePageSearch(search: string) {
  const siteId = useCurrentSite()?.site.id;
  const trimmed = search.trim();
  return useQuery({
    queryKey: ["page-links", "search", trimmed, siteId],
    queryFn: async (): Promise<PageResult[]> => {
      const { items } = await searchTree(trimmed, siteId);
      return items.flatMap((item) =>
        item.url === null
          ? []
          : [
              {
                id: item.id,
                title: item.title,
                url: item.url,
                status: item.status,
                collection: item.collection,
              },
            ],
      );
    },
    enabled: trimmed !== "",
    placeholderData: keepPreviousData,
  });
}

/** A page a link already points at, for showing its title: null when it is gone. */
export interface LinkedPage {
  id: string;
  title: string;
}

const linkedPageKey = (entryId: string) => ["page-links", "page", entryId] as const;

async function findLinkedPage(entryId: string): Promise<LinkedPage | null> {
  try {
    const entry = await getEntry(entryId);
    return { id: entry.id, title: entry.title };
  } catch (error) {
    // Deleted, or in the bin: either way the link has nowhere to go.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The page a link points at by its id, or null (in `data`) when it no longer exists. */
export function useLinkedPage(entryId: string | null) {
  return useQuery({
    queryKey: linkedPageKey(entryId ?? ""),
    queryFn: () => findLinkedPage(entryId ?? ""),
    enabled: entryId !== null,
    retry: false,
  });
}

/** The same lookup as a promise, for the page builder (see PageDesignPage). */
export function fetchLinkedPage(queryClient: QueryClient, entryId: string) {
  return queryClient.fetchQuery({
    queryKey: linkedPageKey(entryId),
    queryFn: () => findLinkedPage(entryId),
    retry: false,
  });
}
