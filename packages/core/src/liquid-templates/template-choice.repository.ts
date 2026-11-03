import { eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { TEMPLATE_CHOICE_KEY } from "./template-choice.js";

/**
 * The template choice stored with an entry: in its published values for the live page, in
 * its working copy for a preview. Delivery leaves the key out (it isn't a field), so the
 * website reads it here. Undefined when nothing was chosen.
 */
export async function findStoredTemplateChoice(
  database: DatabaseOrTransaction,
  entryId: string,
  copy: "published" | "draft",
): Promise<unknown> {
  const column = copy === "published" ? entriesTable.publishedData : entriesTable.data;
  const [row] = await database
    .select({ choice: sql<unknown>`${column} -> ${TEMPLATE_CHOICE_KEY}` })
    .from(entriesTable)
    .where(eq(entriesTable.id, entryId))
    .limit(1);
  return row?.choice ?? undefined;
}
