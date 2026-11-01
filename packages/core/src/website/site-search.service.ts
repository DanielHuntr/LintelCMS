import type { PostSummary } from "@lintel/site-components";
import { listDeliveredEntries } from "../delivery/delivery.service.js";
import { entrySummary, entryTitle, toPostSummary } from "./delivered-to-site.js";
import type { SiteResponse } from "./rendered-pages-cache.js";
import { localiseUrl } from "./site-chrome.service.js";
import { type PageRequest, renderWithHead } from "./site-pages.service.js";

/**
 * `/search?q=bread`: what the Search box element sends visitors to. Published entries of the
 * collections that have pages whose title or summary has every word searched for, best
 * matches (in the title) first. A small site's search: the newest entries of each
 * collection are looked through, so nothing needs indexing.
 */

const ENTRIES_LOOKED_THROUGH = 200;
const RESULTS_SHOWN = 50;

export async function renderSearch(request: PageRequest): Promise<SiteResponse> {
  const { dependencies, context, locale } = request;
  const words = (request.query.search ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10);
  const found: Array<{ summary: PostSummary; inTitle: boolean }> = [];
  if (words.length > 0) {
    for (const collection of context.collections) {
      const list = await listDeliveredEntries(
        dependencies.database,
        collection.handle,
        { page: 1, perPage: ENTRIES_LOOKED_THROUGH, locale },
        dependencies.assetLookup,
      );
      for (const entry of list.items) {
        const title = entryTitle(entry).toLowerCase();
        const text = `${title} ${entrySummary(entry).toLowerCase()}`;
        if (!words.every((word) => text.includes(word))) continue;
        const url = localiseUrl(entry.url ?? `/${entry.slug}`, locale, context.defaultLocale);
        found.push({
          summary: toPostSummary(entry, url),
          inTitle: words.every((word) => title.includes(word)),
        });
      }
    }
  }
  const posts = found
    .sort((first, second) => Number(second.inTitle) - Number(first.inTitle))
    .slice(0, RESULTS_SHOWN)
    .map((result) => result.summary);
  const searched = words.join(" ");
  const title = searched ? `Search results for “${searched}”` : "Search";
  const description = !searched
    ? "Type what you’re looking for in the search box."
    : posts.length === 0
      ? "Nothing matched. Try fewer or different words."
      : `${posts.length} ${posts.length === 1 ? "page" : "pages"} found.`;
  return renderWithHead(
    request,
    {
      kind: "postList",
      title,
      description,
      posts,
      pagination: { page: 1, totalPages: 1, previousUrl: null, nextUrl: null },
    },
    {
      entryId: null,
      title,
      description,
      image: null,
      path: request.path,
      type: "website",
      publishedAt: null,
      alternates: [],
      noindex: true,
    },
  );
}
