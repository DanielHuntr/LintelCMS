import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { placeEntryUrl } from "../content-roots/content-roots.service.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { findEntryOrFail } from "../entries/entries.service.js";

/** What events say about an entry: enough to find it, without its whole content. */
export interface EntryEventData {
  id: string;
  collection: string;
  slug: string;
  title: string;
  /** The entry's page on the site, or null when its collection has no pages. */
  url: string | null;
  status: string;
  publishedAt: string | null;
}

/** What events say about an uploaded file. */
export interface AssetEventData {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
}

/**
 * Reads the entry as it is now. Call it before deleting one, since afterwards there is
 * nothing left to read.
 */
export async function describeEntryForEvent(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<EntryEventData> {
  const entry = await findEntryOrFail(database, entryId);
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const title = entry.data.title;
  return {
    id: entry.id,
    collection: collection.handle,
    slug: entry.slug,
    title: typeof title === "string" ? title : "",
    url: await placeEntryUrl(database, entry.id, buildEntryUrl(collection.routePattern, entry)),
    status: entry.status,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
  };
}
