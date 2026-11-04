import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition, type EntryStatus } from "../entries/entries.table.js";
import { type AssetRow, assetsTable as assetsDefinition } from "../media/media.table.js";
import { escapeLikePattern } from "./search-terms.js";
import { documentHasWords } from "./word-starts.js";
import { capabilitiesOf } from "../database/dialect/database-dialect.js";
import { jsonText, likeIgnoringCase } from "../database/dialect/expressions.js";
import { textSearch } from "../database/dialect/text-search.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/**
 * Database reads for search, nothing else.
 *
 * Entries are searched through `textSearch`. The document is the title, weighted highest, then
 * the slug, then every text value in the entry's fields, inside rich text and blocks included,
 * never the JSON keys. It doesn't stem or drop words, so it behaves the same in any language.
 * Where the database can't tell where a word starts, each row found is checked in Node.
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

/** Rows read at a time on MySQL, doubled each time, as most searches stop at the first. */
const FIRST_PAGE_OF_ROWS = 100;

export async function searchEntries(
  database: DatabaseOrTransaction,
  tenantId: string,
  search: {
    words: readonly string[];
    phrase: string;
    limit: number;
    /** Only these sites' entries, or null for every site. */
    siteIds: readonly string[] | null;
  },
): Promise<EntrySearchRow[]> {
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const title = jsonText(database, entriesTable.data, "title");
  const titleText = sql<string>`coalesce(${title}, '')`;
  const { matches, rank } = textSearch(
    database,
    { title: titleText, slug: entriesTable.slug, values: entriesTable.data },
    search.words,
  );
  // A title containing the phrase anywhere also counts, for the middle of a word ("port" in "Support").
  const titleContains = likeIgnoringCase(
    database,
    titleText,
    `%${escapeLikePattern(search.phrase)}%`,
  );

  const fields = {
    id: entriesTable.id,
    title,
    slug: entriesTable.slug,
    status: entriesTable.status,
    collectionHandle: collectionsTable.handle,
    collectionName: collectionsTable.name,
    updatedAt: entriesTable.updatedAt,
  };
  const where = and(
    eq(entriesTable.tenantId, tenantId),
    search.siteIds === null ? undefined : inArray(entriesTable.siteId, [...search.siteIds]),
    or(matches, titleContains),
  );
  const bestFirst = desc(sql`${rank} + (case when ${titleContains} then 1 else 0 end)`);

  if (capabilitiesOf(database).searchFindsWordStarts) {
    return database
      .select(fields)
      .from(entriesTable)
      .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
      .where(where)
      .orderBy(bestFirst, desc(entriesTable.updatedAt))
      .limit(search.limit);
  }

  const kept: EntrySearchRow[] = [];
  const phrase = search.phrase.toLowerCase();
  let offset = 0;
  for (let size = FIRST_PAGE_OF_ROWS; kept.length < search.limit; size *= 2) {
    const rows = await database
      .select({ ...fields, data: entriesTable.data })
      .from(entriesTable)
      .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
      .where(where)
      .orderBy(bestFirst, desc(entriesTable.updatedAt), desc(entriesTable.id))
      .limit(size)
      .offset(offset);
    for (const row of rows) {
      const text = row.title ?? "";
      const document = { title: text, slug: row.slug, values: row.data };
      if (text.toLowerCase().includes(phrase) || documentHasWords(document, search.words)) {
        kept.push({ ...row, data: undefined } as EntrySearchRow);
      }
    }
    if (rows.length < size) break;
    offset += size;
  }
  return kept.slice(0, search.limit);
}

/** Every word has to appear in the file name or the alt text. */
export async function searchAssets(
  database: DatabaseOrTransaction,
  tenantId: string,
  search: { words: readonly string[]; limit: number },
): Promise<AssetRow[]> {
  const assetsTable = tableFor(database, assetsDefinition);
  const wordConditions = search.words
    .map((word) => {
      const pattern = `%${escapeLikePattern(word)}%`;
      return or(
        likeIgnoringCase(database, assetsTable.filename, pattern),
        likeIgnoringCase(database, assetsTable.alt, pattern),
      );
    })
    .filter((condition): condition is SQL => condition !== undefined);

  return database
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.tenantId, tenantId), ...wordConditions))
    .orderBy(desc(assetsTable.createdAt), desc(assetsTable.id))
    .limit(search.limit);
}
