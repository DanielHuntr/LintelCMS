import {
  type CollectionData,
  type CollectionHandle,
  createLintelClient,
  type DeliveredEntry,
  type DeliveredList,
  LintelRequestError,
  LintelUnreachableError,
} from "./lintel.generated";

export { LintelRequestError, LintelUnreachableError };

/**
 * Typed helpers for Lintel's delivery API, built on the generated client in
 * lintel.generated.ts: `getEntry("posts", slug)` knows a post's fields. Every request is
 * cached by Next.js and refreshed in the background at most once a minute (see
 * REVALIDATE_SECONDS), and tagged so /api/revalidate can refresh it straight away.
 */

/** How often pages and data are refreshed, in seconds. Lintel's own cache is 60 seconds too. */
export const REVALIDATE_SECONDS = 60;

/** Every request carries this tag, so one call refreshes everything. */
export const ALL_CONTENT_TAG = "lintel";

/** Where Lintel's API is. Set LINTEL_API_URL in .env.local; it defaults to a local Lintel. */
export function lintelApiUrl(): string {
  return (process.env.LINTEL_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

export function collectionTag(collection: string): string {
  return `${ALL_CONTENT_TAG}:${collection}`;
}

/** A client for each request, so a change to LINTEL_API_URL is picked up. */
function lintel() {
  return createLintelClient({
    apiUrl: lintelApiUrl(),
    requestInit: ({ handle }) => ({
      next: { revalidate: REVALIDATE_SECONDS, tags: [ALL_CONTENT_TAG, collectionTag(handle)] },
    }),
  });
}

/**
 * One published entry by its slug, or null if there's no published entry with that slug
 * (drafts count as not found, so they never leak).
 *
 *   const post = await getEntry("posts", "hello-world"); // post.data is PostData
 */
export function getEntry<Collection extends CollectionHandle>(
  collection: Collection,
  slug: string,
): Promise<DeliveredEntry<CollectionData[Collection]> | null> {
  return lintel().getEntry(collection, slug);
}

export interface ListOptions {
  /** Starts at 1. */
  page?: number;
  /** 25 by default, 100 at most. */
  perPage?: number;
}

/**
 * A page of published entries: newest first for blog posts, in the order editors set for
 * pages. Null if the collection doesn't exist (for example, the Blog feature is off).
 *
 *   const { items, total } = (await listEntries("posts", { perPage: 10 })) ?? emptyList;
 */
export function listEntries<Collection extends CollectionHandle>(
  collection: Collection,
  { page = 1, perPage = 25 }: ListOptions = {},
): Promise<DeliveredList<CollectionData[Collection]> | null> {
  return lintel().listEntries(collection, { page, perPage });
}

/** Every published entry of a collection, a hundred at a time, for building every page. */
export async function listAllEntries<Collection extends CollectionHandle>(
  collection: Collection,
): Promise<DeliveredEntry<CollectionData[Collection]>[]> {
  const perPage = 100;
  const entries: DeliveredEntry<CollectionData[Collection]>[] = [];
  for (let page = 1; ; page += 1) {
    const list = await listEntries(collection, { page, perPage });
    if (!list) return entries;
    entries.push(...list.items);
    if (list.items.length < perPage || entries.length >= list.total) return entries;
  }
}
