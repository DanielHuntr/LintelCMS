import { type SQL, type SQLWrapper, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../client.js";
import { dialectOf } from "./database-dialect.js";

/**
 * JSON work that goes beyond reading one key (see `expressions.ts` for that): looking inside
 * a document, changing it in place and building one. On Postgres each gives the fragment it
 * replaced. Keys here are bound as values, so they can be anything a field handle can be.
 */

function mysqlKeyPath(key: string): string {
  return `$.${JSON.stringify(key)}`;
}

/** A MySQL JSON path through object keys and list positions. */
function mysqlPathThrough(steps: readonly (string | number)[]): string {
  const parts = steps.map((step) =>
    typeof step === "number" ? `[${step}]` : `.${JSON.stringify(step)}`,
  );
  return `$${parts.join("")}`;
}

/**
 * A value some steps inside a JSON document, as text: `branch->'entries'->0->>'siteId'`. The
 * steps are written into the SQL on Postgres, so they must be fixed words and numbers, never
 * what someone typed.
 */
export function jsonTextAt(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  steps: readonly (string | number)[],
): SQL<string | null> {
  if (dialectOf(database) === "postgres") {
    const path = steps.map((step, place) => {
      const arrow = place === steps.length - 1 ? "->>" : "->";
      return typeof step === "number" ? `${arrow}${step}` : `${arrow}'${step}'`;
    });
    return sql`${json}${sql.raw(path.join(""))}`;
  }
  const value = sql`json_extract(${json}, ${mysqlPathThrough(steps)})`;
  return sql`(case when json_type(${value}) = 'NULL' then null else json_unquote(${value}) end)`;
}

/** Whether a JSON object has this key, whatever its value. */
export function jsonHasKey(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  key: string,
): SQL<boolean> {
  return dialectOf(database) === "postgres"
    ? sql`jsonb_exists(${json}, ${key}::text)`
    : sql`json_contains_path(${json}, 'one', ${mysqlKeyPath(key)})`;
}

/** Whether a JSON value is an object, rather than a list, a plain value or missing. */
export function jsonIsObject(database: DatabaseOrTransaction, json: SQLWrapper): SQL<boolean> {
  return dialectOf(database) === "postgres"
    ? sql`jsonb_typeof(${json}) = 'object'`
    : sql`json_type(${json}) = 'OBJECT'`;
}

/** One key of a JSON object as JSON, for use inside a query rather than selected. */
export function jsonKeyInQuery(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  key: string,
): SQL {
  return dialectOf(database) === "postgres"
    ? sql`(${json} -> ${key}::text)`
    : sql`json_extract(${json}, ${mysqlKeyPath(key)})`;
}

/** Whether one key of a JSON object holds exactly this value. */
export function jsonKeyEquals(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  key: string,
  value: unknown,
): SQL<boolean> {
  const text = JSON.stringify(value);
  if (dialectOf(database) === "postgres") return sql`${json} -> ${key} = ${text}::jsonb`;
  // MariaDB can't cast to json. Each holding the other is the same as being equal, whichever
  // order an object's keys are in.
  const stored = sql`json_extract(${json}, ${mysqlKeyPath(key)})`;
  return sql`(json_contains(${stored}, ${text}) and json_contains(${text}, ${stored}))`;
}

/** Whether a list held under a key in a JSON object has this item. */
export function jsonKeyListIncludes(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  key: string,
  item: unknown,
): SQL<boolean> {
  const list = JSON.stringify([item]);
  return dialectOf(database) === "postgres"
    ? sql`(${json} -> ${key}) @> ${list}::jsonb`
    : sql`json_contains(${json}, ${list}, ${mysqlKeyPath(key)})`;
}

/** A value as JSON, ready for `jsonWithKey`. */
export function jsonLiteral(database: DatabaseOrTransaction, value: unknown): SQL {
  const text = JSON.stringify(value);
  // json_extract is how to say "this text is JSON" on both MySQL and MariaDB.
  return dialectOf(database) === "postgres" ? sql`${text}::jsonb` : sql`json_extract(${text}, '$')`;
}

/** The object with this key set to a JSON value. */
export function jsonWithKey(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  key: string,
  value: SQLWrapper,
): SQL {
  return dialectOf(database) === "postgres"
    ? sql`jsonb_set(${json}, array[${key}::text], ${value})`
    : sql`json_set(${json}, ${mysqlKeyPath(key)}, ${value})`;
}

/** The object with a key's value moved to another key. */
export function jsonWithKeyRenamed(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  from: string,
  to: string,
): SQL {
  if (dialectOf(database) === "postgres") {
    return sql`(${json} - ${from}::text) || jsonb_build_object(${to}::text, ${json} -> ${from}::text)`;
  }
  const fromPath = mysqlKeyPath(from);
  return sql`json_set(json_remove(${json}, ${fromPath}), ${mysqlKeyPath(to)}, json_extract(${json}, ${fromPath}))`;
}

/** Just these keys of a JSON object, as an object, selected as a value of its own. */
export function jsonOnlyKeys(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  keys: readonly string[],
): SQL<Record<string, unknown>> {
  if (dialectOf(database) === "postgres") {
    if (keys.length === 0) return sql`'{}'::jsonb`;
    return sql`jsonb_build_object(${sql.join(
      keys.map((key) => sql`${key}::text, ${json}->${key}`),
      sql`, `,
    )})`;
  }
  const pairs = sql.join(
    keys.map((key) => sql`${key}, json_extract(${json}, ${mysqlKeyPath(key)})`),
    sql`, `,
  );
  const object = keys.length === 0 ? sql`'{}'` : sql`json_object(${pairs})`;
  return object.mapWith((text: string) => JSON.parse(text) as Record<string, unknown>);
}

/** Whether any value at the top of a JSON object is this text, ignoring case and spaces. */
export function jsonObjectHoldsText(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  text: string,
): SQL<boolean> {
  const wanted = text.trim().toLowerCase();
  return dialectOf(database) === "postgres"
    ? sql`exists (select 1 from jsonb_each_text(${json}) as answer where lower(trim(answer.value)) = ${wanted})`
    : sql`exists (select 1 from json_table(${json}, '$.*' columns (value longtext collate utf8mb4_bin path '$')) as answer where lower(trim(answer.value)) = ${wanted})`;
}

/** Whether a JSON list of text has an item matching a `like` pattern, ignoring case. */
export function jsonListHasItemLike(
  database: DatabaseOrTransaction,
  json: SQLWrapper,
  pattern: string,
): SQL<boolean> {
  return dialectOf(database) === "postgres"
    ? sql`exists (select 1 from jsonb_array_elements_text(${json}) as tag where tag ilike ${pattern})`
    : sql`exists (select 1 from json_table(${json}, '$[*]' columns (item longtext collate utf8mb4_bin path '$')) as tag where lower(tag.item) like lower(${pattern}))`;
}

/** The titles of the first few entries under an item in the recycle bin, from its branch. */
export function childTitlesInBranch(
  database: DatabaseOrTransaction,
  branch: SQLWrapper,
  parentId: SQLWrapper,
  limit: number,
): SQL<string[] | null> {
  if (dialectOf(database) === "postgres") {
    return sql`(
        select jsonb_agg(child.value->'data'->>'title')
        from (
          select value from jsonb_array_elements(${branch}->'entries')
          where value->>'parentId' = ${parentId}::text
          limit ${limit}
        ) as child
      )`;
  }
  return sql`(
    select json_arrayagg(child.title)
    from json_table(${branch}, '$.entries[*]' columns (
      parent_id varchar(36) collate utf8mb4_bin path '$.parentId',
      title longtext collate utf8mb4_bin path '$.data.title'
    )) as child
    where child.parent_id = ${parentId} collate utf8mb4_bin
  )`.mapWith((text: string | null) =>
    text === null ? null : (JSON.parse(text) as string[]).slice(0, limit),
  );
}

/** A number that orders rows by where their id comes in a list. */
export function positionInList(
  database: DatabaseOrTransaction,
  column: SQLWrapper,
  ids: readonly string[],
): SQL {
  const items = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  return dialectOf(database) === "postgres"
    ? sql`array_position(array[${items}]::uuid[], ${column})`
    : sql`field(${column}, ${items})`;
}
