import { collectPageLinkIds, resolvePageLinks } from "@lintel/builder-model";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findDeliveredEntryLinks } from "../delivery/delivered-references.js";

/**
 * Swaps every "Choose a page" link (`lintel:page/<entry id>`) inside a value for the page's
 * address in `locale`, for parts of a page that delivery doesn't hand over already resolved:
 * the site's navigation and footer, and the designs of the site's own blocks. Only
 * published pages have an address; a link to any other page is left empty, as delivery does.
 */
export async function withPageLinkAddresses<Value>(
  database: DatabaseOrTransaction,
  value: Value,
  locale: string,
): Promise<Value> {
  const entryIds = collectPageLinkIds(value);
  if (entryIds.size === 0) return value;
  const links = await findDeliveredEntryLinks(database, [...entryIds], locale);
  return resolvePageLinks(value, (entryId) => links.get(entryId)?.url ?? null);
}
