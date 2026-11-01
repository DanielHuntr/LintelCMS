import { pageAddress } from "../website/pageAddress.js";

/**
 * Where "View page" goes for a published entry. There is one site address (Settings → Your website,
 * or the built-in website's own when none is typed; `GET /website/address` answers with
 * whichever applies). With one, it is the page itself, built the way the website serves it
 * (see website/pageAddress.ts). Without one, Lintel's simple preview of the published version.
 */

export type ViewPageTarget =
  { kind: "website"; href: string } | { kind: "builtIn"; collection: string; entryId: string };

interface ViewableEntry {
  id: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  locale: string;
}

/** The site's address and default language, from `GET /website/address`. */
export interface ViewPageSite {
  siteAddress: string | null;
  defaultLocale: string;
}

/**
 * Undefined when there is nothing live to look at yet, and while the site's address is still
 * loading (`site` undefined), so the link doesn't change under someone's pointer.
 */
export function viewPageTarget(
  site: ViewPageSite | undefined,
  collection: { handle: string; routePattern: string | null },
  entry: ViewableEntry,
  /** The address the server worked out for the entry, when known (see pageAddress). */
  placedUrl?: string | null,
): ViewPageTarget | undefined {
  if (entry.status !== "published" || !site) return undefined;
  if (site?.siteAddress && collection.routePattern) {
    return {
      kind: "website",
      href: pageAddress(
        site.siteAddress,
        collection.routePattern,
        entry,
        site.defaultLocale,
        placedUrl,
      ),
    };
  }
  return { kind: "builtIn", collection: collection.handle, entryId: entry.id };
}
