import { and, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";

/** Database reads for templates, nothing else. */

/** One collection's entries on one site and language: the pages a template would join. */
export async function listCollectionPages(
  database: DatabaseOrTransaction,
  collectionId: string,
  siteId: string,
  locale: string,
) {
  return database
    .select({
      id: entriesTable.id,
      slug: entriesTable.slug,
      parentId: entriesTable.parentId,
      title: sql<string | null>`${entriesTable.data}->>'title'`,
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
