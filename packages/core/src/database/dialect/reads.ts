import { type SQL, desc, eq, sql } from "drizzle-orm";
import type { PgColumn, PgTable, SelectedFieldsFlat } from "drizzle-orm/pg-core";
import type { SelectResultFields } from "drizzle-orm/query-builders/select.types";
import type { DatabaseOrTransaction } from "../client.js";
import { dialectOf } from "./database-dialect.js";

interface NewestPerGroup<TFields extends SelectedFieldsFlat> {
  fields: TFields;
  groupBy: PgColumn;
  newest: PgColumn;
  where: SQL | undefined;
}

/**
 * The newest row of each group. `distinct on` on Postgres; MySQL has no such thing, so a
 * window function numbers each group's rows and the first of each is kept.
 */
export async function selectNewestPerGroup<TFields extends SelectedFieldsFlat>(
  database: DatabaseOrTransaction,
  table: PgTable,
  { fields, groupBy, newest, where }: NewestPerGroup<TFields>,
): Promise<SelectResultFields<TFields>[]> {
  if (dialectOf(database) === "postgres") {
    return database
      .selectDistinctOn([groupBy], fields)
      .from(table)
      .where(where)
      .orderBy(groupBy, desc(newest)) as unknown as Promise<SelectResultFields<TFields>[]>;
  }
  const numbered = database
    .select({
      ...fields,
      placeInGroup:
        sql<number>`row_number() over (partition by ${groupBy} order by ${newest} desc)`.as(
          "place_in_group",
        ),
    })
    .from(table)
    .where(where)
    .as("numbered");
  // Drizzle can't follow generic fields through a subquery, so its columns are read by name.
  const columns = numbered as unknown as Record<string, PgColumn>;
  const kept = Object.fromEntries(Object.keys(fields).map((key) => [key, columns[key]]));
  const rows = await database
    .select(kept as SelectedFieldsFlat)
    .from(numbered as unknown as PgTable)
    .where(eq(columns.placeInGroup as PgColumn, 1));
  return rows as SelectResultFields<TFields>[];
}

/**
 * For `.for("update", ...)` on a query with joins: lock only this table's rows. MariaDB can't
 * name a table there, so on MySQL and MariaDB the joined rows are locked too.
 */
export function lockOnly(
  database: DatabaseOrTransaction,
  table: PgTable,
): { of: PgTable } | undefined {
  return dialectOf(database) === "postgres" ? { of: table } : undefined;
}
