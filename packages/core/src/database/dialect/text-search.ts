import { type SQL, type SQLWrapper, and, sql } from "drizzle-orm";
import { escapeLikePattern, prefixTsQuery } from "../../search/search-terms.js";
import type { DatabaseOrTransaction } from "../client.js";
import { dialectOf } from "./database-dialect.js";

/**
 * Searching text and JSON values for words. On Postgres this is full-text search, worked out
 * when the query runs: there is no stored index. MySQL's FULLTEXT needs an index on a text
 * column, which a JSON column can't have, so there each word is looked for with `like`, and
 * in JSON with `json_search`, which reads values and never keys.
 *
 * Those can't tell where a word starts inside a JSON value, so on MySQL `matches` also finds
 * "support" for "port". `capabilitiesOf(database).searchFindsWordStarts` says so, and
 * `documentHasWords` in `search/word-starts.ts` then gives the final answer on each row.
 * The rank does know where words start in the title and slug, which are short.
 */

export interface SearchedDocument {
  /** Text that counts for most. Must not be null. */
  title: SQLWrapper;
  /** Text that counts for less, with words joined by hyphens. */
  slug: SQLWrapper;
  /** A JSON value, whose text values count for least. */
  values: SQLWrapper;
}

export interface TextSearch {
  /** Every word is in the document, or on MySQL, inside some word of it. */
  matches: SQL;
  /** A number: higher is a better match. */
  rank: SQL;
}

function postgresTextSearch(document: SearchedDocument, words: readonly string[]): TextSearch {
  const query = sql`to_tsquery('simple', ${prefixTsQuery(words)})`;
  const vector = sql`(
  setweight(to_tsvector('simple', ${document.title}), 'A') ||
  setweight(to_tsvector('simple', replace(${document.slug}, '-', ' ')), 'B') ||
  setweight(jsonb_to_tsvector('simple', ${document.values}, '["string"]'), 'C')
)`;
  return { matches: sql`${vector} @@ ${query}`, rank: sql`ts_rank(${vector}, ${query})` };
}

/** Starts a word: Unicode classes, as `\\b` only knows ASCII on MariaDB. Words are safe here. */
function startOfWordPattern(word: string): string {
  return String.raw`(^|[^\p{L}\p{N}])${word}`;
}

function mysqlTextSearch(document: SearchedDocument, words: readonly string[]): TextSearch {
  const title = sql`lower(${document.title})`;
  const slug = sql`lower(replace(${document.slug}, '-', ' '))`;
  // Lower case first, as json_search is exact on MySQL. Lowered JSON text is still valid JSON.
  const values = sql`lower(cast(${document.values} as char))`;
  const parts = words.map((word) => {
    const pattern = `%${escapeLikePattern(word)}%`;
    return {
      inTitle: sql`${title} like ${pattern}`,
      inSlug: sql`${slug} like ${pattern}`,
      inValues: sql`json_search(${values}, 'one', ${pattern}) is not null`,
      startsInTitle: sql`${title} regexp ${startOfWordPattern(word)}`,
      startsInSlug: sql`${slug} regexp ${startOfWordPattern(word)}`,
    };
  });
  const scores = parts.map(
    ({ startsInTitle, startsInSlug, inValues }) =>
      sql`(case when ${startsInTitle} then 1 else 0 end) + (case when ${startsInSlug} then 0.4 else 0 end) + (case when ${inValues} then 0.2 else 0 end)`,
  );
  const everyWord = parts.map(({ inTitle, inSlug, inValues }) =>
    sql.join([sql`(`, inTitle, sql` or `, inSlug, sql` or `, inValues, sql`)`]),
  );
  return { matches: and(...everyWord) ?? sql`false`, rank: sql.join(scores, sql` + `) };
}

/** How to find words in a document. All of them must be there, and there must be some. */
export function textSearch(
  database: DatabaseOrTransaction,
  document: SearchedDocument,
  words: readonly string[],
): TextSearch {
  return dialectOf(database) === "postgres"
    ? postgresTextSearch(document, words)
    : mysqlTextSearch(document, words);
}
