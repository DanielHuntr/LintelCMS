/**
 * Where "View page" goes for a published entry. With a connected website (Settings → Site)
 * it is the page itself; without one, Lintel's simple preview of the published version.
 */

export type ViewPageTarget =
  { kind: "website"; href: string } | { kind: "builtIn"; collection: string; entryId: string };

interface ViewableEntry {
  id: string;
  slug: string;
  status: string;
  publishedAt: string | null;
}

/** The page's path on the site, filling in the route pattern from the publish date. */
export function publishedPath(routePattern: string, entry: ViewableEntry): string | null {
  if (!routePattern) return null;
  const published = entry.publishedAt ? new Date(entry.publishedAt) : new Date();
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  return routePattern
    .replaceAll("{slug}", entry.slug)
    .replaceAll("{year}", String(published.getUTCFullYear()))
    .replaceAll("{month}", twoDigits(published.getUTCMonth() + 1))
    .replaceAll("{day}", twoDigits(published.getUTCDate()));
}

/** Undefined when there is nothing live to look at yet. */
export function viewPageTarget(
  siteAddress: string,
  collection: { handle: string; routePattern: string },
  entry: ViewableEntry,
): ViewPageTarget | undefined {
  if (entry.status !== "published") return undefined;
  const path = publishedPath(collection.routePattern, entry);
  if (siteAddress && path !== null) {
    return { kind: "website", href: `${siteAddress}${path}` };
  }
  return { kind: "builtIn", collection: collection.handle, entryId: entry.id };
}
