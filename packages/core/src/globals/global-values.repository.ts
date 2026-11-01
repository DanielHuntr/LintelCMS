import { and, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type GlobalValues, globalValuesTable } from "./globals.table.js";

/** Database reads and writes for global values, nothing else. */

/** The set's values in these languages, one row per language that has any. */
export async function findGlobalValues(
  database: DatabaseOrTransaction,
  globalSetId: string,
  locales: readonly string[],
): Promise<GlobalValues[]> {
  return database
    .select()
    .from(globalValuesTable)
    .where(
      and(
        eq(globalValuesTable.globalSetId, globalSetId),
        inArray(globalValuesTable.locale, [...locales]),
      ),
    );
}

/** Every set's values in these languages, for delivering all globals at once. */
export async function findAllGlobalValues(
  database: DatabaseOrTransaction,
  locales: readonly string[],
): Promise<GlobalValues[]> {
  return database
    .select()
    .from(globalValuesTable)
    .where(inArray(globalValuesTable.locale, [...locales]));
}

export async function upsertGlobalValues(
  database: DatabaseOrTransaction,
  values: Pick<GlobalValues, "globalSetId" | "locale" | "data" | "updatedBy">,
): Promise<void> {
  await database
    .insert(globalValuesTable)
    .values(values)
    .onConflictDoUpdate({
      target: [globalValuesTable.globalSetId, globalValuesTable.locale],
      set: { data: values.data, updatedBy: values.updatedBy, updatedAt: new Date() },
    });
}

/** Rows whose values mention this id anywhere, for tidying up references to it. */
export async function findGlobalValuesMentioning(
  database: DatabaseOrTransaction,
  id: string,
): Promise<Pick<GlobalValues, "id" | "data">[]> {
  return database
    .select({ id: globalValuesTable.id, data: globalValuesTable.data })
    .from(globalValuesTable)
    .where(sql`${globalValuesTable.data}::text like ${`%"${id}"%`}`);
}

export async function replaceGlobalValuesData(
  database: DatabaseOrTransaction,
  globalValuesId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await database
    .update(globalValuesTable)
    .set({ data })
    .where(eq(globalValuesTable.id, globalValuesId));
}
