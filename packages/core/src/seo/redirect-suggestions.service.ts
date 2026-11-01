import type { EntryEventData } from "../content-events/entry-event-data.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  deleteRedirectFrom,
  findRedirectFrom,
  insertRedirect,
  retargetRedirects,
  updateRedirectRow,
} from "./redirects.repository.js";
import { isSeoPluginEnabled } from "./seo-enabled.js";

/**
 * When a live page's address changes ("/about-us" becomes "/about"), links and search
 * results still point at the old one. Lintel suggests a 301 redirect from the old address
 * to the new; it does nothing until someone accepts it in the redirects manager.
 *
 * Called through src/content-events when an entry moves.
 */
export async function suggestRedirectForMovedEntry(
  database: DatabaseOrTransaction,
  previousUrl: string,
  entry: EntryEventData,
): Promise<void> {
  if (!entry.url || previousUrl === entry.url || !(await isSeoPluginEnabled(database))) {
    return;
  }
  const newUrl = entry.url;

  await database.transaction(async (transaction) => {
    // The page lives at the new address now, so nothing should send people away from it.
    await deleteRedirectFrom(transaction, DEFAULT_TENANT_ID, newUrl);

    const existing = await findRedirectFrom(transaction, DEFAULT_TENANT_ID, previousUrl);
    if (!existing) {
      const suggestion = await insertRedirect(transaction, {
        tenantId: DEFAULT_TENANT_ID,
        fromPath: previousUrl,
        toPath: newUrl,
        statusCode: 301,
        status: "suggested",
        source: "automatic",
        entryId: entry.id,
      });
      await retargetRedirects(transaction, DEFAULT_TENANT_ID, previousUrl, newUrl, suggestion.id);
      return;
    }
    // A rule someone made on purpose is left alone; an earlier suggestion is brought up to date.
    if (existing.status === "suggested") {
      await updateRedirectRow(transaction, DEFAULT_TENANT_ID, existing.id, { toPath: newUrl });
    }
    await retargetRedirects(transaction, DEFAULT_TENANT_ID, previousUrl, newUrl, existing.id);
  });
}
