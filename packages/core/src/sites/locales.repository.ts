import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { type NewSiteLocale, type SiteLocale, siteLocalesTable } from "./locales.table.js";

/** Database reads and writes for a site's locales, nothing else. */

export type SiteLocaleWithCount = SiteLocale & { entryCount: number };

function localeColumn(name: string) {
  return sql`${sql.identifier("site_locales")}.${sql.identifier(name)}`;
}

export async function listSiteLocales(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<SiteLocaleWithCount[]> {
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
  const [inserted] = await database
    .insert(siteLocalesTable)
    .values(locale)
    .onConflictDoNothing({ target: [siteLocalesTable.siteId, siteLocalesTable.code] })
    .returning();
  return inserted;
}

export async function renameSiteLocale(
  database: DatabaseOrTransaction,
  localeId: string,
  name: string,
): Promise<void> {
  await database
    .update(siteLocalesTable)
    .set({ name, updatedAt: new Date() })
    .where(eq(siteLocalesTable.id, localeId));
}

export async function deleteSiteLocale(
  database: DatabaseOrTransaction,
  localeId: string,
): Promise<void> {
  await database.delete(siteLocalesTable).where(eq(siteLocalesTable.id, localeId));
}

export async function countEntriesInLocale(
  database: DatabaseOrTransaction,
  siteId: string,
  code: string,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(and(eq(entriesTable.siteId, siteId), eq(entriesTable.locale, code)));
  return row?.count ?? 0;
}
