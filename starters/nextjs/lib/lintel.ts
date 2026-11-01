import type { DeliveredEntry, DeliveredList } from "./content-types";

/**
 * Typed helpers for Lintel's delivery API. Every request is cached by Next.js and refreshed
 * in the background at most once a minute (see REVALIDATE_SECONDS), and tagged so
 * /api/revalidate can refresh it straight away.
 */

/** How often pages and data are refreshed, in seconds. Lintel's own cache is 60 seconds too. */
export const REVALIDATE_SECONDS = 60;

/** Every request carries this tag, so one call refreshes everything. */
export const ALL_CONTENT_TAG = "lintel";

/** Where Lintel's API is. Set LINTEL_API_URL in .env.local; it defaults to a local Lintel. */
export function lintelApiUrl(): string {
  return (process.env.LINTEL_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

/** Lintel answered, but with an error (other than "not found"). */
export class LintelRequestError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(`Lintel couldn't send ${path} (${status}): ${message}`);
    this.name = "LintelRequestError";
  }
}

/** Lintel didn't answer at all: it isn't running, or LINTEL_API_URL is wrong. */
export class LintelUnreachableError extends Error {
  constructor(readonly apiUrl: string) {
    super(
      `Can't reach Lintel at ${apiUrl}. Check that Lintel is running (pnpm dev) and that LINTEL_API_URL in .env.local is right.`,
    );
    this.name = "LintelUnreachableError";
  }
}

export function collectionTag(collection: string): string {
  return `${ALL_CONTENT_TAG}:${collection}`;
}

/** Reads JSON from the delivery API. Returns null for a 404, so callers can show "not found". */
async function fetchDelivery<Result>(path: string, collection: string): Promise<Result | null> {
  const apiUrl = lintelApiUrl();
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS, tags: [ALL_CONTENT_TAG, collectionTag(collection)] },
    });
  } catch {
    throw new LintelUnreachableError(apiUrl);
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new LintelRequestError(response.status, path, await errorMessage(response));
  }
  return (await response.json()) as Result;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      return String(body.message);
    }
  } catch {
    // Not JSON; the status says enough.
  }
  return response.statusText;
}

/**
 * One published entry by its slug, or null if there's no published entry with that slug
 * (drafts count as not found, so they never leak).
 *
 *   const post = await getEntry<PostData>("posts", "hello-world");
 */
export function getEntry<Data>(
  collection: string,
  slug: string,
): Promise<DeliveredEntry<Data> | null> {
  return fetchDelivery(
    `/delivery/${encodeURIComponent(collection)}/${encodeURIComponent(slug)}`,
    collection,
  );
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
 *   const { items, total } = (await listEntries<PostData>("posts", { perPage: 10 })) ?? emptyList;
 */
export function listEntries<Data>(
  collection: string,
  { page = 1, perPage = 25 }: ListOptions = {},
): Promise<DeliveredList<Data> | null> {
  const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  return fetchDelivery(`/delivery/${encodeURIComponent(collection)}?${query}`, collection);
}

/** Every published entry of a collection, a hundred at a time, for building every page. */
export async function listAllEntries<Data>(collection: string): Promise<DeliveredEntry<Data>[]> {
  const perPage = 100;
  const entries: DeliveredEntry<Data>[] = [];
  for (let page = 1; ; page += 1) {
    const list = await listEntries<Data>(collection, { page, perPage });
    if (!list) return entries;
    entries.push(...list.items);
    if (list.items.length < perPage || entries.length >= list.total) return entries;
  }
}

/**
 * Whether to show the "Built with Lintel" credit. Agencies can turn it off in Lintel
 * (Settings, then Branding). If Lintel can't be reached, the credit shows, as before.
 */
export async function showsBuiltWithLintel(): Promise<boolean> {
  try {
    const response = await fetch(`${lintelApiUrl()}/branding`, {
      headers: { accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS, tags: [ALL_CONTENT_TAG] },
    });
    if (!response.ok) return true;
    const branding = (await response.json()) as { hideBuiltWithLintel?: boolean };
    return branding.hideBuiltWithLintel !== true;
  } catch {
    return true;
  }
}
