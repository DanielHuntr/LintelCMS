import { type SQL, type SQLWrapper, desc, ilike, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../client.js";
import { dialectOf } from "./database-dialect.js";

/**
 * SQL that is written differently on each database. On Postgres each gives exactly the
 * fragment it replaced. Use these rather than writing `->>`, `@>`, `::` and the like in a
 * repository: `postgres-only-code.test.ts` refuses new ones.
 */

/** A MySQL JSON path for one key, quoted so any key is safe. */
function mysqlJsonPath(key: string): string {
  return `$.${JSON.stringify(key)}`;
}

/** Plain keys stay literal on Postgres, as they were written before these helpers. */
function postgresJsonKey(key: string): SQL {
  return /^[A-Za-z0-9_]+$/.test(key) ? sql.raw(`'${key}'`) : sql`${key}`;
}

/** One key of a JSON object as text: `data->>'title'`. A JSON null gives SQL null. */
export function jsonText(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  key: string,
): SQL<string | null> {
  if (dialectOf(database) === "postgres") {
    return sql`${json}->>${postgresJsonKey(key)}`;
  }
  const value = sql`json_extract(${json}, ${mysqlJsonPath(key)})`;
  // json_unquote alone would turn a JSON null into the word "null".
  return sql`(case when json_type(${value}) = 'NULL' then null else json_unquote(${value}) end)`;
}

/**
 * One key of a JSON object as JSON: `data -> 'design'`. Selected on its own it isn't read
 * through a column, so on MySQL it's parsed here.
 */
export function jsonValue(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  key: string,
): SQL<unknown> {
  if (dialectOf(database) === "postgres") {
    return sql`${json} -> ${postgresJsonKey(key)}`;
  }
  return sql<unknown>`json_extract(${json}, ${mysqlJsonPath(key)})`.mapWith((text: string) =>
    JSON.parse(text),
  );
}

/** Whether a JSON list has this item: `tags @> '["sale"]'`. */
export function jsonListIncludes(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  item: unknown,
): SQL<boolean> {
  const list = JSON.stringify([item]);
  return dialectOf(database) === "postgres"
    ? sql`${json} @> ${list}::jsonb`
    : sql`json_contains(${json}, ${list})`;
}

/**
 * A JSON value as text, for finding words anywhere inside it. The spacing differs: Postgres
 * and MySQL write `"a": 1`, MariaDB keeps `"a":1`. So look for a quoted value, never for a
 * key and its value together.
 */
export function jsonAsText(database: DatabaseOrTransaction, json: SQLWrapper): SQL<string> {
  return dialectOf(database) === "postgres" ? sql`${json}::text` : sql`cast(${json} as char)`;
}

/** `ilike`: a `like` pattern that ignores case. */
export function likeIgnoringCase(
  database: DatabaseOrTransaction,
  text: SQL | Parameters<typeof ilike>[0],
  pattern: string,
): SQL {
  return dialectOf(database) === "postgres"
    ? ilike(text, pattern)
    : sql`lower(${text}) like lower(${pattern})`;
}

/** Counts rows matching a condition: `count(*) filter (where ...)`. */
export function countWhere(database: DatabaseOrTransaction, condition: SQLWrapper): SQL<number> {
  const count =
    dialectOf(database) === "postgres"
      ? sql<number>`count(*) filter (where ${condition})`
      : sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`;
  return count.mapWith(Number);
}

/** Adds up an amount over rows matching a condition, giving 0 for none. */
export function sumWhere(
  database: DatabaseOrTransaction,
  amount: SQLWrapper,
  condition: SQLWrapper,
): SQL<number> {
  return dialectOf(database) === "postgres"
    ? sql`coalesce(sum(${amount}) filter (where ${condition}), 0)`
    : sql`coalesce(sum(case when ${condition} then ${amount} else 0 end), 0)`;
}

/** `order by ... nulls last`. MySQL puts nulls first when ascending. */
export function orderNullsLast(
  database: DatabaseOrTransaction,
  expression: SQLWrapper,
  direction: "asc" | "desc",
): SQL {
  const order = sql.raw(direction);
  return dialectOf(database) === "postgres"
    ? sql`${expression} ${order} nulls last`
    : sql`${expression} is null, ${expression} ${order}`;
}

/** Descending, with nulls first as Postgres has them. MySQL puts them last. */
export function orderNewestFirst(database: DatabaseOrTransaction, column: SQLWrapper): SQL {
  return dialectOf(database) === "postgres"
    ? desc(column)
    : sql`${column} is null desc, ${column} desc`;
}

/** The UTC day of a timestamp, as "2026-11-04". */
export function utcDay(database: DatabaseOrTransaction, timestamp: SQLWrapper): SQL<string> {
  return dialectOf(database) === "postgres"
    ? sql`to_char(${timestamp} at time zone 'UTC', 'YYYY-MM-DD')`
    : sql`date_format(${timestamp}, '%Y-%m-%d')`;
}

/** A moment some days before another, where the days come from a column. */
export function daysBefore(
  database: DatabaseOrTransaction,
  moment: Date,
  days: SQLWrapper,
): SQL<Date> {
  return dialectOf(database) === "postgres"
    ? sql`${moment.toISOString()}::timestamptz - make_interval(days => ${days})`
    : sql`date_sub(${moment}, interval ${days} day)`;
}

/** Whether a list of ids has this id: a uuid array on Postgres, a JSON list on MySQL. */
export function idListIncludes(
  database: DatabaseOrTransaction,
  list: SQLWrapper,
  id: string,
): SQL<boolean> {
  return dialectOf(database) === "postgres"
    ? sql`${id}::uuid = any(${list})`
    : jsonListIncludes(database, list, id);
}

/** The list without this id. Use with `idListIncludes`: the id must be in the list. */
export function idListWithout(database: DatabaseOrTransaction, list: SQLWrapper, id: string): SQL {
  return dialectOf(database) === "postgres"
    ? sql`array_remove(${list}, ${id}::uuid)`
    : sql`json_remove(${list}, json_unquote(json_search(${list}, 'one', ${id})))`;
}
