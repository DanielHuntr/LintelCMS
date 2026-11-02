import type { DatabaseOrTransaction } from "../database/client.js";
import { type FieldRename, moveFieldValues } from "./field-renames.repository.js";

export type { FieldRename } from "./field-renames.repository.js";

/**
 * Renaming a field's handle keeps its content. Entries store values by handle, so without
 * this the values stayed under the old handle: the website stopped showing them at once, and
 * the next save of each entry dropped them (LINTEL-DATA-003).
 *
 * The admin says which handles it renamed, since a field list alone can't tell a rename from
 * removing one field and adding another. A rename only counts when the old handle was there
 * before, the new one is there now, and the old one is gone; anything else is ignored.
 */
export async function moveRenamedFieldValues(
  database: DatabaseOrTransaction,
  blueprintId: string,
  renames: readonly FieldRename[],
  handles: { before: ReadonlySet<string>; after: ReadonlySet<string> },
): Promise<void> {
  for (const rename of renames) {
    const isRename =
      rename.from !== rename.to &&
      handles.before.has(rename.from) &&
      handles.after.has(rename.to) &&
      !handles.after.has(rename.from);
    if (isRename) await moveFieldValues(database, blueprintId, rename);
  }
}
