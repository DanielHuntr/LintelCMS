/**
 * `{path}` is a page's place in its tree ("about/team"). It needs the entry's parents, so
 * buildEntryUrl leaves it for `placeEntryUrls` (src/content-roots), which every address
 * passes through, to fill in.
 */
export const TREE_PATH_PLACEHOLDER = "{path}";

/**
 * Fills in a collection's route pattern for one entry: "/blog/{year}/{slug}" becomes
 * "/blog/2026/hello-world". Dates use the publish date in UTC, so a page's address
 * doesn't depend on the server's time zone.
 *
 * Returns null when the collection has no route pattern (its entries have no page).
 */
export function buildEntryUrl(
  routePattern: string | null,
  entry: { slug: string; publishedAt: Date | null },
): string | null {
  if (routePattern === null) {
    return null;
  }
  const date = entry.publishedAt ?? new Date(0);
  const values: Record<string, string> = {
    "{slug}": entry.slug,
    "{year}": String(date.getUTCFullYear()),
    "{month}": String(date.getUTCMonth() + 1).padStart(2, "0"),
    "{day}": String(date.getUTCDate()).padStart(2, "0"),
  };
  return routePattern.replace(/\{[a-z]+\}/g, (placeholder) => values[placeholder] ?? placeholder);
}
