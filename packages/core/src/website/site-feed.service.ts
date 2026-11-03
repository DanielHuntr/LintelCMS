import { listDeliveredEntries } from "../delivery/delivery.service.js";
import type { SiteResponse } from "./rendered-pages-cache.js";
import { toPostSummary } from "./delivered-to-site.js";
import { localiseUrl } from "./site-chrome.service.js";
import { textResponse } from "./site-documents.js";
import type { PageRequest } from "./site-pages.service.js";
import { listBase, localisedPath } from "./site-routing.js";

/**
 * The RSS feed of each dated collection, at its list's address plus `/feed.xml`
 * (`/blog/feed.xml`): the newest posts, for feed readers and newsletters.
 */

export const FEED_FILE = "feed.xml";
const POSTS_IN_FEED = 20;

/** The collection whose feed this address is, if any. */
export function findFeedCollection(
  request: Pick<PageRequest, "context" | "localPath">,
): string | undefined {
  return request.context.collections.find((collection) => {
    const base = listBase(collection.routePattern);
    return (
      collection.structure === "dated" &&
      base !== "" &&
      request.localPath === `${base}/${FEED_FILE}`
    );
  })?.handle;
}

export async function renderFeed(
  request: PageRequest,
  collectionHandle: string,
): Promise<SiteResponse> {
  const { dependencies, context, locale } = request;
  const collection = context.collections.find(({ handle }) => handle === collectionHandle);
  const list = await listDeliveredEntries(
    dependencies.database,
    collectionHandle,
    { page: 1, perPage: POSTS_IN_FEED, locale },
    dependencies.assetLookup,
  );
  const siteUrl = context.siteAddress ?? "";
  const listUrl =
    siteUrl +
    context.pathPrefix +
    localisedPath(listBase(collection?.routePattern ?? "/"), locale, context.defaultLocale);
  const items = list.items.map((entry) => {
    const post = toPostSummary(entry, localiseUrl(entry.url ?? `/${entry.slug}`, locale, context));
    const link = siteUrl + post.url;
    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      post.publishedAt
        ? `      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>`
        : "",
      post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : "",
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(`${collection?.name ?? ""} | ${request.chrome.siteName}`)}</title>`,
    `    <link>${escapeXml(listUrl)}</link>`,
    `    <description>${escapeXml(request.chrome.siteName)}</description>`,
    `    <language>${escapeXml(locale)}</language>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
  return textResponse("application/rss+xml; charset=utf-8", xml);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
