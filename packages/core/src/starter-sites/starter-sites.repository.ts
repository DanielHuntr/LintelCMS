import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { jsonText } from "../database/dialect/expressions.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads for templates, nothing else. */

/** One collection's entries on one site and language: the pages a template would join. */
export async function listCollectionPages(
  database: DatabaseOrTransaction,
  collectionId: string,
  siteId: string,
  locale: string,
) {
  const entriesTable = tableFor(database, entriesDefinition);
  return database
    .select({
      id: entriesTable.id,
      slug: entriesTable.slug,
      parentId: entriesTable.parentId,
      title: jsonText(database, entriesTable.data, "title"),
    })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.collectionId, collectionId),
        eq(entriesTable.siteId, siteId),
        eq(entriesTable.locale, locale),
      ),
    );
}
