import type { PostSummary } from "@lintel/site-components";
import { listDeliveredEntries } from "../delivery/delivery.service.js";
import { entrySummary, entryTitle, toPostSummary } from "./delivered-to-site.js";
import type { SiteResponse } from "./rendered-pages-cache.js";
import { localiseUrl } from "./site-chrome.service.js";
import { type PageRequest, renderWithHead } from "./site-pages.service.js";

/**
 * `/search?q=bread`: what the Search box element (and `{% search_box %}` in Liquid templates)
 * sends visitors to. Published entries of the collections that have pages whose words
 * (title, summary, body and the text of their design) have every word searched for, best
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
        dependencies.site,
      );
      for (const entry of list.items) {
        const title = entryTitle(entry).toLowerCase();
        const text = `${title} ${entrySummary(entry)} ${entryWords(entry.data)}`.toLowerCase();
        if (!words.every((word) => text.includes(word))) continue;
        const url = localiseUrl(entry.url ?? `/${entry.slug}`, locale, context);
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

/** Keys whose text is an address, a name for code or a setting rather than words to find. */
const technicalKeys = new Set([
  "id",
  "url",
  "href",
  "src",
  "slug",
  "type",
  "handle",
  "locale",
  "class",
  "className",
  "style",
  "styles",
  "json",
  "focalPoint",
  "collection",
  "taxonomy",
  "variant",
  "icon",
]);

const MOST_WORDS_READ = 20_000;

/**
 * The words in an entry's published data, wherever they are: text fields, rich text and
 * Markdown (as their HTML, tags taken out), blocks and a page design's text. Addresses,
 * colours and other settings are skipped, so searching "https" or "flex" finds nothing.
 */
export function entryWords(data: unknown): string {
  const parts: string[] = [];
  let length = 0;
  const visit = (value: unknown, key: string, depth: number) => {
    if (length > MOST_WORDS_READ || depth > 30 || technicalKeys.has(key)) return;
    if (typeof value === "string") {
      if (!looksLikeWords(value)) return;
      const words = key === "html" ? textOfHtml(value) : value;
      parts.push(words);
      length += words.length;
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item, key, depth + 1);
    } else if (typeof value === "object" && value !== null) {
      for (const [innerKey, inner] of Object.entries(value)) visit(inner, innerKey, depth + 1);
    }
  };
  visit(data, "", 0);
  return parts.join(" ").slice(0, MOST_WORDS_READ);
}

function looksLikeWords(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Addresses, colours and sizes.
  if (/^(https?:|mailto:|tel:|\/|#|lintel:|[\d.]+(px|rem|em|%)?$)/i.test(trimmed)) return false;
  // A design's settings ("center", "flex", "newest", "buttonLabel"): one lowercase token.
  return !/^[a-z][a-zA-Z0-9-]*$/.test(trimmed);
}

function textOfHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/\s+/g, " ");
}
