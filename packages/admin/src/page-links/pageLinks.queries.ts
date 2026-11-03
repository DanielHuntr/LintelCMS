import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { EntryStatus } from "../content/content.types.js";
import { searchTree } from "../content-tree/contentTree.api.js";
import { useCurrentSite } from "../sites/SiteContext.js";

/** A page someone picked to link to: `url` is its address on the site, such as "/about". */
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
