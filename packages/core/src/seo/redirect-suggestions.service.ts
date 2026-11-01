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
  await redirectMovedPage(
    database,
    { entryId: entry.id, fromPath: previousUrl, toPath: entry.url },
    "suggested",
  );
}

export interface MovedPage {
  entryId: string;
  fromPath: string;
  toPath: string;
}

/**
 * "Add redirects" after moving pages in the content tree: a working 301 from each old
 * address, accepting the suggestion made when it moved. A redirect someone made on purpose
 * from the old address is left as it is and counted in `kept`.
 */
export async function addRedirectsForMovedPages(
  database: DatabaseOrTransaction,
  moves: readonly MovedPage[],
): Promise<{ added: number; kept: number }> {
  let added = 0;
  let kept = 0;
  for (const move of moves) {
    if (move.fromPath === move.toPath) {
      continue;
    }
    const isAdded = await redirectMovedPage(database, move, "active");
    if (isAdded) added += 1;
    else kept += 1;
  }
  return { added, kept };
}

/**
 * The redirect for one moved page, as a suggestion or working straight away. Answers false
 * when a redirect someone made on purpose already starts at the old address.
 */
async function redirectMovedPage(
  database: DatabaseOrTransaction,
  move: MovedPage,
  status: "active" | "suggested",
): Promise<boolean> {
  const { fromPath, toPath } = move;
  return database.transaction(async (transaction) => {
    // The page lives at the new address now, so nothing should send people away from it.
    await deleteRedirectFrom(transaction, DEFAULT_TENANT_ID, toPath);

    const existing = await findRedirectFrom(transaction, DEFAULT_TENANT_ID, fromPath);
    if (!existing) {
      const created = await insertRedirect(transaction, {
        tenantId: DEFAULT_TENANT_ID,
        fromPath,
        toPath,
        statusCode: 301,
        status,
        source: "automatic",
        entryId: move.entryId,
      });
      await retargetRedirects(transaction, DEFAULT_TENANT_ID, fromPath, toPath, created.id);
      return true;
    }
    // A rule someone made on purpose is left alone; an earlier suggestion is brought up to date.
    const isSuggestion = existing.status === "suggested";
    if (isSuggestion) {
      await updateRedirectRow(transaction, DEFAULT_TENANT_ID, existing.id, { toPath, status });
    }
    await retargetRedirects(transaction, DEFAULT_TENANT_ID, fromPath, toPath, existing.id);
    return isSuggestion || existing.toPath === toPath;
  });
}
