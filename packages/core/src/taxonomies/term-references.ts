import type { DatabaseOrTransaction } from "../database/client.js";
import { removeReferencesFromEntries } from "../entries/entry-references.js";
import { removeReferencesFromGlobalValues } from "../globals/global-references.js";

/**
 * Takes these terms out of every entry and global set that chose them, before they are
 * deleted, so a deleted tag never stops someone saving an unrelated change.
 */
export async function forgetTerms(
  database: DatabaseOrTransaction,
  termIds: readonly string[],
): Promise<void> {
  for (const termId of termIds) {
    await removeReferencesFromEntries(database, termId);
    await removeReferencesFromGlobalValues(database, termId);
  }
}
