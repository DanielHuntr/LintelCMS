import type { DatabaseOrTransaction } from "../database/client.js";
import { withoutListedId } from "../entries/entry-references.js";
import { findGlobalValuesMentioning, replaceGlobalValuesData } from "./global-values.repository.js";

/**
 * Takes `id` out of every list of ids in global values, when the term or entry it points
 * at is deleted. The same rule as for entries (see src/entries/entry-references.ts).
 */
export async function removeReferencesFromGlobalValues(
  database: DatabaseOrTransaction,
  id: string,
): Promise<void> {
  for (const values of await findGlobalValuesMentioning(database, id)) {
    await replaceGlobalValuesData(database, values.id, withoutListedId(values.data, id));
  }
}
