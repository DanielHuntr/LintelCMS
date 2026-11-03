import type { SignedIn } from "../auth/auth.schema.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { checkSiteAccess } from "../sites/request-site.js";
import { findSiteByIdOrFail } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { findEntryOrFail } from "../entries/entries.service.js";

/**
 * Which page of which site an entry is, so its panel can show that page's visitors. An entry
 * without a page of its own (a collection with no addresses) has the path null.
 */
export async function findEntryPage(
  database: DatabaseOrTransaction,
  signedIn: SignedIn | null,
  entryId: string,
): Promise<{ site: Site; path: string | null }> {
  const entry = await findEntryOrFail(database, entryId);
  const site = await findSiteByIdOrFail(database, entry.siteId);
  checkSiteAccess(signedIn, site);
  const { url } = await describeEntryForEvent(database, entryId);
  return { site, path: url === null ? null : pathOf(url) };
}

/** Entry addresses are paths ("/about"), or full addresses for a page on its own domain. */
function pathOf(url: string): string {
  try {
    return new URL(url, "http://site.invalid").pathname;
  } catch {
    return url;
  }
}
