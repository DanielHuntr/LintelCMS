import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import {
  type NewSiteLocale,
  type SiteLocale,
  siteLocalesTable as siteLocalesDefinition,
} from "./locales.table.js";
import { insertIfNewReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for a site's locales, nothing else. */

export type SiteLocaleWithCount = SiteLocale & { entryCount: number };

function localeColumn(name: string) {
  return sql`${sql.identifier("site_locales")}.${sql.identifier(name)}`;
}

export async function listSiteLocales(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<SiteLocaleWithCount[]> {
  const entriesTable = tableFor(database, entriesDefinition);
  const siteLocalesTable = tableFor(database, siteLocalesDefinition);
  return database
    .select({
      ...getTableColumns(siteLocalesTable),
      // Spelled out in full: without a join, Drizzle leaves column names unqualified.
      entryCount: sql<number>`(
        select count(*) from ${entriesTable}
        where ${entriesTable.siteId} = ${localeColumn("site_id")}
          and ${entriesTable.locale} = ${localeColumn("code")}
      )`.mapWith(Number),
    })
    .from(siteLocalesTable)
    .where(eq(siteLocalesTable.siteId, siteId))
    .orderBy(asc(siteLocalesTable.createdAt), asc(siteLocalesTable.code));
}

export async function findSiteLocale(
  database: DatabaseOrTransaction,
  siteId: string,
  code: string,
): Promise<SiteLocale | undefined> {
  const siteLocalesTable = tableFor(database, siteLocalesDefinition);
  const [locale] = await database
    .select()
    .from(siteLocalesTable)
    .where(and(eq(siteLocalesTable.siteId, siteId), eq(siteLocalesTable.code, code)))
    .limit(1);
  return locale;
}

/** Inserts the locale unless the site already has it; returns undefined if it did. */
export async function insertSiteLocaleIfMissing(
  database: DatabaseOrTransaction,
  locale: NewSiteLocale,
): Promise<SiteLocale | undefined> {
  const siteLocalesTable = tableFor(database, siteLocalesDefinition);
  const [inserted] = await insertIfNewReturning(database, siteLocalesTable, locale, {
    target: [siteLocalesTable.siteId, siteLocalesTable.code],
  });
  return inserted;
}

export async function renameSiteLocale(
  database: DatabaseOrTransaction,
  localeId: string,
  name: string,
): Promise<void> {
  const siteLocalesTable = tableFor(database, siteLocalesDefinition);
  await database
    .update(siteLocalesTable)
    .set({ name, updatedAt: new Date() })
    .where(eq(siteLocalesTable.id, localeId));
}

export async function deleteSiteLocale(
  database: DatabaseOrTransaction,
  localeId: string,
): Promise<void> {
  const siteLocalesTable = tableFor(database, siteLocalesDefinition);
  await database.delete(siteLocalesTable).where(eq(siteLocalesTable.id, localeId));
}

export async function countEntriesInLocale(
  database: DatabaseOrTransaction,
  siteId: string,
  code: string,
): Promise<number> {
  const entriesTable = tableFor(database, entriesDefinition);
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(and(eq(entriesTable.siteId, siteId), eq(entriesTable.locale, code)));
  return row?.count ?? 0;
}
