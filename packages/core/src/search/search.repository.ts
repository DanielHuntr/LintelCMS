import { and, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable, type EntryStatus } from "../entries/entries.table.js";
import { type AssetRow, assetsTable } from "../media/media.table.js";
import { escapeLikePattern, prefixTsQuery } from "./search-terms.js";

/**
 * Database reads for search, nothing else.
 *
 * Entries use Postgres full-text search (the built-in database is Postgres too, so it works
 * there the same way). The document is the title, weighted highest, then the slug, then every
 * text value in the entry's fields, inside rich text and blocks included:
 * `jsonb_to_tsvector(..., '["string"]')` reads string values only, never the JSON keys. The
 * "simple" configuration doesn't stem or drop words, so it behaves the same in any language.
 */

export interface EntrySearchRow {
  id: string;
  title: string | null;
  slug: string;
  status: EntryStatus;
  collectionHandle: string;
  collectionName: string;
  updatedAt: Date;
}

const titleText = sql`coalesce(${entriesTable.data}->>'title', '')`;

const entryDocument = sql`(
  setweight(to_tsvector('simple', ${titleText}), 'A') ||
  setweight(to_tsvector('simple', replace(${entriesTable.slug}, '-', ' ')), 'B') ||
  setweight(jsonb_to_tsvector('simple', ${entriesTable.data}, '["string"]'), 'C')
)`;

export async function searchEntries(
  database: DatabaseOrTransaction,
  tenantId: string,
  search: { words: readonly string[]; phrase: string; limit: number },
): Promise<EntrySearchRow[]> {
  const query = sql`to_tsquery('simple', ${prefixTsQuery(search.words)})`;
  // A title containing the phrase anywhere also counts, for the middle of a word ("port" in "Support").
  const titleContains = ilike(sql<string>`${titleText}`, `%${escapeLikePattern(search.phrase)}%`);

  return database
    .select({
      id: entriesTable.id,
      title: sql<string | null>`${entriesTable.data}->>'title'`,
      slug: entriesTable.slug,
      status: entriesTable.status,
      collectionHandle: collectionsTable.handle,
      collectionName: collectionsTable.name,
      updatedAt: entriesTable.updatedAt,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        eq(entriesTable.tenantId, tenantId),
        or(sql`${entryDocument} @@ ${query}`, titleContains),
      ),
    )
    .orderBy(
      desc(
        sql`ts_rank(${entryDocument}, ${query}) + (case when ${titleContains} then 1 else 0 end)`,
      ),
      desc(entriesTable.updatedAt),
    )
    .limit(search.limit);
}

/** Every word has to appear in the file name or the alt text. */
export async function searchAssets(
  database: DatabaseOrTransaction,
  tenantId: string,
  search: { words: readonly string[]; limit: number },
): Promise<AssetRow[]> {
  const wordConditions = search.words
    .map((word) => {
      const pattern = `%${escapeLikePattern(word)}%`;
      return or(ilike(assetsTable.filename, pattern), ilike(assetsTable.alt, pattern));
    })
    .filter((condition): condition is SQL => condition !== undefined);

  return database
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.tenantId, tenantId), ...wordConditions))
    .orderBy(desc(assetsTable.createdAt), desc(assetsTable.id))
    .limit(search.limit);
}
