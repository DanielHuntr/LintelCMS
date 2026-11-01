import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import { placeEntryUrls } from "../content-roots/content-roots.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { AddressTakenError } from "./entries.errors.js";
import { findEntryById, findSameSlugPages } from "./entries.repository.js";

/**
 * Refuses a page whose address another page on the site already answers on (a "Landing
 * pages" collection at "/{slug}" beside Pages, say). Called inside the transaction that
 * creates, renames or moves the page, so a refusal changes nothing.
 */
export async function checkAddressIsFree(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<void> {
  const entry = await findEntryById(database, entryId);
  if (!entry) return;
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  if (collection.routePattern === null) return;
  const others = await findSameSlugPages(database, entry);
  if (others.length === 0) return;
  const urls = await placeEntryUrls(database, [
    { id: entry.id, url: buildEntryUrl(collection.routePattern, entry) },
    ...others.map((other) => ({ id: other.id, url: buildEntryUrl(other.routePattern, other) })),
  ]);
  const address = urls.get(entry.id);
  const clash = others.find((other) => address && urls.get(other.id) === address);
  if (address && clash) {
    throw new AddressTakenError(address, clash.title ?? "");
  }
}
