import { and, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type GlobalValues, globalValuesTable as globalValuesDefinition } from "./globals.table.js";
import { upsert } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { jsonAsText } from "../database/dialect/expressions.js";

/** Database reads and writes for global values, nothing else. */

/** The set's values for one site in these languages, one row per language that has any. */
export async function findGlobalValues(
  database: DatabaseOrTransaction,
  globalSetId: string,
  siteId: string,
  locales: readonly string[],
): Promise<GlobalValues[]> {
  const globalValuesTable = tableFor(database, globalValuesDefinition);
  return database
    .select()
    .from(globalValuesTable)
    .where(
      and(
        eq(globalValuesTable.globalSetId, globalSetId),
        eq(globalValuesTable.siteId, siteId),
        inArray(globalValuesTable.locale, [...locales]),
      ),
    );
}

/** Every set's values for one site in these languages, for delivering all globals at once. */
export async function findAllGlobalValues(
  database: DatabaseOrTransaction,
  siteId: string,
  locales: readonly string[],
): Promise<GlobalValues[]> {
  const globalValuesTable = tableFor(database, globalValuesDefinition);
  return database
    .select()
    .from(globalValuesTable)
    .where(
      and(eq(globalValuesTable.siteId, siteId), inArray(globalValuesTable.locale, [...locales])),
    );
}

export async function upsertGlobalValues(
  database: DatabaseOrTransaction,
  values: Pick<GlobalValues, "globalSetId" | "siteId" | "locale" | "data" | "updatedBy">,
): Promise<void> {
  const globalValuesTable = tableFor(database, globalValuesDefinition);
  await upsert(database, globalValuesTable, values, {
    target: [globalValuesTable.globalSetId, globalValuesTable.siteId, globalValuesTable.locale],
    set: { data: values.data, updatedBy: values.updatedBy, updatedAt: new Date() },
  });
}

/** Rows whose values mention this id anywhere, for tidying up references to it. */
export async function findGlobalValuesMentioning(
  database: DatabaseOrTransaction,
  id: string,
): Promise<Pick<GlobalValues, "id" | "data">[]> {
  const globalValuesTable = tableFor(database, globalValuesDefinition);
  return database
    .select({ id: globalValuesTable.id, data: globalValuesTable.data })
    .from(globalValuesTable)
    .where(sql`${jsonAsText(database, globalValuesTable.data)} like ${`%"${id}"%`}`);
}

export async function replaceGlobalValuesData(
  database: DatabaseOrTransaction,
  globalValuesId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const globalValuesTable = tableFor(database, globalValuesDefinition);
  await database
    .update(globalValuesTable)
    .set({ data })
    .where(eq(globalValuesTable.id, globalValuesId));
}
